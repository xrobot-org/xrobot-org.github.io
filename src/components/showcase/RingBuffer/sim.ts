/* RingBuffer simulation kernel. No DOM: runs in the browser and under node (sim.test.mjs, node 24+ type stripping).

   Function-by-function port of LibXR (dev f2b44d1a, checked against 4e96701) for the receive path of a UART:
     src/structure/queue/spsc_queue_base.hpp   SPSCQueueBase: PushBatchBytes PopBatchBytes ProduceWithWriter ConsumeWithReader
                                               Reset Size EmptySize (head_ = read cursor, tail_ = write cursor, one slot always free)
     src/core/rw/read_port.hpp / .cpp          ReadPort: operator() TryClaimIdle ReleaseClaimed ClaimBlockCompletion
                                               ReleaseBlockCompletion PublishProduced ProcessPendingReads CompleteClaimedRead
                                               CompleteClaimedBlock WaitForBlock ClearQueuedData, ReadQueue (GetReadQueue / PushBatch / Publish)
     src/utils/serialized_service.hpp          Invoke Drain (OWNER_BIT 31 + event bits)
     driver/st/stm32_uart.cpp                  HandleRxData, HandleTxService, RxEventIRQHandler (tx_service_ events)
     src/utils/crc.hpp                         CRC8 (reflected 0x8C table, init 0xFF)
   Generators: `yield S(id, us)` announces the line about to run and its cost in microseconds; the code after the yield is
   that line's effect, applied when the step completes (an interrupt can land between a load and the compare-exchange that
   follows it, so the retry loops are the real ones). Costs are for a 72 MHz Cortex-M3 (-Og user code, -O2 HAL / FreeRTOS).

   Around the kernel: the UART line (8N1, packets of the perf-uart loopback test: counter byte, 1..P-2, CRC8), a circular RX DMA
   (128 B, HT / TC / IDLE requests), an NVIC with one pending bit per line, a priority scheduler for the read thread (4) and the
   write thread (3), and a discrete-event heap. The pictures read the state of this object and never change it. */

// ============================================================================ 1. LibXR ports
export const EC = {
  OK: 'OK', FULL: 'FULL', EMPTY: 'EMPTY', BUSY: 'BUSY', TIMEOUT: 'TIMEOUT', SIZE_ERR: 'SIZE_ERR', NOT_SUPPORT: 'NOT_SUPPORT', PTR_NULL: 'PTR_NULL',
} as const;
export type ErrorCode = (typeof EC)[keyof typeof EC];

// cost of one step in microseconds
export const T = {
  ld: 0.08, st: 0.08, cas: 0.14, ar: 0.12, mmio: 0.2, call: 0.25, ret: 0.1, byte: 0.5, isrIn: 1.9, isrOut: 0.7, postIsr: 1.8, post: 1.6,
  sw: 3.2, wait: 1.2, crc: 0.8, fill: 5, txIsr: 2.6, wwork: 24,
};

export type StepInfo = Record<string, any> | null;
export type Step = { id: string; us: number; info: StepInfo };
export type BlockReq = { block: Semaphore; timeout: number };
export type Yielded = Step | BlockReq;
export type Gen<R> = Generator<Yielded, R, any>;
export const S = (id: string, us: number, info?: StepInfo): Step => ({ id, us, info: info || null });

// ---------------------------------------------------------------- CRC8 (src/utils/crc.hpp)
export const CRC8 = (() => {
  const tab = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 7; j >= 0; j--) c = c & 1 ? (c >>> 1) ^ 0x8c : c >>> 1;
    tab[i] = c;
  }
  const Calculate = (buf: ArrayLike<number>, len: number, off = 0): number => {
    let crc = 0xff;
    for (let i = 0; i < len; i++) crc = tab[(crc ^ buf[off + i]) & 0xff];
    return crc;
  };
  const Verify = (buf: ArrayLike<number>, len: number): boolean => len >= 2 && Calculate(buf, len - 1) === buf[len - 1];
  return { tab, Calculate, Verify };
})();

// ---------------------------------------------------------------- SPSCQueueBase<uint8_t> (spsc_queue_base.hpp)
// head_ = next ring index to dequeue (consumer), tail_ = next ring index to enqueue (producer); the ring has capacity + 1
// physical slots and one always stays free: tail + 1 == head is full, head == tail is empty. meta[] rides along with every byte
// (packet id * 512 + index in the packet) so that the pictures can colour cells; it is not part of the library.
export type ByteSrc = { buf: Uint8Array; meta: Int32Array; n?: number; ring?: string | null };
export type ByteDst = { buf: Uint8Array; meta: Int32Array; n: number };

export class SPSCQueue {
  capacity_: number;
  buf: Uint8Array;
  meta: Int32Array;
  head_ = 0;
  tail_ = 0;
  constructor(capacity: number) {
    this.capacity_ = capacity;
    this.buf = new Uint8Array(capacity + 1);
    this.meta = new Int32Array(capacity + 1).fill(-1);
  }
  RingCapacity(): number { return this.capacity_ + 1; }
  Increment(i: number): number { return (i + 1) % this.RingCapacity(); }
  Size(): number {
    const h = this.head_, t = this.tail_;
    return t >= h ? t - h : this.RingCapacity() - h + t;
  }
  EmptySize(): number { return this.capacity_ - this.Size(); }
  MaxSize(): number { return this.capacity_; }
  PushBytes(v: number, m?: number): ErrorCode {
    const current_tail = this.tail_, next_tail = this.Increment(current_tail);
    if (next_tail === this.head_) return EC.FULL;
    this.buf[current_tail] = v;
    this.meta[current_tail] = m === undefined ? -1 : m;
    this.tail_ = next_tail;
    return EC.OK;
  }
  PopBytes(out?: { v?: number; m?: number }): ErrorCode {
    const current_head = this.head_;
    if (current_head === this.tail_) return EC.EMPTY;
    if (out) { out.v = this.buf[current_head]; out.m = this.meta[current_head]; }
    this.head_ = this.Increment(current_head);
    return EC.OK;
  }
  // two-span producer / consumer callbacks (ProduceWithWriter / ConsumeWithReader)
  ProduceWithWriter(limit: number, writer: (a: number, na: number, b: number | null, nb: number) => number): number {
    if (limit === 0) return 0;
    const current_tail = this.tail_, current_head = this.head_, capacity = this.RingCapacity();
    const free_space = current_tail >= current_head ? capacity - (current_tail - current_head) - 1 : current_head - current_tail - 1;
    const offered = Math.min(limit, free_space);
    if (offered === 0) return 0;
    const first_count = Math.min(offered, capacity - current_tail), second_count = offered - first_count;
    const produced = writer(current_tail, first_count, second_count === 0 ? null : 0, second_count);
    if (produced > offered) throw new Error('ProduceWithWriter: produced > offered');
    if (produced !== 0) this.tail_ = (current_tail + produced) % capacity;
    return produced;
  }
  ConsumeWithReader(limit: number, reader: (a: number, na: number, b: number | null, nb: number) => number): number {
    if (limit === 0) return 0;
    const current_head = this.head_, current_tail = this.tail_, capacity = this.RingCapacity();
    const available = current_tail >= current_head ? current_tail - current_head : capacity - current_head + current_tail;
    const offered = Math.min(limit, available);
    if (offered === 0) return 0;
    const first_count = Math.min(offered, capacity - current_head), second_count = offered - first_count;
    const accepted = reader(current_head, first_count, second_count === 0 ? null : 0, second_count);
    if (accepted > offered) throw new Error('ConsumeWithReader: accepted > offered');
    if (accepted !== 0) this.head_ = (current_head + accepted) % capacity;
    return accepted;
  }
  // consumer side: snapshot tail and move head to it (never writes tail)
  Reset(): void { this.head_ = this.tail_; }
}

// PushBatchBytes: src = {buf, meta, n (ring length, or 0 / undefined for a linear source)}, off = first source index
export function* PushBatchBytes(q: SPSCQueue, src: ByteSrc, off: number, count: number, tag?: string): Gen<ErrorCode> {
  if (count === 0) return EC.OK;
  yield S('push.tail', T.ld, { fn: 'push', load: 'tail', order: 'relaxed', ring: 'q', idx: q.tail_, tag });
  const current_tail = q.tail_;
  yield S('push.head', T.ld, { fn: 'push', load: 'head', order: 'acquire', ring: 'q', idx: q.head_, tag });
  const current_head = q.head_;
  const capacity = q.RingCapacity();
  yield S('push.free', T.ar, { fn: 'push', tag });
  const free_space = current_tail >= current_head ? capacity - (current_tail - current_head) - 1 : current_head - current_tail - 1;
  if (free_space < count) { yield S('push.full', T.ret, { fn: 'push', tag }); return EC.FULL; }
  yield S('push.copy', T.byte * count, { fn: 'push', copy: { to: 'q', from: current_tail, n: count, cap: capacity, src: off, srcN: src.n || 0 }, tag });
  for (let index = 0; index < count; ++index) {
    const d = (current_tail + index) % capacity, si = src.n ? (off + index) % src.n : off + index;
    q.buf[d] = src.buf[si];
    q.meta[d] = src.meta[si];
  }
  yield S('push.store', T.st, { fn: 'push', store: 'tail', order: 'release', ring: 'q', idx: (current_tail + count) % capacity, tag });
  q.tail_ = (current_tail + count) % capacity;
  return EC.OK;
}
// PopBatchBytes: dst = {buf, meta, n} or null (discard)
export function* PopBatchBytes(q: SPSCQueue, dst: ByteDst | null, count: number, tag?: string): Gen<ErrorCode> {
  if (count === 0) return EC.OK;
  yield S('pop.head', T.ld, { fn: 'pop', load: 'head', order: 'relaxed', ring: 'q', idx: q.head_, tag });
  const current_head = q.head_;
  yield S('pop.tail', T.ld, { fn: 'pop', load: 'tail', order: 'acquire', ring: 'q', idx: q.tail_, tag });
  const current_tail = q.tail_;
  const capacity = q.RingCapacity();
  yield S('pop.avail', T.ar, { fn: 'pop', tag });
  const available = current_tail >= current_head ? current_tail - current_head : capacity - current_head + current_tail;
  if (available < count) { yield S('pop.empty', T.ret, { fn: 'pop', tag }); return EC.EMPTY; }
  if (dst) {
    yield S('pop.copy', T.byte * count, { fn: 'pop', copy: { to: 'dst', from: current_head, n: count, cap: capacity }, tag });
    for (let index = 0; index < count; ++index) {
      const s = (current_head + index) % capacity;
      dst.buf[index] = q.buf[s];
      dst.meta[index] = q.meta[s];
    }
    dst.n = count;
  }
  yield S('pop.store', T.st, { fn: 'pop', store: 'head', order: 'release', ring: 'q', idx: (current_head + count) % capacity, tag });
  q.head_ = (current_head + count) % capacity;
  return EC.OK;
}
// run a kernel generator to completion without timing (tests, instant paths)
export function run<R>(gen: Gen<R>): R {
  let r = gen.next();
  while (!r.done) {
    if (r.value && (r.value as BlockReq).block) throw new Error('run(): generator blocked');
    r = gen.next();
  }
  return r.value;
}

// ---------------------------------------------------------------- Semaphore (FreeRTOS binary / counting, one waiter)
export class Semaphore {
  count: number;
  waiter: Ctx | null = null;
  sim: Sim | null = null;
  constructor(n = 0) { this.count = n; }
  PostFromCallback(in_isr: boolean): void {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      if (this.sim) this.sim.wake(w, EC.OK, in_isr);
    } else this.count++;
  }
}
// Wait: returns OK at once when a token is there, otherwise blocks the calling thread (timeout in microseconds)
export function* SemWait(sem: Semaphore, timeout?: number): Gen<ErrorCode> {
  yield S('sem.take', T.wait, { fn: 'sem' });
  if (sem.count > 0) { sem.count--; return EC.OK; }
  return yield { block: sem, timeout: timeout === undefined ? Infinity : timeout };
}

// ---------------------------------------------------------------- ReadPort (read_port.hpp / read_port.cpp)
export const PH = { IDLE: 0, CLAIMED: 1, PENDING: 2, CLAIMED_WITH_WAITER: 3, BLOCK_CLAIMED: 4 } as const;
export const PHN = ['IDLE', 'CLAIMED', 'PENDING', 'CLAIMED_WITH_WAITER', 'BLOCK_CLAIMED'];
export const EVENT_BIT = 0x80000000, PHASE_MASK = 0x7fffffff;
export const GetPhase = (s: number): number => (s & PHASE_MASK) >>> 0;
const WithPhase = (s: number, ph: number): number => (((s & EVENT_BIT) >>> 0) | ph) >>> 0;
const HasEvent = (s: number): boolean => ((s & EVENT_BIT) >>> 0) !== 0;

export type ReadOp = { type: 'BLOCK' | 'CALLBACK' | 'POLLING' | 'NONE'; sem?: Semaphore; timeout?: number; cb?: (in_isr: boolean, code: ErrorCode) => void; status?: string };
export type ReadData = { dst: ByteDst; size: number };

export class ReadPort {
  queue_data_: SPSCQueue | null;
  state_: number = PH.IDLE;
  info_: { data: ReadData; op: ReadOp } | null = null;
  block_result_: ErrorCode = EC.OK;
  onSpace: ((in_isr: boolean) => void) | null = null;
  constructor(buffer_size: number) { this.queue_data_ = buffer_size ? new SPSCQueue(buffer_size) : null; }
  Readable(): boolean { return this.queue_data_ !== null; }
  Capacity(): number { return this.queue_data_ ? this.queue_data_.MaxSize() : 0; }
  Size(): number { return this.queue_data_ ? this.queue_data_.Size() : 0; }
  EmptySize(): number { return this.queue_data_ ? this.queue_data_.EmptySize() : 0; }
  HasEnough(available: number, requested: number): boolean { return requested === 0 ? available !== 0 : available >= requested; }
  OnReadQueueSpaceAvailable(in_isr: boolean): void { if (this.onSpace) this.onSpace(in_isr); }
  GetReadQueue(in_isr: boolean): ReadQueue { return new ReadQueue(this, in_isr); }
}
// ReadPort::ReadQueue: short-lived producer scope, one Publish
export class ReadQueue {
  port_: ReadPort;
  in_isr_: boolean;
  dirty_ = false;
  finished_ = false;
  constructor(port: ReadPort, in_isr: boolean) { this.port_ = port; this.in_isr_ = in_isr; }
  EmptySize(): number { return this.port_.queue_data_!.EmptySize(); }
  Capacity(): number { return this.port_.queue_data_!.MaxSize(); }
  *PushBatch(src: ByteSrc, off: number, size: number, tag?: string): Gen<ErrorCode> {
    const r = yield* PushBatchBytes(this.port_.queue_data_!, src, off, size, tag);
    if (r === EC.OK && size !== 0) this.dirty_ = true;
    return r;
  }
  *Publish(): Gen<void> {
    yield S('rq.pub', T.call, { fn: 'rx' });
    this.finished_ = true;
    if (this.dirty_) yield* PublishProduced(this.port_, this.in_isr_);
  }
}
function* TryClaimIdle(p: ReadPort): Gen<boolean> {
  for (;;) {
    yield S('rp.ld', T.ld, { fn: 'pend', ph: p.state_ });
    const observed = p.state_;
    if (GetPhase(observed) !== PH.IDLE) return false;
    yield S('rp.claimidle', T.cas, { fn: 'pend', ph: p.state_ });
    if (p.state_ === observed) { p.state_ = PH.CLAIMED; return true; }
  }
}
function* ReleaseClaimed(p: ReadPort): Gen<void> {
  for (;;) {
    const observed = p.state_;
    yield S('rp.release', T.cas, { fn: 'pend', ph: p.state_ });
    if (p.state_ === observed) { p.state_ = WithPhase(observed, PH.IDLE); return; }
  }
}
function* ClaimBlockCompletion(p: ReadPort): Gen<boolean> {
  for (;;) {
    const observed = p.state_, phase = GetPhase(observed);
    if (phase === PH.BLOCK_CLAIMED) return true;
    if (phase !== PH.CLAIMED && phase !== PH.CLAIMED_WITH_WAITER) return false;
    yield S('cb.claim', T.cas, { fn: 'pend', ph: p.state_ });
    if (p.state_ === observed) { p.state_ = WithPhase(observed, PH.BLOCK_CLAIMED); return true; }
  }
}
function* ReleaseBlockCompletion(p: ReadPort): Gen<void> {
  for (;;) {
    const observed = p.state_;
    yield S('rp.relblock', T.cas, { fn: 'pend', ph: p.state_ });
    if (p.state_ === observed) { p.state_ = WithPhase(observed, PH.IDLE); return; }
  }
}
export function* PublishProduced(p: ReadPort, in_isr: boolean): Gen<void> {
  yield S('rp.event', T.cas, { fn: 'pend', ph: p.state_ });
  p.state_ = (p.state_ | EVENT_BIT) >>> 0;
  yield* ProcessPendingReads(p, in_isr);
}
export function* ProcessPendingReads(p: ReadPort, in_isr: boolean): Gen<void> {
  for (;;) {
    yield S('pp.load', T.ld, { fn: 'pend', ph: p.state_ });
    const observed = p.state_;
    if (GetPhase(observed) !== PH.PENDING) { yield S('pp.none', T.ret, { fn: 'pend', ph: p.state_ }); return; }
    yield S('pp.claim', T.cas, { fn: 'pend', ph: p.state_ });
    if (p.state_ !== observed) continue;                     // compare_exchange_weak failed
    p.state_ = PH.CLAIMED;
    const info = p.info_!;
    yield S('pp.enough', T.ld * 2 + T.ar, { fn: 'pend', need: info.data.size, have: p.queue_data_!.Size() });
    if (!p.HasEnough(p.queue_data_!.Size(), info.data.size)) {
      let again = false;
      for (;;) {
        const current = p.state_, current_phase = GetPhase(current);
        if (current_phase === PH.CLAIMED_WITH_WAITER) {
          yield S('pp.handoff', T.cas, { fn: 'pend', ph: p.state_ });
          if (p.state_ !== current) continue;
          p.state_ = WithPhase(current, PH.IDLE);
          yield S('pp.post', in_isr ? T.postIsr : T.post, { fn: 'pend', post: true });
          info.op.sem!.PostFromCallback(in_isr);
          return;
        }
        yield S('pp.back', T.cas, { fn: 'pend', ph: p.state_ });
        if (p.state_ !== current) continue;
        const desired = WithPhase(current, PH.PENDING);
        p.state_ = desired;
        if (HasEvent(desired)) { again = true; break; }
        return;
      }
      if (again) continue;
    }
    if (info.op.type === 'BLOCK') yield* CompleteClaimedBlock(p, in_isr);
    else yield* CompleteClaimedRead(p, in_isr);
    return;
  }
}
function* CompleteClaimedRead(p: ReadPort, in_isr: boolean): Gen<void> {
  const completed = p.info_!;
  if (completed.data.size !== 0) yield* PopBatchBytes(p.queue_data_!, completed.data.dst, completed.data.size, 'read');
  yield* ReleaseClaimed(p);
  if (completed.data.size !== 0) p.OnReadQueueSpaceAvailable(in_isr);
  UpdateStatus(completed.op, in_isr, EC.OK);
}
function* CompleteClaimedBlock(p: ReadPort, in_isr: boolean): Gen<void> {
  const completed = p.info_!;
  yield* ClaimBlockCompletion(p);
  if (completed.data.size !== 0) {
    yield* PopBatchBytes(p.queue_data_!, completed.data.dst, completed.data.size, 'read');
    yield S('cb.space', T.call, { fn: 'pend' });
    p.OnReadQueueSpaceAvailable(in_isr);
  }
  p.block_result_ = EC.OK;
  yield S('cb.post', in_isr ? T.postIsr : T.post, { fn: 'pend', post: true });
  completed.op.sem!.PostFromCallback(in_isr);
}
function UpdateStatus(op: ReadOp, in_isr: boolean, code: ErrorCode): void {
  if (op.type === 'CALLBACK' && op.cb) op.cb(in_isr, code);
  else if (op.type === 'POLLING') op.status = code === EC.OK ? 'DONE' : code;
}
// operator()(RawData data, ReadOperation& op, bool in_isr)
export function* ReadPortRead(p: ReadPort, data: ReadData, op: ReadOp, in_isr: boolean): Gen<ErrorCode> {
  if (!p.Readable()) return EC.NOT_SUPPORT;
  if (!(yield* TryClaimIdle(p))) { yield S('rp.busy', T.ret, { fn: 'pend' }); return EC.BUSY; }
  const is_block = op.type === 'BLOCK';
  if (data.size !== 0 && data.size > p.Capacity()) { yield* ReleaseClaimed(p); yield S('rp.sizeerr', T.ret, { fn: 'pend' }); return EC.SIZE_ERR; }
  yield S('rp.enough', T.ld * 2 + T.ar, { fn: 'pend', need: data.size, have: p.queue_data_!.Size() });
  if (p.HasEnough(p.queue_data_!.Size(), data.size)) {
    if (data.size !== 0) yield* PopBatchBytes(p.queue_data_!, data.dst, data.size, 'read');
    yield* ReleaseClaimed(p);
    if (data.size !== 0) p.OnReadQueueSpaceAvailable(in_isr);
    if (op.type !== 'BLOCK') UpdateStatus(op, in_isr, EC.OK);
    return EC.OK;
  }
  p.info_ = { data, op };
  if (op.type === 'POLLING') op.status = 'RUNNING';
  for (;;) {
    yield S('rp.ld2', T.ld, { fn: 'pend', ph: p.state_ });
    const observed = p.state_;
    if (HasEvent(observed)) {
      yield S('rp.clrev', T.cas, { fn: 'pend', ph: p.state_ });
      if (p.state_ !== observed) continue;
      p.state_ = PH.CLAIMED;
      if (p.HasEnough(p.queue_data_!.Size(), data.size)) {
        if (p.info_.op.type === 'BLOCK') { yield* CompleteClaimedBlock(p, in_isr); return yield* WaitForBlock(p, op); }
        yield* CompleteClaimedRead(p, in_isr);
        return EC.OK;
      }
      continue;
    }
    yield S('rp.pend', T.cas, { fn: 'pend', ph: p.state_ });
    if (p.state_ === observed) { p.state_ = PH.PENDING; break; }
  }
  return is_block ? yield* WaitForBlock(p, op) : EC.OK;
}
export function* WaitForBlock(p: ReadPort, op: ReadOp): Gen<ErrorCode> {
  let wait_result = yield* SemWait(op.sem!, op.timeout);
  if (wait_result === EC.OK) { const result = p.block_result_; yield* ReleaseBlockCompletion(p); return result; }
  for (;;) {
    const observed = p.state_, phase = GetPhase(observed);
    if (phase === PH.PENDING) {
      yield S('wb.cancel', T.cas, { fn: 'pend', ph: p.state_ });
      if (p.state_ !== observed) continue;
      p.state_ = WithPhase(observed, PH.IDLE);
      return EC.TIMEOUT;
    }
    if (phase === PH.CLAIMED) {
      yield S('wb.waiter', T.cas, { fn: 'pend', ph: p.state_ });
      if (p.state_ !== observed) continue;
      p.state_ = WithPhase(observed, PH.CLAIMED_WITH_WAITER);
      break;
    }
    break;
  }
  do { wait_result = yield* SemWait(op.sem!, Infinity); } while (wait_result === EC.TIMEOUT);
  if (GetPhase(p.state_) === PH.IDLE) return EC.TIMEOUT;
  const result = p.block_result_;
  yield* ReleaseBlockCompletion(p);
  return result;
}
export function* ClearQueuedData(p: ReadPort, in_isr: boolean): Gen<ErrorCode> {
  if (!p.Readable()) return EC.NOT_SUPPORT;
  if (!(yield* TryClaimIdle(p))) return EC.BUSY;
  yield S('rp.reset', T.ld + T.st, { fn: 'pend' });
  p.queue_data_!.Reset();
  yield* ReleaseClaimed(p);
  p.OnReadQueueSpaceAvailable(in_isr);
  return EC.OK;
}

// ---------------------------------------------------------------- SerializedService (serialized_service.hpp)
export const OWNER_BIT = 0x80000000, EVENT_MASK = 0x7fffffff;
export const TX_EVENT = { WRITE: 1 << 0, DONE: 1 << 1, CONFIG: 1 << 2, RX_WORK: 1 << 3, ABORT: 1 << 4, ERROR: 1 << 5, START_RX: 1 << 6 };
export class SerializedService {
  state_ = 0;
  Publish(events: number): void { if (events) this.state_ = (this.state_ | events) >>> 0; }
}
type Handler = (events: number, in_isr: boolean) => Gen<void>;
export function* Invoke(svc: SerializedService, events: number, in_isr: boolean, handler: Handler): Gen<boolean> {
  yield S('svc.or', T.cas, { fn: 'svc', word: svc.state_, ev: events });
  let observed = (svc.state_ | events) >>> 0;
  svc.state_ = observed;
  while (((observed & OWNER_BIT) >>> 0) === 0) {
    yield S('svc.cas', T.cas, { fn: 'svc', word: svc.state_ });
    if (svc.state_ === observed) { svc.state_ = OWNER_BIT; return yield* Drain(svc, handler, in_isr, (observed & EVENT_MASK) >>> 0); }
    observed = svc.state_;
  }
  yield S('svc.busy', T.ret, { fn: 'svc', word: svc.state_, deferred: true });
  return false;
}
export function* Drain(svc: SerializedService, handler: Handler, in_isr: boolean, snapshot: number): Gen<boolean> {
  let invoked = false;
  for (;;) {
    if (snapshot !== 0) { invoked = true; yield* handler(snapshot, in_isr); }
    yield S('svc.rel', T.cas, { fn: 'svc', word: svc.state_ });
    if (svc.state_ === OWNER_BIT) { svc.state_ = 0; return invoked; }
    yield S('svc.xchg', T.cas, { fn: 'svc', word: svc.state_, drain: true });
    snapshot = (svc.state_ & EVENT_MASK) >>> 0;
    svc.state_ = OWNER_BIT;
  }
}

// ---------------------------------------------------------------- STM32UART receive path (stm32_uart.cpp)
export type Dma = { buf: Uint8Array; meta: Int32Array; n: number; ring: 'dma'; pos: number; remaining: () => number };
export type LastSpan = { from: number; first: number; second: number; accepted: number; spans: number };
export type UartCtx = {
  dma: Dma; last_rx_pos_: number; port: ReadPort; svc: SerializedService; lastSpan: LastSpan | null;
  fillUs?: () => number; onDrop?: (n: number, from: number, to: number) => void;
};
export function* HandleRxData(u: UartCtx, in_isr: boolean): Gen<void> {
  const dma_size = u.dma.n;
  yield S('rx.cnt', T.mmio, { fn: 'rx', mmio: 'CNDTR', dma: u.dma.pos });
  const remaining = u.dma.remaining();                      // __HAL_DMA_GET_COUNTER(hdmarx): live, the DMA keeps going
  const curr_pos = remaining === 0 ? dma_size : dma_size - remaining;
  yield S('rx.last', T.ld, { fn: 'rx', last: u.last_rx_pos_, curr: curr_pos });
  const last_pos = u.last_rx_pos_;
  yield S('rx.cmp', T.ar, { fn: 'rx', last: last_pos, curr: curr_pos });
  if (curr_pos === last_pos) return;                        // nothing new (the second entry after HT / TC)
  const first_size = curr_pos > last_pos ? curr_pos - last_pos : dma_size - last_pos;
  const second_size = curr_pos > last_pos ? 0 : curr_pos;
  const queue = u.port.GetReadQueue(in_isr);
  yield S('rx.acc', T.call + T.ld * 2, { fn: 'rx', first: first_size, second: second_size, empty: queue.EmptySize() });
  let accepted = Math.min(first_size + second_size, queue.EmptySize());
  const total = accepted;
  u.lastSpan = { from: last_pos, first: first_size, second: second_size, accepted, spans: 0 };
  if (accepted !== 0) {
    const first_accepted = Math.min(first_size, accepted);
    if (first_accepted !== 0) { u.lastSpan.spans++; yield* queue.PushBatch(u.dma, last_pos, first_accepted, 'span1'); accepted -= first_accepted; }
    if (accepted !== 0) { u.lastSpan.spans++; yield* queue.PushBatch(u.dma, 0, accepted, 'span2'); }
  }
  if (first_size + second_size > total && u.onDrop) u.onDrop(first_size + second_size - total, last_pos, curr_pos);
  yield S('rx.setlast', T.st, { fn: 'rx', last: curr_pos === dma_size ? 0 : curr_pos });
  u.last_rx_pos_ = curr_pos === dma_size ? 0 : curr_pos;
  yield* queue.Publish();
}
export function* HandleTxService(u: UartCtx, events: number, in_isr: boolean): Gen<void> {
  if ((events & TX_EVENT.RX_WORK) !== 0) yield* HandleRxData(u, in_isr);
  if ((events & (TX_EVENT.WRITE | TX_EVENT.DONE)) !== 0) yield S('tx.fill', u.fillUs ? u.fillUs() : T.fill, { fn: 'svc', fill: true });   // FillTx: DoubleBuffer
}
export function* RxEventIRQHandler(u: UartCtx, in_isr: boolean): Gen<boolean> {
  return yield* Invoke(u.svc, TX_EVENT.RX_WORK, in_isr, (ev, isr) => HandleTxService(u, ev, isr));
}

// ============================================================================ 2. simulator: line, DMA, NVIC, CPU, threads
// Modes of the perf-uart loopback (docs/perf/perf-uart.md): back-to-back packets at 115200, one IDLE per packet at 2 M and 4 M.
// scale: microseconds of simulation per second on screen (1:250, 1:5000, 1:10000).
export type Mode = { baud: number; P: number; gap: number; scale: number };
export const MODES: Mode[] = [
  { baud: 115200, P: 32, gap: 0, scale: 4000 },
  { baud: 2e6, P: 32, gap: 1.3333, scale: 200 },
  { baud: 4e6, P: 128, gap: 2.64, scale: 100 },
];
export const DMA_N = 128;

type HeapEntry = [number, number, (() => void) | null, string];
// a tiny binary heap of timed events [t, seq, fn, tag]
export class Heap {
  a: HeapEntry[] = [];
  seq = 0;
  static lt(x: HeapEntry, y: HeapEntry): boolean { return x[0] < y[0] || (x[0] === y[0] && x[1] < y[1]); }
  push(t: number, fn: () => void, tag: string): HeapEntry {
    const a = this.a, e: HeapEntry = [t, this.seq++, fn, tag];
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (Heap.lt(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break;
    }
    return e;
  }
  peek(): HeapEntry | undefined { return this.a[0]; }
  pop(): HeapEntry {
    const a = this.a, top = a[0], last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && Heap.lt(a[l], a[m])) m = l;
        if (r < a.length && Heap.lt(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
  get size(): number { return this.a.length; }
}

export type CtxKind = 'thread' | 'isr';
export class Ctx {
  sim: Sim; name: string; kind: CtxKind; prio: number; gen: Gen<any>;
  step: (Step & { left: number; t0: number }) | null = null;
  state: 'ready' | 'running' | 'blocked' | 'done' = 'ready';
  resume: any = undefined;
  o: { row?: number; kind?: string; src?: string; label?: string };
  label: string; src: string | null;
  timeoutEv: HeapEntry | null = null;
  blockedOn: Semaphore | null = null;
  needSwitch = false;
  line = ''; seq = 0; started = false; kind2 = ''; pendT = 0;
  wokeAt = 0; wokeIsr = false;
  constructor(sim: Sim, name: string, kind: CtxKind, prio: number, gen: Gen<any>, o?: Ctx['o']) {
    this.sim = sim; this.name = name; this.kind = kind; this.prio = prio; this.gen = gen;
    this.o = o || {}; this.label = this.o.label || name; this.src = this.o.src || null;
  }
}

export type LineByte = { t0: number; v: number; m: number; noise: boolean; glitch: number | null };
export type Block = { a: number; b: number; row: 1 | 2; label: string; kind: string; ctx: Ctx };
export type Mark = { t: number; kind: 'irq' | 'drop' | 'err'; text: string; n?: number };
export type Drop = { t: number; n: number; from: number; to: number };
export type Flight = { t0: number; t1: number; kind: 'push' | 'pop'; from: number; n: number; cap: number; src?: number; tag?: string; ctx: string; pids: number[] };
export type PktRec = { pid: number; t0: number; n: number; P: number };
export type Counters = {
  read: number; error: number; dropped: number; sent: number; bytes: number; isr: number;
  irqs: Record<string, number>; lastDropT: number;
};
export type ReaderState = { state: 'start' | 'read' | 'crc' | 'away'; crc: 'ok' | 'bad' | null; crcT: number; pid: number; since: number; slip: boolean };

export class Sim {
  modeIdx: number; M: Mode; byteUs: number; gapBytes: number; P: number; t = 0; heap = new Heap(); cap: number;
  dma: Dma; u: UartCtx; q: SPSCQueue;
  c: Counters = { read: 0, error: 0, dropped: 0, sent: 0, bytes: 0, isr: 0, irqs: { IDLE: 0, HT: 0, TC: 0, SW: 0 }, lastDropT: -1e9 };
  pid = 0; counter = 0; lineFree = 0; lastByteEnd = -1e9; nextStart = 0;
  bytes: LineByte[] = [];                                // recent bytes on the line
  blocks: Block[] = [];                                  // lanes: busy intervals of ISRs (row 1) and threads (row 2)
  marks: Mark[] = [];                                    // interrupt requests and events, for the lanes
  drops: Drop[] = [];                                    // recent overruns of the queue
  flights: Flight[] = [];                                // copies in progress or just done, for the pictures
  pkts = new Map<number, PktRec>();                      // pid -> record of a packet on the line
  isrQ: Ctx[] = []; threads: Ctx[] = [];
  running: Ctx | null = null;
  noiseNext = false; holdSvc = false;
  away = false;                                          // the read thread is busy elsewhere: it does not call Read
  rxMasked = false;                                      // RX interrupts held off (PRIMASK / BASEPRI): requests stay pending
  maskedBytes = 0;                                       // bytes the DMA wrote while the mask was set (reset when it is released)
  maskAuto = false;                                      // the mask was released by the DMA ring running full
  maskSpans: { a: number; b: number | null }[] = [];     // when the mask was set and released, for the lanes
  readSize: number;
  readerBuf: ByteDst;
  reader: ReaderState = { state: 'start', crc: null, crcT: -1e9, pid: -1, since: 0, slip: false };
  readLog: [number, number, number, boolean][] = [];     // [since, t, pid, ok]
  readSem: Semaphore; gate: Semaphore; wsem: Semaphore;
  rt: Ctx; wt: Ctx;
  lastPush: Flight | null = null;

  constructor(opt?: { mode?: number; gap?: number; cap?: number }) {
    opt = opt || {};
    this.modeIdx = opt.mode === undefined ? 1 : opt.mode;
    const M = (this.M = MODES[this.modeIdx]);
    this.byteUs = 10e6 / M.baud;                         // 8N1: 10 bit times
    this.gapBytes = opt.gap === undefined ? M.gap : opt.gap;
    this.P = M.P;
    this.cap = opt.cap || 128;
    // hardware: circular RX DMA (DMA1 channel 5), USART1 flags, the loopback line
    const dma: Dma = (this.dma = { buf: new Uint8Array(DMA_N), meta: new Int32Array(DMA_N).fill(-1), n: DMA_N, ring: 'dma', pos: 0, remaining: () => DMA_N - dma.pos });
    this.u = { dma, last_rx_pos_: 0, port: new ReadPort(this.cap), svc: new SerializedService(), lastSpan: null, fillUs: () => this.fillUs() };
    this.u.onDrop = (n, from, to) => this.onDrop(n, from, to);
    this.q = this.u.port.queue_data_!;
    this.readSize = this.P;
    this.readerBuf = { buf: new Uint8Array(128), meta: new Int32Array(128).fill(-1), n: 0 };
    this.readSem = new Semaphore(0); this.readSem.sim = this;
    this.gate = new Semaphore(0); this.gate.sim = this;
    this.wsem = new Semaphore(0); this.wsem.sim = this;
    // threads (FreeRTOS priorities as in perf-uart: read 4, write 3)
    this.rt = this.spawn('read', 'thread', 4, ReadThread(this), { row: 2, kind: 'read' });
    this.wt = this.spawn('write', 'thread', 3, WriteThread(this), { row: 2, kind: 'write' });
    this.scheduleNextPacket();
  }
  // ---------------------------------------------------------------- contexts
  spawn(name: string, kind: CtxKind, prio: number, gen: Gen<any>, o?: Ctx['o']): Ctx {
    const c = new Ctx(this, name, kind, prio, gen, o);
    if (kind === 'thread') this.threads.push(c); else this.isrQ.push(c);
    return c;
  }
  wake(ctx: Ctx, value: any, in_isr: boolean): void {
    if (ctx.state !== 'blocked') return;
    ctx.state = 'ready'; ctx.resume = value;
    if (ctx.timeoutEv) { ctx.timeoutEv[2] = null; ctx.timeoutEv = null; }
    ctx.wokeAt = this.t; ctx.wokeIsr = !!in_isr; ctx.needSwitch = ctx.kind === 'thread';
  }
  pick(): Ctx | null {
    let best: Ctx | null = null;
    for (const c of this.isrQ) {
      if (c.state === 'done') continue;
      if (this.rxMasked && c.kind2 === 'rx' && !c.started) continue;   // pending in the NVIC, not taken
      if (!best || c.prio > best.prio || (c.prio === best.prio && c.seq < best.seq)) best = c;
    }
    if (best) return best;
    for (const c of this.threads) if (c.state === 'ready' || c.state === 'running') if (!best || c.prio > best.prio) best = c;
    return best;
  }
  // an interrupt request: NVIC keeps one pending bit per line (a second request before the handler runs is merged)
  irq(line: string, src: string, prio: number, genFn: () => Gen<any>): Ctx {
    const pend = this.isrQ.find((c) => c.line === line && !c.started);
    if (pend) { if (!(pend.src || '').split('+').includes(src)) { pend.src += '+' + src; pend.label = pend.src ?? ''; } return pend; }
    const c = this.spawn(src, 'isr', prio, genFn(), { row: 1, src });
    c.line = line; c.seq = this.heap.seq++; c.pendT = this.t; c.started = false;
    return c;
  }
  rxIrq(src: string): Ctx {
    const c = this.irq(src === 'IDLE' || src === 'SW' ? 'usart1' : 'dma1ch5', src, 5, () => RxIsr(this));
    c.kind2 = 'rx';
    this.c.irqs[src] = (this.c.irqs[src] || 0) + 1;
    this.marks.push({ t: this.t, kind: 'irq', text: src });
    return c;
  }
  // ---------------------------------------------------------------- the line: perf-uart packets and noise
  // write_buffer[i] = i; each packet: write_buffer[0]++, last byte = CRC8 of the others (perf-uart.md)
  makePacket(): { pid: number; bytes: Uint8Array } {
    const P = this.P, b = new Uint8Array(P);
    this.counter = (this.counter + 1) & 0xff;
    for (let i = 0; i < P; i++) b[i] = i & 0xff;
    b[0] = this.counter;
    b[P - 1] = CRC8.Calculate(b, P - 1);
    return { pid: ++this.pid, bytes: b };
  }
  scheduleNextPacket(): void {
    const bu = this.byteUs;
    const t0 = Math.max(this.lineFree, this.t);
    const pk = this.makePacket();
    const bytes = pk.bytes;
    this.pkts.set(pk.pid, { pid: pk.pid, t0, n: bytes.length, P: this.P });
    if (this.pkts.size > 64) this.pkts.delete(this.pkts.keys().next().value as number);
    for (let j = 0; j < bytes.length; j++) {
      let v = bytes[j];
      const st = t0 + j * bu, m = pk.pid * 512 + j;
      let noise = false;
      if (this.noiseNext && st >= this.t && j >= Math.min(11, bytes.length - 1)) { this.noiseNext = false; v ^= 0x08; noise = true; }
      const rb: LineByte = { t0: st, v, m, noise, glitch: noise ? st + (bu * (1 + 3 + 0.35)) / 10 : null };
      this.bytes.push(rb);
      this.heap.push(st + bu - bu * 0.05, () => this.rxByte(rb), 'byte');
    }
    const end = t0 + bytes.length * bu;
    this.c.sent++;
    this.lineFree = end + this.gapBytes * bu;
    this.heap.push(end, () => this.txDone(), 'txdone');
    // keep one packet ahead so the IDLE check knows when the next start bit comes
    this.heap.push(Math.max(this.t, end - bu * 2), () => this.scheduleNextPacket(), 'next');
    this.nextStart = this.lineFree;
  }
  // bytes the DMA has written but HandleRxData has not yet copied (last_rx_pos_ .. DMA cursor)
  rxPending(): number { return (this.dma.pos - this.u.last_rx_pos_ + DMA_N) % DMA_N; }
  rxByte(rb: LineByte): void {
    const d = this.dma, i = d.pos;
    d.buf[i] = rb.v; d.meta[i] = rb.m;
    d.pos = (i + 1) % DMA_N;
    this.c.bytes++;
    if (d.pos === DMA_N / 2) this.rxIrq('HT');
    else if (d.pos === 0) this.rxIrq('TC');
    // USART IDLE: a whole frame of idle line after this byte, unless the next start bit comes first
    const tEnd = rb.t0 + this.byteUs;
    this.lastByteEnd = tEnd;
    const nxt = this.nextByteStartAfter(rb.t0);
    if (nxt === null || nxt >= tEnd + this.byteUs - 1e-9) this.heap.push(tEnd + this.byteUs, () => { if (this.lastByteEnd === tEnd) this.rxIrq('IDLE'); }, 'idle');
    // held off for long enough that the DMA ring is about to lap the unread bytes: the mask is dropped here
    if (this.rxMasked) {
      this.maskedBytes++;
      if (this.rxPending() >= DMA_N - 4) { this.rxMasked = false; this.maskAuto = true; this.closeMask(); }
    }
  }
  nextByteStartAfter(t0: number): number | null {
    for (let i = this.bytes.length - 1; i >= 0; i--) {
      const b = this.bytes[i];
      if (b.t0 <= t0 + 1e-9) { const n = this.bytes[i + 1]; return n ? n.t0 : this.lineFree > t0 ? this.lineFree : null; }
    }
    return null;
  }
  txDone(): void {
    // DMA1 channel 4 transfer complete: TX DMA done -> the write thread's BLOCK Write finishes
    const c = this.irq('dma1ch4', 'TX', 5, () => TxIsr(this));
    c.kind2 = 'tx';
  }
  onDrop(n: number, from: number, to: number): void {
    this.c.dropped += n; this.c.lastDropT = this.t;
    this.drops.push({ t: this.t, n, from, to });
    if (this.drops.length > 16) this.drops.shift();
    this.marks.push({ t: this.t, kind: 'drop', text: 'drop', n });
  }
  fillUs(): number { return this.holdSvc ? Math.max(150, this.P * this.byteUs * 1.15) : T.fill; }
  // ---------------------------------------------------------------- run
  // advance(us): run the CPU and the hardware events for `us` microseconds of simulated time
  advance(us: number): void {
    const tEnd = this.t + us;
    let guard = 0;
    while (this.t < tEnd - 1e-9) {
      if (++guard > 400000) { console.warn('sim guard'); break; }
      const nx = this.heap.peek();
      const ctx = this.pick();
      if (ctx !== this.running) this.switchTo(ctx);
      if (ctx && !ctx.step) {
        // a thread woken from a block pays the context switch (PendSV + scheduler) before its code continues
        if (ctx.needSwitch) { ctx.needSwitch = false; ctx.step = { id: 'os.switch', us: T.sw, left: T.sw, info: { fn: 'os' }, t0: this.t }; continue; }
        this.fetch(ctx);
        continue;
      }
      const limit = Math.min(tEnd, nx ? nx[0] : Infinity);
      if (ctx) {
        const step = ctx.step!;
        const run = Math.min(step.left, limit - this.t);
        if (run > 0) { this.busy(ctx, this.t, this.t + run); step.left -= run; this.t += run; }
        if (step.left <= 1e-9) { ctx.step = null; this.fetch(ctx); }
      } else this.t = limit;
      while (this.heap.size && this.heap.peek()![0] <= this.t + 1e-9) {
        const e = this.heap.pop();
        if (e[2]) e[2]();
      }
    }
    this.trim();
  }
  // run the generator to its next step (the effect of the finished step happens here)
  fetch(ctx: Ctx): void {
    if (ctx.state === 'done') return;
    let r: IteratorResult<Yielded, any>;
    try { r = ctx.gen.next(ctx.resume); } catch (e) { console.error('sim ' + ctx.name, e); ctx.state = 'done'; this.dropCtx(ctx); return; }
    ctx.resume = undefined;
    if (r.done) { ctx.state = 'done'; ctx.step = null; this.dropCtx(ctx); return; }
    const v = r.value;
    if ((v as BlockReq).block) {
      const b = v as BlockReq, sem = b.block;
      if (sem.count > 0) { sem.count--; ctx.resume = EC.OK; return; }
      sem.waiter = ctx; ctx.state = 'blocked'; ctx.blockedOn = sem;
      if (isFinite(b.timeout)) {
        ctx.timeoutEv = this.heap.push(this.t + b.timeout, () => {
          if (sem.waiter === ctx) { sem.waiter = null; this.wake(ctx, EC.TIMEOUT, false); }
          ctx.timeoutEv = null;
        }, 'timeout');
      }
      return;
    }
    const s = v as Step;
    ctx.step = { id: s.id, us: s.us, left: s.us, info: s.info, t0: this.t };
    if (s.info && s.info.copy) this.noteCopy(ctx, s);
  }
  // a copy is about to run: remember it for the pictures (cells filling, cells being handed over)
  noteCopy(ctx: Ctx, v: Step): void {
    const cp = v.info!.copy;
    const f: Flight = { t0: this.t, t1: this.t + v.us, kind: cp.to === 'q' ? 'push' : 'pop', from: cp.from, n: cp.n, cap: cp.cap, src: cp.src, tag: v.info!.tag, ctx: ctx.name, pids: [] };
    const ring = cp.to === 'q' ? this.dma : this.q;
    const base = cp.to === 'q' ? cp.src : cp.from, len = cp.to === 'q' ? DMA_N : cp.cap;
    for (let i = 0; i < cp.n; i++) {
      const m = ring.meta[(base + i) % len];
      const pid = m >= 0 ? Math.floor(m / 512) : -1;
      if (!f.pids.includes(pid)) f.pids.push(pid);
    }
    this.flights.push(f);
    if (this.flights.length > 48) this.flights.shift();
    if (f.kind === 'push') this.lastPush = f;
  }
  dropCtx(ctx: Ctx): void {
    if (ctx.kind === 'isr') { const i = this.isrQ.indexOf(ctx); if (i >= 0) this.isrQ.splice(i, 1); }
    if (this.running === ctx) this.running = null;
  }
  switchTo(ctx: Ctx | null): void {
    this.running = ctx;
    if (ctx) {
      if (ctx.kind === 'isr') ctx.started = true;
      if (ctx.state === 'ready') ctx.state = 'running';
    }
    for (const c of this.threads) if (c !== ctx && c.state === 'running') c.state = 'ready';
  }
  busy(ctx: Ctx, a: number, b: number): void {
    const L = this.blocks[this.blocks.length - 1];
    if (L && L.ctx === ctx && Math.abs(L.b - a) < 1e-6) { L.b = b; return; }
    const isr = ctx.kind === 'isr';
    this.blocks.push({ a, b, row: isr ? 1 : 2, label: isr ? ctx.label : ctx.o.kind === 'read' ? 'read' : 'write', kind: ctx.kind2 || ctx.o.kind || '', ctx });
  }
  trim(): void {
    const keep = this.t - Math.max(2500, 120 * this.byteUs);
    if (this.blocks.length > 3000 || (this.blocks.length && this.blocks[0].b < keep)) { let i = 0; while (i < this.blocks.length && this.blocks[i].b < keep) i++; this.blocks.splice(0, i); }
    if (this.bytes.length > 3000 || (this.bytes.length && this.bytes[0].t0 < keep)) { let i = 0; while (i < this.bytes.length - 2 && this.bytes[i].t0 < keep) i++; this.bytes.splice(0, i); }
    while (this.maskSpans.length && this.maskSpans[0].b !== null && (this.maskSpans[0].b as number) < keep) this.maskSpans.shift();
    if (this.marks.length && this.marks[0].t < keep) { let i = 0; while (i < this.marks.length && this.marks[i].t < keep) i++; this.marks.splice(0, i); }
    if (this.flights.length && this.flights[0].t1 < this.t - 2000 - 8 * this.M.scale) this.flights.shift();
  }
  // ---------------------------------------------------------------- user controls
  injectNoise(): void { this.noiseNext = true; }
  swIrq(): void { this.rxIrq('SW'); }
  // "reader waiting" off: the read thread is busy elsewhere and does not call Read; on: it blocks in Read (BLOCK)
  setAway(away: boolean): void {
    if (this.away === away) return;
    this.away = away;
    if (!away && this.gate.waiter) this.gate.PostFromCallback(false);
  }
  // hold-off of the RX interrupts (HT / TC / IDLE stay pending in the NVIC); releasing lets one handler copy the whole span
  setRxMask(on: boolean): void {
    if (on === this.rxMasked) return;
    this.rxMasked = on;
    if (on) { this.maskedBytes = 0; this.maskAuto = false; this.maskSpans.push({ a: this.t, b: null }); } else this.closeMask();
  }
  closeMask(): void {
    const m = this.maskSpans[this.maskSpans.length - 1];
    if (m && m.b === null) m.b = this.t;
  }
  // ---------------------------------------------------------------- readouts
  // packets per second of the line: one packet of P bytes plus the idle gap of the mode
  linePps(): number { return 1e6 / ((this.P + this.gapBytes) * this.byteUs); }
  // share of the last `window` finished packets that the read thread has received intact
  intactRatio(window = 8): number {
    const lineUs = this.P * this.byteUs;
    const done: PktRec[] = [];
    for (const p of this.pkts.values()) if (p.t0 + p.n * this.byteUs < this.t - lineUs * 2) done.push(p);
    const last = done.slice(-window);
    if (last.length < Math.min(window, 4)) return 1;
    const ok = new Set<number>();
    for (const r of this.readLog) if (r[3]) ok.add(r[2]);
    let n = 0;
    for (const p of last) if (ok.has(p.pid)) n++;
    return n / last.length;
  }
  // packets per second as the read thread sees them
  readPps(): number { return Math.round(this.linePps() * this.intactRatio()); }
}

// ---------------------------------------------------------------- interrupt handlers and threads
function* RxIsr(sim: Sim): Gen<void> {
  // USART1_IRQHandler (IDLE) or DMA1_Channel5_IRQHandler (HT / TC) -> HAL -> HAL_UARTEx_RxEventCallback -> RxEventIRQHandler
  yield S('isr.hal', T.isrIn, { fn: 'svc' });
  sim.c.isr++;
  yield* RxEventIRQHandler(sim.u, true);
  yield S('isr.exit', T.isrOut, { fn: 'svc' });
}
function* TxIsr(sim: Sim): Gen<void> {
  yield S('isr.tx', T.txIsr, { fn: 'svc' });
  sim.wsem.PostFromCallback(true);
}
// the perf-uart read thread: Read 32 B (BLOCK), CRC8 check, count. After a failed check it re-aligns by reading one byte at a time
// and sliding its window until the packet pattern and the CRC match again (so a corrupted byte costs one packet, and bytes lost to
// an overrun do not leave the stream misaligned). `away`: the thread is busy with other work and does not call Read at all.
function* ReadThread(sim: Sim): Gen<void> {
  const op: ReadOp = { type: 'BLOCK', sem: sim.readSem, timeout: Infinity };
  const R = sim.reader, one: ByteDst = { buf: new Uint8Array(1), meta: new Int32Array(1).fill(-1), n: 0 };
  for (;;) {
    if (sim.away) { R.state = 'away'; yield { block: sim.gate, timeout: Infinity }; continue; }
    const need = R.slip ? 1 : sim.readSize;
    R.state = 'read'; R.since = sim.t;
    const dst = R.slip ? one : sim.readerBuf;
    const r = yield* ReadPortRead(sim.u.port, { dst, size: need }, op, false);
    if (r !== EC.OK) continue;
    const w = sim.readerBuf, P = sim.readSize;
    if (R.slip) {
      w.buf.copyWithin(0, 1, P); w.meta.copyWithin(0, 1, P);
      w.buf[P - 1] = one.buf[0]; w.meta[P - 1] = one.meta[0];
      yield S('rt.slide', T.ar * 3, { fn: 'reader' });
      if (!(w.buf[1] === 1 && w.buf[2] === 2 && w.buf[3] === 3)) continue;
    }
    R.state = 'crc'; R.pid = w.meta[0] >= 0 ? Math.floor(w.meta[0] / 512) : -1;
    yield S('rt.crc', T.crc * P, { fn: 'reader' });
    const ok = P === sim.P && CRC8.Verify(w.buf, P);
    if (ok) { R.crc = 'ok'; R.crcT = sim.t; R.slip = false; sim.c.read++; }
    else if (!R.slip) { R.crc = 'bad'; R.crcT = sim.t; R.slip = true; sim.c.error++; sim.marks.push({ t: sim.t, kind: 'err', text: 'crc' }); }
    if (ok || !R.slip || R.crcT === sim.t) { sim.readLog.push([R.since, sim.t, R.pid, ok]); if (sim.readLog.length > 64) sim.readLog.shift(); }
    yield S('rt.loop', T.call, { fn: 'reader' });
  }
}
function* WriteThread(sim: Sim): Gen<void> {
  for (;;) {
    yield { block: sim.wsem, timeout: Infinity };
    yield S('wt.crc', T.wwork, { fn: 'writer' });               // write_buffer[0]++; CRC8::Calculate(31 B)
    yield* Invoke(sim.u.svc, TX_EVENT.WRITE, false, (ev, isr) => HandleTxService(sim.u, ev, isr));
  }
}
