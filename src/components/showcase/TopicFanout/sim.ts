/* TopicFanout simulation: no DOM, runs in node (sim.test.mjs).
   Part 1 ports LibXR master 4e96701 src/middleware/message/ (taken over from the earlier showcase beat 3-6, without its chip
   scheduler):
     lockfree_list.cpp   Add: CAS the new node in at head_.next_; Foreach from head_.next_ to the sentinel (newest first)
     topic.hpp/.cpp      PublishTyped: Lock (CAS busy UNLOCKED -> LOCKED), DispatchSubscribers, Unlock
     publish.cpp         DispatchSubscriber: SYNC     CAS wait_state WAITING -> WAIT_CLAIMED, only then copy + sem.Post()
                                             ASYNC    copy only when state == WAITING, then DATA_READY
                                             QUEUE    SPSCQueueBase::PushBytes, a full queue loses this publish
                                             CALLBACK Run(..., payload_addr): the publisher's own object, no copy
     subscriber/sync.hpp  Wait: CAS WAIT_IDLE -> WAITING (else BUSY); async.hpp Available / GetData / StartWaiting
     spsc_queue_base.hpp  PushBytes / PopBytes, ring of capacity + 1
   Part 2 ports system/linux/linux_shared_topic_impl.hpp (taken over from beat 4-3): CreateData -> PopFreeSlot (FIFO free
   queue), PublishData (BROADCAST_FULL / BROADCAST_DROP_OLD; refcount = number of receivers, one Descriptor {slot, sequence}
   per receiver), QueueHasSpace (tail + 1 != head, a ring of queue_num stores queue_num - 1), TryPopDescriptor, Release ->
   ReleaseSlot (fetch_sub, the last one recycles the slot).
   Time in both worlds is screen time (seconds): the order of the steps is the source's, their spacing is stretched so the
   steps can be followed. Nothing here claims a duration. */

// ============================================================================ common
export const EC = { OK: 0, FULL: 1, EMPTY: 2, BUSY: 3, STATE_ERR: 4 } as const;
export type ErrorCode = (typeof EC)[keyof typeof EC];
export const SIZES = [12, 1024] as const;
export const DESC_BYTES = 16; // sizeof(Descriptor): u32 slot_index + u32 reserved + u64 sequence

export type Payload = { bytes: number; seq: number; v: number; addr: number };
let ADDR = 0;
export function makePayload(bytes: number): Payload {
  ADDR += 1;
  return { bytes, seq: 0, v: 0, addr: 0x20000400 + ADDR * 0x40 };
}
// CopyPayload<Data>: *dst = *src, the destination keeps its address
export function CopyPayload(dst: Payload, src: Payload): void { dst.seq = src.seq; dst.v = src.v; dst.bytes = src.bytes; }
// a value derived from the sequence number, shown as the content of the payload
export const valueOf = (seq: number): number => (Math.imul(seq + 7, 2654435761) >>> 0) & 0xffff;

// ============================================================================ part 1: in-process Topic
export const ST = { SYNC: 'SYNC', ASYNC: 'ASYNC', QUEUE: 'QUEUE', CALLBACK: 'CALLBACK' } as const;
export type SuberType = (typeof ST)[keyof typeof ST];
export const WS = { WAIT_IDLE: 0, WAITING: 1, WAIT_CLAIMED: 2 } as const;
export const WSN = ['WAIT_IDLE', 'WAITING', 'WAIT_CLAIMED'];
export const AS = { IDLE: 0, WAITING: 1, DATA_READY: 0xffffffff } as const;
export const ASN = (s: number): string => (s === AS.DATA_READY ? 'DATA_READY' : s === AS.WAITING ? 'WAITING' : 'IDLE');
export const LS = { UNLOCKED: 0, LOCKED: 1 } as const;

export type Node = {
  type: SuberType; id: Lane; next_: Node | null;
  // SYNC
  buff_addr?: Payload; wait_state?: number; sem?: number; timestamp?: number;
  // ASYNC (buff_addr, timestamp as above)
  state?: number;
  // QUEUE
  queue?: SPSCQueue;
  // CALLBACK
  fun?: (inIsr: boolean, ts: number, data: Payload) => void;
};
export type Lane = 'callback' | 'sync' | 'async' | 'queue';

export class LockFreeList {
  head_: Node;
  constructor() {
    this.head_ = { type: ST.CALLBACK, id: 'callback', next_: null };
    this.head_.next_ = this.head_;
  }
  // do { current_head = head_.next_; data.next_ = current_head; } while (!CAS(head_.next_, current_head, &data))
  Add(data: Node): void {
    let current = this.head_.next_;
    data.next_ = current;
    while (this.head_.next_ !== current) { current = this.head_.next_; data.next_ = current; }
    this.head_.next_ = data;
  }
  Size(): number { let n = 0; for (let p = this.head_.next_!; p !== this.head_; p = p.next_!) n += 1; return n; }
  nodes(): Node[] { const a: Node[] = []; for (let p = this.head_.next_!; p !== this.head_; p = p.next_!) a.push(p); return a; }
}

// SPSCQueue<Data>: one element per slot, ring of capacity + 1, tail + 1 == head means full
export class SPSCQueue {
  capacity_: number; slots: (Payload | null)[]; head_ = 0; tail_ = 0;
  constructor(capacity: number) { this.capacity_ = capacity; this.slots = new Array(capacity + 1).fill(null); }
  RingCapacity(): number { return this.capacity_ + 1; }
  Increment(i: number): number { return (i + 1) % this.RingCapacity(); }
  Size(): number { const h = this.head_, t = this.tail_; return t >= h ? t - h : this.RingCapacity() - h + t; }
  MaxSize(): number { return this.capacity_; }
  PushBytes(value: Payload): ErrorCode {
    const current_tail = this.tail_, next_tail = this.Increment(current_tail);
    if (next_tail === this.head_) return EC.FULL;
    const c = makePayload(value.bytes); CopyPayload(c, value);
    this.slots[current_tail] = c; this.tail_ = next_tail;
    return EC.OK;
  }
  PopBytes(out?: { value?: Payload | null }): ErrorCode {
    const current_head = this.head_;
    if (current_head === this.tail_) return EC.EMPTY;
    if (out) out.value = this.slots[current_head];
    this.slots[current_head] = null; this.head_ = this.Increment(current_head);
    return EC.OK;
  }
  items(): Payload[] { const a: Payload[] = []; for (let i = this.head_; i !== this.tail_; i = this.Increment(i)) a.push(this.slots[i]!); return a; }
}

export class Topic {
  name: string; payload_size: number; busy: number = LS.UNLOCKED; subers = new LockFreeList();
  constructor(name: string, payload_size: number) { this.name = name; this.payload_size = payload_size; }
}
export function SyncSubscriber(topic: Topic, data: Payload): Node {
  const b: Node = { type: ST.SYNC, id: 'sync', buff_addr: data, timestamp: 0, wait_state: WS.WAIT_IDLE, sem: 0, next_: null };
  topic.subers.Add(b); return b;
}
export function ASyncSubscriber(topic: Topic): Node {
  const b: Node = { type: ST.ASYNC, id: 'async', buff_addr: makePayload(topic.payload_size), timestamp: 0, state: AS.IDLE, next_: null };
  topic.subers.Add(b); return b;
}
export function QueuedSubscriber(topic: Topic, queue: SPSCQueue): Node {
  const b: Node = { type: ST.QUEUE, id: 'queue', queue, next_: null };
  topic.subers.Add(b); return b;
}
export function RegisterCallback(topic: Topic, fun: Node['fun']): Node {
  const b: Node = { type: ST.CALLBACK, id: 'callback', fun, next_: null };
  topic.subers.Add(b); return b;
}
// SyncSubscriber::Wait(), the part before the semaphore: a second pending Wait() gets BUSY
export function SyncWaitBegin(b: Node): ErrorCode {
  if (b.wait_state !== WS.WAIT_IDLE) return EC.BUSY;
  b.wait_state = WS.WAITING;
  return EC.OK;
}
// ... and after sem.Wait() returned OK
export function SyncWaitEnd(b: Node): void { b.sem = Math.max(0, (b.sem || 0) - 1); b.wait_state = WS.WAIT_IDLE; }
export const Available = (b: Node): boolean => b.state === AS.DATA_READY;
export function GetData(b: Node): Payload { if (b.state === AS.DATA_READY) b.state = AS.IDLE; return b.buff_addr!; }
export function StartWaiting(b: Node): void { if (b.state === AS.IDLE) b.state = AS.WAITING; }

export type Kind = 'copy' | 'miss' | 'ignore' | 'drop' | 'run';
export type Result = { kind: Kind; bytes: number; seq: number; t: number; state?: number };

export function DispatchSubscriber(block: Node, timestamp: number, payload: Payload, from_callback: boolean, in_isr: boolean): Result {
  const r = (kind: Kind, bytes = 0): Result => ({ kind, bytes, seq: payload.seq, t: 0 });
  switch (block.type) {
    case ST.SYNC: {
      const wake_waiter = block.wait_state === WS.WAITING; // CAS WAITING -> WAIT_CLAIMED
      if (!wake_waiter) return r('miss');
      block.wait_state = WS.WAIT_CLAIMED;
      CopyPayload(block.buff_addr!, payload);
      block.timestamp = timestamp;
      block.sem = (block.sem || 0) + 1; // sem.Post() / sem.PostFromCallback(in_isr)
      return r('copy', payload.bytes);
    }
    case ST.ASYNC: {
      if (block.state !== AS.WAITING) return { ...r('ignore'), state: block.state };
      CopyPayload(block.buff_addr!, payload);
      block.timestamp = timestamp;
      block.state = AS.DATA_READY;
      return r('copy', payload.bytes);
    }
    case ST.QUEUE: {
      const ans = block.queue!.PushBytes(payload);
      return ans === EC.OK ? r('copy', payload.bytes) : r('drop');
    }
    case ST.CALLBACK:
    default: {
      block.fun?.(from_callback && in_isr, timestamp, payload); // the publisher's object itself
      return r('run');
    }
  }
}
// Publish(data): PublishTyped(data, NowTimestamp(), false, false), all at once (tests; the widget steps it)
export function Publish(topic: Topic, data: Payload, timestamp = 0): { ec: ErrorCode; res: Result[] } {
  if (topic.busy !== LS.UNLOCKED) return { ec: EC.BUSY, res: [] }; // a second concurrent publisher: ASSERT in LibXR
  topic.busy = LS.LOCKED;
  const res: Result[] = [];
  for (const n of topic.subers.nodes()) res.push(DispatchSubscriber(n, timestamp, data, false, false));
  topic.busy = LS.UNLOCKED;
  return { ec: EC.OK, res };
}

// ---------------------------------------------------------------- the widget's world: one publisher, one of each subscriber
export const TP = {
  period: 2.5,     // automatic publish interval
  lock: 0.18,      // Lock + CheckPublishContract before the walk
  step: 0.34,      // one list node
  flight: 0.42,    // a copy travelling to its subscriber (drawn)
  syncWake: 0.16,  // sem.Wait() returns after the Post
  syncWork: 3.3,   // the sync thread works on what it got, then calls Wait() again
  asyncPoll: 3.1,  // the async consumer: if (Available()) GetData(); StartWaiting();
  queuePop: 4.2,   // the queue consumer pops one element
  queueCap: 4,
  maxPending: 4,
};
export type TopicEvent = { t: number; kind: 'flight' | 'read' | 'wake' | 'take' | 'pop' | 'raise' | 'wait'; lane: Lane; seq: number; bytes: number };

export class TopicSim {
  t = 0; bytes: number; topic: Topic; q: SPSCQueue; original: Payload; received: Payload;
  nS: Node; nA: Node; nQ: Node; nC: Node; order: Node[];
  seq = 0; pending = 0; auto = true; nextAuto: number;
  dispatch: { t0: number; seq: number; idx: number; copied: number; res: Partial<Record<Lane, Result>> } | null = null;
  last: { seq: number; copied: number; res: Partial<Record<Lane, Result>> } | null = null;
  lane: Partial<Record<Lane, Result>> = {};
  sync: { st: 'wait' | 'wake' | 'work'; until: number };
  asyncNext: number; queueNext: number; cbSeen = 0;
  taken: { async: Payload | null; queue: Payload | null } = { async: null, queue: null };
  events: TopicEvent[] = [];
  published = 0; copiedTotal = 0;

  constructor(bytes: number = SIZES[0]) {
    this.bytes = bytes;
    this.topic = new Topic(bytes > 64 ? 'adc_block' : 'imu_gyro', bytes);
    this.q = new SPSCQueue(TP.queueCap);
    this.original = makePayload(bytes);
    this.received = makePayload(bytes);
    // registration order queue, async, sync, callback: LockFreeList::Add puts each at the head, the walk runs newest first
    this.nQ = QueuedSubscriber(this.topic, this.q);
    this.nA = ASyncSubscriber(this.topic);
    this.nS = SyncSubscriber(this.topic, this.received);
    this.nC = RegisterCallback(this.topic, (_isr, _ts, d) => { this.cbSeen = d.seq; });
    this.order = this.topic.subers.nodes();
    SyncWaitBegin(this.nS);
    this.sync = { st: 'wait', until: Infinity };
    StartWaiting(this.nA);
    this.nextAuto = 0.4;
    this.asyncNext = 1.9;
    this.queueNext = 2.8;
  }

  request(): boolean { if (this.pending >= TP.maxPending) return false; this.pending += 1; return true; }
  // how far the current publish has walked: node index (fractional), -1 before the first node
  cursor(): number { const d = this.dispatch; return d ? (this.t - d.t0 - TP.lock) / TP.step : -1; }
  busy(): boolean { return !!this.dispatch || this.pending > 0; }

  private ev(e: Omit<TopicEvent, 't'>): void { this.events.push({ t: this.t, ...e }); if (this.events.length > 120) this.events.splice(0, 60); }

  private startPublish(): void {
    this.pending -= 1;
    this.seq += 1;
    this.original.seq = this.seq; this.original.v = valueOf(this.seq); // the publisher fills its own object
    this.topic.busy = LS.LOCKED;
    this.dispatch = { t0: this.t, seq: this.seq, idx: 0, copied: 0, res: {} };
  }
  private visit(): void {
    const d = this.dispatch!;
    const n = this.order[d.idx];
    const r = DispatchSubscriber(n, Math.round(this.t * 1e6), this.original, false, false);
    r.t = this.t;
    d.res[n.id] = r; this.lane[n.id] = r;
    d.copied += r.bytes; this.copiedTotal += r.bytes;
    if (r.kind === 'copy') this.ev({ kind: 'flight', lane: n.id, seq: r.seq, bytes: r.bytes });
    if (r.kind === 'run') this.ev({ kind: 'read', lane: n.id, seq: r.seq, bytes: 0 });
    if (n === this.nS && r.kind === 'copy') this.sync = { st: 'wake', until: this.t + TP.syncWake };
    d.idx += 1;
  }
  private finish(): void {
    const d = this.dispatch!;
    this.topic.busy = LS.UNLOCKED;
    this.last = { seq: d.seq, copied: d.copied, res: d.res };
    this.published += 1;
    this.dispatch = null;
  }
  private nextDispatchAt(): number {
    const d = this.dispatch;
    if (!d) return Infinity;
    return d.idx < this.order.length ? d.t0 + TP.lock + d.idx * TP.step : d.t0 + TP.lock + d.idx * TP.step;
  }

  advance(dt: number): void {
    const end = this.t + dt;
    for (let guard = 0; guard < 400; guard += 1) {
      let tn = Infinity, what = '';
      const cand = (t: number, w: string): void => { if (t < tn) { tn = t; what = w; } };
      if (this.dispatch) cand(this.nextDispatchAt(), this.dispatch.idx < this.order.length ? 'visit' : 'finish');
      else if (this.pending > 0) cand(this.t, 'start');
      if (this.auto) cand(this.nextAuto, 'auto');
      if (this.sync.st !== 'wait') cand(this.sync.until, 'sync');
      cand(this.asyncNext, 'async');
      cand(this.queueNext, 'queue');
      if (tn > end) break;
      this.t = Math.max(this.t, tn);
      switch (what) {
        case 'start': this.startPublish(); break;
        case 'visit': this.visit(); break;
        case 'finish': this.finish(); break;
        case 'auto': this.nextAuto = this.t + TP.period; if (this.pending === 0) this.request(); break;
        case 'sync':
          if (this.sync.st === 'wake') { SyncWaitEnd(this.nS); this.sync = { st: 'work', until: this.t + TP.syncWork }; this.ev({ kind: 'wake', lane: 'sync', seq: this.received.seq, bytes: 0 }); }
          else { SyncWaitBegin(this.nS); this.sync = { st: 'wait', until: Infinity }; this.ev({ kind: 'wait', lane: 'sync', seq: 0, bytes: 0 }); }
          break;
        case 'async': {
          this.asyncNext = this.t + TP.asyncPoll;
          if (Available(this.nA)) { const p = GetData(this.nA); this.taken.async = { ...p }; this.ev({ kind: 'take', lane: 'async', seq: p.seq, bytes: 0 }); }
          const was = this.nA.state;
          StartWaiting(this.nA);
          if (was !== this.nA.state) this.ev({ kind: 'raise', lane: 'async', seq: 0, bytes: 0 });
          break;
        }
        case 'queue': {
          this.queueNext = this.t + TP.queuePop;
          const out: { value?: Payload | null } = {};
          if (this.q.PopBytes(out) === EC.OK && out.value) { this.taken.queue = out.value; this.ev({ kind: 'pop', lane: 'queue', seq: out.value.seq, bytes: 0 }); }
          break;
        }
        default: break;
      }
    }
    this.t = end;
  }
  // run until the current and all requested publishes are done (reduced motion: one press, one finished publish)
  settle(): void { for (let i = 0; i < 200 && this.busy(); i += 1) this.advance(0.1); }
}

// a still worth looking at: the last publish reached all four (three copies, the callback read the original)
export function warmTopic(bytes: number): TopicSim {
  const s = new TopicSim(bytes);
  s.advance(0.5);
  for (let i = 0; i < 400; i += 1) {
    s.advance(0.05);
    const L = s.last;
    if (s.published >= 4 && L && !s.dispatch && s.t - (s.last ? lastT(L) : 0) > 0.7
      && L.res.sync?.kind === 'copy' && L.res.async?.kind === 'copy' && L.res.queue?.kind === 'copy' && s.q.Size() >= 2) break;
  }
  return s;
}
function lastT(L: { res: Partial<Record<Lane, Result>> }): number { return Math.max(...Object.values(L.res).map((r) => r!.t)); }

// ============================================================================ part 2: LinuxSharedTopic
export const MODE = { BROADCAST_FULL: 0, BROADCAST_DROP_OLD: 1 } as const;
export const MODEN = ['BROADCAST_FULL', 'BROADCAST_DROP_OLD'];
export type Slot = { refcount: number; sequence: number; st: 0 | 1 | 2; bytes: number }; // st: 0 free, 1 being written, 2 published
export type Desc = { slot_index: number; sequence: number };
export type Sub = {
  i: number; mode: number; active: boolean; ring: (Desc | null)[]; head: number; tail: number;
  held: number; heldSeq: number; st: 'wait' | 'wake' | 'read'; until: number; dropped: number; got: number; work: number;
};
export const SP = {
  period: 2.5,     // automatic publish interval
  write: 0.55,     // the publisher fills the slot in place (CreateData, then GetData() and write)
  wake: 0.5,       // futex wake to TryPopDescriptor
  work: [0.85, 1.35, 4.2], // each subscriber's time between Wait() and Release()
  slots: 8, queue: 4, subs: 3, maxPending: 4,
};
export type SharedEvent = { t: number; kind: 'create' | 'push' | 'read' | 'release' | 'recycle' | 'drop' | 'fail' | 'noslot'; k: number; i: number; seq: number };

export class SharedSim {
  t = 0; bytes: number; slots: Slot[] = []; free: number[] = []; subs: Sub[] = [];
  next_sequence = 0; publish_failures = 0; noslot = 0; pending = 0; auto = true; nextAuto = 0.3;
  writing: { k: number; t1: number } | null = null;
  lastPub: { k: number; seq: number; to: number[]; t: number } | null = null;
  events: SharedEvent[] = [];
  published = 0;

  constructor(bytes: number = SIZES[0]) {
    this.bytes = bytes;
    for (let k = 0; k < SP.slots; k += 1) { this.slots.push({ refcount: 0, sequence: 0, st: 0, bytes }); this.free.push(k); }
    const modes = [MODE.BROADCAST_FULL, MODE.BROADCAST_FULL, MODE.BROADCAST_DROP_OLD];
    for (let i = 0; i < SP.subs; i += 1) {
      this.subs.push({ i, mode: modes[i], active: true, ring: new Array(SP.queue).fill(null), head: 0, tail: 0, held: -1, heldSeq: 0, st: 'wait', until: Infinity, dropped: 0, got: 0, work: SP.work[i] });
    }
  }
  private ev(e: Omit<SharedEvent, 't'>): void { this.events.push({ t: this.t, ...e }); if (this.events.length > 200) this.events.splice(0, 100); }

  request(): boolean { if (this.pending >= SP.maxPending) return false; this.pending += 1; return true; }
  busy(): boolean { return !!this.writing || this.pending > 0 || this.subs.some((s) => s.st === 'wake'); }

  // ---- free queue and refcount
  PopFreeSlot(): number { return this.free.length ? this.free.shift()! : -1; }
  RecycleSlot(k: number): void { const s = this.slots[k]; s.sequence = 0; s.st = 0; s.refcount = 0; this.free.push(k); this.ev({ kind: 'recycle', k, i: -1, seq: 0 }); }
  ReleaseSlot(k: number): void { const s = this.slots[k]; const prev = s.refcount; s.refcount = Math.max(0, prev - 1); if (prev === 1) this.RecycleSlot(k); }
  // ---- descriptor rings
  QueueHasSpace(u: Sub): boolean { return (u.tail + 1) % SP.queue !== u.head; }
  pendingOf(u: Sub): number { return (u.tail - u.head + SP.queue) % SP.queue; }
  queued(u: Sub): Desc[] { const a: Desc[] = []; for (let j = u.head; j !== u.tail; j = (j + 1) % SP.queue) a.push(u.ring[j]!); return a; }
  PushDescriptor(u: Sub, d: Desc): void {
    u.ring[u.tail] = d; u.tail = (u.tail + 1) % SP.queue;
    this.ev({ kind: 'push', k: d.slot_index, i: u.i, seq: d.sequence });
    if (u.st === 'wait') { u.st = 'wake'; u.until = this.t + SP.wake; } // PostReady: futex wake
  }
  TryPopDescriptor(u: Sub): Desc | null {
    if (u.head === u.tail) return null;
    const d = u.ring[u.head]!; u.ring[u.head] = null; u.head = (u.head + 1) % SP.queue; return d;
  }
  DropDescriptor(u: Sub): ErrorCode {
    const d = this.TryPopDescriptor(u);
    if (!d) return EC.EMPTY;
    u.dropped += 1;
    this.ev({ kind: 'drop', k: d.slot_index, i: u.i, seq: d.sequence });
    this.ReleaseSlot(d.slot_index);
    return EC.OK;
  }

  // CreateData: a free slot for the publisher to fill in place (no Scavenge here: every subscriber process stays alive)
  CreateData(): number {
    const k = this.PopFreeSlot();
    if (k < 0) { this.noslot += 1; this.ev({ kind: 'noslot', k: -1, i: -1, seq: 0 }); return -1; }
    const s = this.slots[k]; s.refcount = 0; s.sequence = 0; s.st = 1; s.bytes = this.bytes;
    this.ev({ kind: 'create', k, i: -1, seq: 0 });
    return k;
  }
  PublishData(k: number): ErrorCode {
    let active_count = 0;
    for (const u of this.subs) {
      if (!u.active) continue;
      if (!this.QueueHasSpace(u)) {
        if (u.mode === MODE.BROADCAST_DROP_OLD) {
          const ans = this.DropDescriptor(u);
          if (ans !== EC.OK && !this.QueueHasSpace(u)) { this.publish_failures += 1; this.RecycleSlot(k); this.ev({ kind: 'fail', k, i: u.i, seq: 0 }); return EC.FULL; }
        } else {
          u.dropped += 1; this.publish_failures += 1; this.RecycleSlot(k); // data.Reset(): the slot goes back
          this.ev({ kind: 'fail', k, i: u.i, seq: 0 });
          return EC.FULL;
        }
      }
      active_count += 1;
    }
    if (active_count === 0) { this.RecycleSlot(k); return EC.OK; }
    this.next_sequence += 1;
    const sequence = this.next_sequence, slot = this.slots[k];
    slot.refcount = active_count; slot.sequence = sequence; slot.st = 2;
    const to: number[] = [];
    for (const u of this.subs) if (u.active) { this.PushDescriptor(u, { slot_index: k, sequence }); to.push(u.i); }
    this.lastPub = { k, seq: sequence, to, t: this.t };
    this.published += 1;
    return EC.OK;
  }
  // Subscriber::Wait() (pop a descriptor, hold its slot) and Release()
  private subWait(u: Sub): void {
    const d = this.TryPopDescriptor(u);
    if (!d) { u.st = 'wait'; u.until = Infinity; return; }
    u.held = d.slot_index; u.heldSeq = d.sequence; u.got += 1; u.st = 'read'; u.until = this.t + u.work;
    this.ev({ kind: 'read', k: d.slot_index, i: u.i, seq: d.sequence });
  }
  Release(u: Sub): void {
    if (u.held < 0) return;
    const k = u.held; u.held = -1; u.heldSeq = 0;
    this.ev({ kind: 'release', k, i: u.i, seq: this.slots[k].sequence });
    this.ReleaseSlot(k);
  }

  advance(dt: number): void {
    const end = this.t + dt;
    for (let guard = 0; guard < 400; guard += 1) {
      let tn = Infinity, what = '', who: Sub | null = null;
      if (this.writing) { tn = this.writing.t1; what = 'publish'; }
      else if (this.pending > 0) { tn = this.t; what = 'create'; }
      if (this.auto && this.nextAuto < tn) { tn = this.nextAuto; what = 'auto'; }
      for (const u of this.subs) if (u.st !== 'wait' && u.until < tn) { tn = u.until; what = u.st; who = u; }
      if (tn > end) break;
      this.t = Math.max(this.t, tn);
      if (what === 'auto') { this.nextAuto = this.t + SP.period; if (this.pending === 0 && !this.writing) this.request(); }
      else if (what === 'create') { this.pending -= 1; const k = this.CreateData(); if (k >= 0) this.writing = { k, t1: this.t + SP.write }; }
      else if (what === 'publish') { const k = this.writing!.k; this.writing = null; this.PublishData(k); }
      else if (what === 'wake' && who) this.subWait(who);
      else if (what === 'read' && who) { this.Release(who); this.subWait(who); }
    }
    this.t = end;
  }
  settle(): void { for (let i = 0; i < 200 && (this.writing || this.pending > 0); i += 1) this.advance(0.1); this.advance(SP.wake + 0.05); }

  // who references slot k now: holders (reading) and rings (queued)
  refsOf(k: number): { reading: number[]; queued: number[] } {
    const reading: number[] = [], queued: number[] = [];
    for (const u of this.subs) {
      if (u.held === k) reading.push(u.i);
      if (this.queued(u).some((d) => d.slot_index === k)) queued.push(u.i);
    }
    return { reading, queued };
  }
}

// a still worth looking at: one slot read by several subscribers at once, the slow one holding an older slot with a queue behind it
export function warmShared(bytes: number): SharedSim {
  const s = new SharedSim(bytes);
  s.advance(0.2);
  for (let i = 0; i < 600; i += 1) {
    s.advance(0.05);
    const p = s.lastPub;
    if (s.published >= 4 && p && !s.writing && s.t - p.t > 0.45 && s.t - p.t < 0.6) {
      const r = s.refsOf(p.k);
      if (r.reading.length >= 2 && s.pendingOf(s.subs[2]) >= 1) break;
    }
  }
  return s;
}

// ============================================================================ self-playing: which view is on, and when it changes
// Automatic publishes come from TopicSim / SharedSim (`auto`, `period`); the tour below decides how many publishes a view gets
// before the page switches to the next one. The order changes one choice at a time: in-process 12 B, shared memory 12 B,
// shared memory 1 KB, in-process 1 KB, and around again.
export type TourView = { mode: 'topic' | 'shared'; size: 0 | 1 };
export const TOUR_VIEWS: ReadonlyArray<TourView> = [
  { mode: 'topic', size: 0 }, { mode: 'shared', size: 0 }, { mode: 'shared', size: 1 }, { mode: 'topic', size: 1 },
];
/** publishes a view shows before the next one: the shared view needs a few more for the slots to be taken and given back */
export const TOUR_ROUNDS = { topic: 3, shared: 4 } as const;

export class ViewTour {
  idx = 0;
  private base = 0;
  /** the view on screen is `v` and its simulation has published `published` so far (also after a manual choice) */
  sync(v: TourView, published: number): void {
    const i = TOUR_VIEWS.findIndex((x) => x.mode === v.mode && x.size === v.size);
    if (i >= 0) this.idx = i;
    this.base = published;
  }
  current(): TourView { return TOUR_VIEWS[this.idx]; }
  /** called with the on-screen simulation's published count; returns the next view when the current one has had its rounds */
  update(published: number): TourView | null {
    const v = this.current();
    if (published - this.base < TOUR_ROUNDS[v.mode]) return null;
    this.idx = (this.idx + 1) % TOUR_VIEWS.length;
    return this.current();
  }
}
