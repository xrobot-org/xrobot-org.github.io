// RingBuffer simulation kernel (sim.ts) under node 24+ (type stripping). The first block mirrors LibXR's own automatic tests
// (test/automatic/structure/queue/spsc_queue, test/automatic/core/rw/read_port); the rest checks the simulated STM32UART receive
// path against docs/perf/perf-uart.md and the behaviours the widget relies on (reader away, held-off RX interrupt, overrun).
//   node --test src/components/showcase/RingBuffer/sim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './sim.ts';

const { EC, run } = K;
const bytes = (arr) => ({ buf: Uint8Array.from(arr), meta: Int32Array.from(arr.map((_, i) => i)), n: 0 });
const sink = (n) => ({ buf: new Uint8Array(n), meta: new Int32Array(n), n: 0 });

test('SPSC: capacity 1 holds one byte (ring of 2, one slot always free)', () => {
  const q = new K.SPSCQueue(1);
  assert.equal(q.RingCapacity(), 2);
  assert.equal(q.PushBytes(11), EC.OK);
  assert.equal(q.PushBytes(22), EC.FULL);
  const o = {};
  assert.equal(q.PopBytes(o), EC.OK);
  assert.equal(o.v, 11);
  assert.equal(q.PopBytes(o), EC.EMPTY);
  assert.equal(run(K.PushBatchBytes(q, bytes([33]), 0, 1)), EC.OK);
  const d = sink(1);
  assert.equal(run(K.PopBatchBytes(q, d, 1)), EC.OK);
  assert.equal(d.buf[0], 33);
});

test('SPSC: push [1..5] into capacity 5, pop 2, push [6,7] wraps; FULL leaves the queue untouched; Reset empties', () => {
  const q = new K.SPSCQueue(5);
  assert.equal(run(K.PushBatchBytes(q, bytes([1, 2, 3, 4, 5]), 0, 5)), EC.OK);
  assert.equal(q.tail_, 5);
  assert.equal(q.Size(), 5);
  assert.equal(q.EmptySize(), 0);
  assert.equal(run(K.PushBatchBytes(q, bytes([9]), 0, 1)), EC.FULL);
  assert.equal(q.tail_, 5);
  const d = sink(5);
  assert.equal(run(K.PopBatchBytes(q, d, 2)), EC.OK);
  assert.deepEqual([...d.buf.slice(0, 2)], [1, 2]);
  assert.equal(run(K.PushBatchBytes(q, bytes([6, 7]), 0, 2)), EC.OK);
  assert.equal(q.tail_, 1);                        // (5 + 2) % 6: wrapped past the ring end
  assert.equal(run(K.PopBatchBytes(q, d, 5)), EC.OK);
  assert.deepEqual([...d.buf], [3, 4, 5, 6, 7]);
  assert.equal(run(K.PushBatchBytes(q, bytes([8, 9]), 0, 2)), EC.OK);
  q.Reset();
  assert.equal(q.Size(), 0);
  assert.equal(q.head_, q.tail_);
});

test('SPSC: ProduceWithWriter / ConsumeWithReader offer two spans across the ring end', () => {
  const q = new K.SPSCQueue(4);
  q.head_ = q.tail_ = 3;
  let spans = null;
  assert.equal(q.ProduceWithWriter(4, (a, na, b, nb) => { spans = [a, na, b, nb]; return na + nb; }), 4);
  assert.deepEqual(spans, [3, 2, 0, 2]);
  assert.equal(q.ConsumeWithReader(3, (a, na, b, nb) => { spans = [a, na, b, nb]; return 3; }), 3);
  assert.deepEqual(spans, [3, 2, 0, 1]);
  assert.equal(q.Size(), 1);
});

test('SPSC: tail is the write cursor, head the read cursor; tail + 1 == head is full, head == tail is empty', () => {
  const q = new K.SPSCQueue(4);
  assert.equal(q.head_, q.tail_);
  assert.equal(run(K.PushBatchBytes(q, bytes([1, 2, 3, 4]), 0, 4)), EC.OK);
  assert.equal((q.tail_ + 1) % q.RingCapacity(), q.head_);
  assert.equal(q.Size(), 4);
  assert.equal(q.EmptySize(), 0);
  assert.equal(run(K.PopBatchBytes(q, null, 4)), EC.OK);
  assert.equal(q.head_, q.tail_);
});

test('CRC8 (poly 0x8C reflected, init 0xFF) verifies a perf-uart packet', () => {
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = i;
  b[0] = 1;
  b[31] = K.CRC8.Calculate(b, 31);
  assert.equal(K.CRC8.Verify(b, 32), true);
  b[5] ^= 0x08;
  assert.equal(K.CRC8.Verify(b, 32), false);
});

// a tiny driver for kernel generators that may block on semaphores (single thread + "ISR" code run inline)
function drive(gen) {
  let r = gen.next(), blocked = null;
  while (!r.done) {
    if (r.value && r.value.block) { blocked = r.value; break; }
    r = gen.next();
  }
  return { r, blocked, gen };
}

test('ReadPort: not enough data -> PENDING; Publish in ISR completes the BLOCK read and posts', () => {
  const p = new K.ReadPort(128), sem = new K.Semaphore(0), dst = sink(32);
  const read = drive(K.ReadPortRead(p, { dst, size: 32 }, { type: 'BLOCK', sem, timeout: Infinity }, false));
  assert.ok(read.blocked, 'thread waits on its semaphore');
  assert.equal(K.PHN[K.GetPhase(p.state_)], 'PENDING');
  const rq = p.GetReadQueue(true);
  const src = bytes([...Array(32).keys()]);
  run(rq.PushBatch(src, 0, 32));
  run(rq.Publish());
  assert.equal(p.queue_data_.Size(), 0, 'copied on to the waiting reader in the same interrupt');
  assert.equal(sem.count, 1, 'PostFromCallback');
  assert.equal(K.PHN[K.GetPhase(p.state_)], 'BLOCK_CLAIMED');
  sem.count = 0;
  let r = read.gen.next(EC.OK);
  while (!r.done) r = read.gen.next();
  assert.equal(r.value, EC.OK);
  assert.equal(K.PHN[K.GetPhase(p.state_)], 'IDLE');
  assert.deepEqual([...dst.buf.slice(0, 4)], [0, 1, 2, 3]);
});

test('ReadPort: timeout while PENDING cancels (TIMEOUT), bytes stay queued; SIZE_ERR above capacity', () => {
  const p = new K.ReadPort(16), sem = new K.Semaphore(0), dst = sink(16);
  const rd = drive(K.ReadPortRead(p, { dst, size: 8 }, { type: 'BLOCK', sem, timeout: 10 }, false));
  run(p.GetReadQueue(true).PushBatch(bytes([1, 2, 3]), 0, 3));      // 3 bytes, no Publish yet
  let r = rd.gen.next(EC.TIMEOUT);
  while (!r.done) r = rd.gen.next();
  assert.equal(r.value, EC.TIMEOUT);
  assert.equal(p.queue_data_.Size(), 3);
  assert.equal(K.PHN[K.GetPhase(p.state_)], 'IDLE');
  assert.equal(run(K.ReadPortRead(p, { dst, size: 17 }, { type: 'BLOCK', sem, timeout: 1 }, false)), EC.SIZE_ERR);
});

test('ReadPort: timeout racing a claimed completion hands over through CLAIMED_WITH_WAITER', () => {
  const p = new K.ReadPort(16), sem = new K.Semaphore(0), dst = sink(16);
  const rd = drive(K.ReadPortRead(p, { dst, size: 8 }, { type: 'BLOCK', sem, timeout: 10 }, false));
  // the ISR claims the pending request (PENDING -> CLAIMED) but data is not enough yet: stop it right after the claim
  run(p.GetReadQueue(true).PushBatch(bytes([1, 2, 3]), 0, 3));
  const isr = K.ProcessPendingReads(p, true);
  let s = isr.next();
  while (!s.done && s.value.id !== 'pp.enough') s = isr.next();
  assert.equal(K.PHN[K.GetPhase(p.state_)], 'CLAIMED');
  // timeout fires now: the waiter marks CLAIMED_WITH_WAITER and waits for the hand-off
  let w = rd.gen.next(EC.TIMEOUT);
  while (!w.done && !(w.value && w.value.block)) w = rd.gen.next();
  assert.equal(K.PHN[K.GetPhase(p.state_)], 'CLAIMED_WITH_WAITER');
  // the ISR finds not enough data, sees the waiter, releases to IDLE and posts
  while (!s.done) s = isr.next();
  assert.equal(sem.count, 1);
  sem.count = 0;
  w = rd.gen.next(EC.OK);
  while (!w.done) w = rd.gen.next();
  assert.equal(w.value, EC.TIMEOUT);
  assert.equal(p.queue_data_.Size(), 3);
});

test('SerializedService: an interrupt while the owner runs only ORs RX_WORK; the owner drains it in thread context', () => {
  const svc = new K.SerializedService(), seen = [];
  const handler = function* (ev, isr) { seen.push([ev, isr]); if (ev & K.TX_EVENT.WRITE) { yield K.S('tx.fill', 5); } };
  const owner = K.Invoke(svc, K.TX_EVENT.WRITE, false, handler);
  let o = owner.next();
  while (o.value.id !== 'tx.fill') o = owner.next();
  assert.equal((svc.state_ & K.OWNER_BIT) >>> 0, K.OWNER_BIT);
  assert.equal(run(K.Invoke(svc, K.TX_EVENT.RX_WORK, true, handler)), false);
  assert.equal(svc.state_ >>> 0, (K.OWNER_BIT | K.TX_EVENT.RX_WORK) >>> 0);
  while (!o.done) o = owner.next();
  assert.deepEqual(seen, [[K.TX_EVENT.WRITE, false], [K.TX_EVENT.RX_WORK, false]]);
  assert.equal(svc.state_, 0);
});

test('perf-uart 2 Mbaud / 32 B: 6000 packets per second, 0 errors; every other packet ends on the HT / TC mark', () => {
  const s = new K.Sim({ mode: 1 });
  s.advance(20000);
  assert.equal(Math.round(s.linePps()), 6000);
  const pps = s.c.read / 0.02;
  assert.ok(pps > 5850 && pps <= 6000, 'read/s ' + pps);
  assert.equal(s.c.error, 0);
  assert.equal(s.c.dropped, 0);
  assert.equal(s.readPps(), 6000);
  assert.ok(Math.abs(s.c.irqs.HT + s.c.irqs.TC - s.c.sent / 2) <= 2, JSON.stringify(s.c.irqs) + ' sent ' + s.c.sent);
});

test('perf-uart 4 Mbaud / 128 B: about 3060 packets per second (3061..3063 in the table), 0 errors', () => {
  const s = new K.Sim({ mode: 2 });
  s.advance(60000);
  const pps = s.c.read / 0.06;
  assert.ok(pps > 2950 && pps <= 3065, 'read/s ' + pps);
  assert.ok(s.readPps() >= 3061 && s.readPps() <= 3063, 'readout ' + s.readPps());
  assert.equal(s.c.error, 0);
  assert.equal(s.c.dropped, 0);
});

// HT / TC handler (push 32 B + copy on to the waiting reader) outlasts the 1.33-byte idle gap, so the IDLE entry that follows an
// HT already sees the first bytes of the next packet. The empty return (curr_pos == last_pos) is what a second request right after
// a delivery gets (software-pended RX interrupt).
test("HandleRxData after a packet ending at 64: HT delivers it, the next entry sees the next packet's first bytes; an immediate second entry returns empty", () => {
  const s = new K.Sim({ mode: 1 });
  const ids = [];
  const orig = s.fetch.bind(s);
  s.fetch = (ctx) => { orig(ctx); if (ctx.step && ctx.step.id === 'rx.cmp') ids.push([ctx.label, ctx.step.info.last, ctx.step.info.curr]); };
  s.advance(700);
  const i = ids.findIndex((x) => x[0] === 'HT' && x[2] === 64);
  assert.ok(i >= 0 && ids[i + 1][0] === 'IDLE', JSON.stringify(ids));
  const n = ids[i + 1][2] - ids[i + 1][1];
  assert.ok(n > 0 && n <= 8, 'IDLE picked up ' + n + ' bytes of the next packet');
  // a software-pended RX interrupt right after an HT delivery at 115200 (86.8 us per byte): nothing new, return at once
  const s0 = new K.Sim({ mode: 0 }), ids0 = [];
  const o0 = s0.fetch.bind(s0);
  s0.fetch = (ctx) => { o0(ctx); if (ctx.step && ctx.step.id === 'rx.cmp') ids0.push([ctx.label, ctx.step.info.last, ctx.step.info.curr]); };
  while (!ids0.some((x) => x[0] === 'HT')) s0.advance(50);
  s0.advance(30);
  s0.swIrq();
  s0.advance(30);
  const sw = ids0.filter((x) => x[0] === 'SW');
  assert.ok(sw.length === 1 && sw[0][1] === sw[0][2], JSON.stringify(ids0));
});

test('115200 back-to-back: 360 packets per second, no IDLE at all, only HT / TC wake the reader', () => {
  const s = new K.Sim({ mode: 0 });
  s.advance(60000);
  assert.equal(Math.round(s.linePps()), 360);
  assert.equal(s.c.irqs.IDLE, 0);
  assert.ok(s.c.irqs.HT > 0 && s.c.irqs.TC > 0);
  assert.equal(s.c.error, 0);
  assert.equal(s.readPps(), 360);
});

test('noise corrupts one byte: CRC error +1, that packet is dropped, the next ones are fine', () => {
  const s = new K.Sim({ mode: 1 });
  s.advance(1000);
  const r0 = s.c.read;
  s.injectNoise();
  s.advance(2000);
  assert.equal(s.c.error, 1);
  assert.ok(s.c.read > r0 + 8);
});

test('write thread holding the service: the RX interrupt only sets RX_WORK; HandleRxData runs in the write thread', () => {
  const s = new K.Sim({ mode: 1 });
  s.holdSvc = true;
  let deferred = 0, threadRx = 0;
  const orig = s.fetch.bind(s);
  s.fetch = (ctx) => {
    orig(ctx);
    if (!ctx.step) return;
    if (ctx.step.id === 'svc.busy') deferred++;
    if (ctx.step.id === 'rx.cnt' && ctx.kind === 'thread') threadRx++;
  };
  s.advance(3000);
  assert.ok(deferred > 0 && threadRx > 0, deferred + ' ' + threadRx);
  assert.equal(s.c.error, 0);
});

// ---------------------------------------------------------------- what the widget drives
test('reader away: bytes pile up in the SPSC to 128 (tail + 1 == head), then HandleRxData drops the rest and counts it', () => {
  const s = new K.Sim({ mode: 1 });
  s.advance(1000);
  s.setAway(true);
  s.advance(4000);                                  // 800 bytes on the line
  assert.equal(s.q.Size(), 128);
  assert.equal((s.q.tail_ + 1) % s.q.RingCapacity(), s.q.head_);
  assert.ok(s.c.dropped > 0, 'dropped ' + s.c.dropped);
  assert.equal(s.c.dropped % 32, 0, 'whole 32 B packets are dropped (32 B packets, 128 B queue)');
  assert.equal(s.readPps(), 0, 'the reader receives nothing');
  // accounting: every byte the DMA wrote is still in the DMA ring, queued, dropped, or already taken by the reader (32 B per Read)
  const popped = s.c.bytes - s.rxPending() - s.q.Size() - s.c.dropped;
  assert.ok(popped - s.c.read * 32 === 0 || popped - s.c.read * 32 === 32, 'popped ' + popped + ' read ' + s.c.read);
  // back on: the queue drains packet by packet, no CRC error because whole packets were dropped
  s.setAway(false);
  s.advance(3000);
  assert.ok(s.q.Size() < 64);
  assert.equal(s.c.error, 0);
  assert.equal(s.readPps(), 6000);
});

test('reader away with a queue that is not a multiple of the packet: a mid-packet drop costs one CRC error, then the reader re-aligns', () => {
  const s = new K.Sim({ mode: 1, cap: 100 });
  s.advance(500);
  s.setAway(true);
  s.advance(3000);
  assert.equal(s.q.Size(), 100);
  assert.ok(s.c.dropped > 0 && s.c.dropped % 32 !== 0, 'a partial packet was accepted, the rest dropped: ' + s.c.dropped);
  s.setAway(false);
  s.advance(6000);
  assert.equal(s.c.error, 1);
  const r1 = s.c.read;
  s.advance(3000);
  assert.ok(s.c.read > r1 + 10, 'packets are received again');
  assert.equal(s.c.error, 1);
});

// run until no handler is executing and the queue is empty (a handler that has started is not interrupted by the mask)
function settle(s) {
  let guard = 0;
  s.advance(40);
  while ((s.running !== null || s.q.Size() !== 0) && guard++ < 400) s.advance(1);
  assert.ok(s.running === null && s.q.Size() === 0, 'settled');
}

test('RX interrupt held off: no handler runs, bytes stay in the DMA ring; the release copies the whole span in one HandleRxData', () => {
  const s = new K.Sim({ mode: 1 });
  settle(s);
  const isr0 = s.c.isr, read0 = s.c.read;
  s.setRxMask(true);
  s.advance(300);                                   // 60 more bytes on the line
  assert.equal(s.c.isr, isr0, 'no RX handler while the request is pending in the NVIC');
  const pendingIsr = s.isrQ.filter((c) => c.kind2 === 'rx' && !c.started);
  assert.ok(pendingIsr.length >= 1 && pendingIsr.length <= 2, 'one pending bit per NVIC line (usart1, dma1 channel 5): ' + pendingIsr.length);
  for (const c of pendingIsr) { const names = c.src.split('+'); assert.equal(new Set(names).size, names.length, 'merged request names are listed once: ' + c.src); }
  assert.ok(s.rxPending() >= 40, 'pending in the DMA ring: ' + s.rxPending());
  assert.equal(s.q.Size(), 0);
  const pend = s.rxPending();
  const spans = [];
  const orig = s.fetch.bind(s);
  s.fetch = (ctx) => { orig(ctx); if (ctx.step && ctx.step.id === 'rx.setlast' && s.u.lastSpan) spans.push({ ...s.u.lastSpan }); };
  s.setRxMask(false);
  s.advance(60);
  assert.ok(spans.length >= 1);
  assert.ok(spans[0].accepted >= pend, 'one call copies everything that was pending: ' + JSON.stringify(spans[0]) + ' pend ' + pend);
  assert.equal(s.c.dropped, 0);
  // the waiting reader got its 32 B inside that interrupt and takes the rest itself in thread context
  s.advance(3000);
  assert.equal(s.c.error, 0);
  assert.ok(s.c.read > read0 + 14, "reads " + (s.c.read - read0));
  assert.equal(s.readPps(), 6000);
});

test('RX interrupt held off across the DMA ring end: one HandleRxData, two PushBatch spans, no loss', () => {
  const s = new K.Sim({ mode: 1 });
  let guard = 0;
  while (s.dma.pos < 100 && guard++ < 4000) s.advance(5);
  s.setRxMask(true);
  guard = 0;
  while (!(s.dma.pos >= 16 && s.dma.pos < 40) && guard++ < 4000) s.advance(5);
  const spans = [];
  const orig = s.fetch.bind(s);
  s.fetch = (ctx) => { orig(ctx); if (ctx.step && ctx.step.id === 'rx.setlast' && s.u.lastSpan) spans.push({ ...s.u.lastSpan }); };
  s.setRxMask(false);
  s.advance(1500);
  assert.ok(spans.some((x) => x.spans === 2 && x.second > 0 && x.first > 0), JSON.stringify(spans));
  assert.equal(s.c.dropped, 0);
  assert.equal(s.c.error, 0);
});

test('RX interrupt held off for too long: the mask is dropped when the DMA ring is about to lap the unread bytes', () => {
  const s = new K.Sim({ mode: 1 });
  s.advance(500);
  s.setRxMask(true);
  s.advance(1000);                                  // 200 bytes would be written
  assert.equal(s.rxMasked, false);
  assert.equal(s.maskAuto, true);
  s.advance(1500);
  assert.equal(s.c.dropped, 0);
  assert.equal(s.c.error, 0);
  assert.equal(s.readPps(), 6000);
});

test('held-off interrupt while the reader is away: the queue takes what fits, drops the rest and counts it', () => {
  const s = new K.Sim({ mode: 1 });
  s.advance(500);
  s.setAway(true);
  s.advance(250);                                   // a few packets queued
  const before = s.q.Size();
  assert.ok(before > 0 && before < 128);
  s.setRxMask(true);
  s.advance(550);
  s.setRxMask(false);
  s.advance(300);
  assert.equal(s.q.Size(), 128);
  assert.ok(s.c.dropped > 0);
});

test('time is deterministic: two simulations with the same inputs match', () => {
  const a = new K.Sim({ mode: 2 }), b = new K.Sim({ mode: 2 });
  a.advance(5000); b.advance(5000);
  assert.deepEqual([a.t, a.dma.pos, a.q.head_, a.q.tail_, a.c.read, a.c.irqs], [b.t, b.dma.pos, b.q.head_, b.q.tail_, b.c.read, b.c.irqs]);
});

// ---------------------------------------------------------------- self-playing scenes (auto.ts)
test('scene runner: away and burst alternate every 10 s, each switching on, then off, then back to idle', async () => {
  const { SceneRunner, SCENES } = await import('./auto.ts');
  const r = new SceneRunner();
  const log = [];
  for (let t = 0; t < 40; t += 0.05) {
    const s = r.tick(0.05, false);
    if (s) log.push({ t: Math.round(t * 100) / 100, ...s });
  }
  const caps = log.map((e) => e.caption);
  assert.deepEqual(caps.slice(0, 6), ['awayOn', 'awayOff', 'idle', 'burstOn', 'burstOff', 'idle']);
  const starts = log.filter((e) => e.caption === 'awayOn' || e.caption === 'burstOn').map((e) => e.t);
  assert.ok(Math.abs(starts[0] - SCENES.first) < 0.2);
  assert.ok(Math.abs(starts[1] - starts[0] - SCENES.period) < 0.2);
  // away is only on while the away scene reads nothing; held only during the burst
  assert.deepEqual(log[0], { t: log[0].t, away: true, held: false, caption: 'awayOn' });
  assert.equal(log[1].away, false);
  assert.equal(log[3].held, true);
  assert.equal(log[4].held, false);
});

test('scene runner: a hold puts back what it switched on and starts nothing until released', async () => {
  const { SceneRunner, SCENES } = await import('./auto.ts');
  const r = new SceneRunner();
  let s;
  for (let t = 0; t < SCENES.first + 1; t += 0.05) s = r.tick(0.05, false) || s;
  assert.equal(r.state.away, true);
  const back = r.tick(0.05, true);
  assert.deepEqual(back, { away: false, held: false, caption: 'idle' });
  for (let i = 0; i < 400; i += 1) assert.equal(r.tick(0.05, true), null);
  assert.equal(r.playing, false);
  let started = null;
  for (let i = 0; i < 100 && !started; i += 1) started = r.tick(0.05, false);
  assert.ok(started && started.caption === 'burstOn', 'the next scene is the other one');
});
