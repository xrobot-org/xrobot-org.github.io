// TopicFanout simulation (sim.ts) under node 24+ (type stripping).
//   node --test src/components/showcase/TopicFanout/sim.test.mjs
// Part 1 mirrors LibXR's own Topic tests (test/automatic/middleware/message/topic/test_topic.cpp: dispatch to every
// subscriber kind, a mutable callback writes the caller's data, a full queue drops the new message and keeps the old ones)
// and the rules of publish.cpp / sync.hpp / async.hpp / lockfree_list.cpp. Part 2 checks the LinuxSharedTopic port
// (linux_shared_topic_impl.hpp): free-slot FIFO, refcount = receivers, one descriptor per receiver, FULL / DROP_OLD,
// the slot recycled by the last Release().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './sim.ts';

const { EC } = K;

function world(bytes = 12) {
  const topic = new K.Topic('imu_gyro', bytes);
  const q = new K.SPSCQueue(4), nQ = K.QueuedSubscriber(topic, q);
  const nA = K.ASyncSubscriber(topic);
  const recv = K.makePayload(bytes), nS = K.SyncSubscriber(topic, recv);
  const seen = { n: 0, ref: null };
  const nC = K.RegisterCallback(topic, (isr, ts, d) => { seen.n += 1; seen.isr = isr; seen.ref = d; });
  const data = K.makePayload(bytes); data.seq = 1; data.v = 0x1234;
  return { topic, q, nQ, nA, recv, nS, nC, seen, data };
}

// ---------------------------------------------------------------- in-process Topic
test('LockFreeList::Add puts every new node at the head; the walk runs newest first', () => {
  const w = world();
  assert.deepEqual(w.topic.subers.nodes().map((b) => b.type), ['CALLBACK', 'SYNC', 'ASYNC', 'QUEUE']);
  assert.equal(w.topic.subers.Size(), 4);
  assert.equal(w.topic.subers.head_.next_, w.nC);
});

test('one publish: the callback gets the publisher\'s object, sync / async / queue each get their own copy', () => {
  const w = world();
  assert.equal(K.SyncWaitBegin(w.nS), EC.OK);           // a thread is in Wait()
  K.StartWaiting(w.nA);
  const { ec, res } = K.Publish(w.topic, w.data);
  assert.equal(ec, EC.OK);
  assert.deepEqual(res.map((r) => r.kind), ['run', 'copy', 'copy', 'copy']);
  assert.equal(w.seen.ref, w.data);                      // the same object: no copy
  assert.equal(res[0].bytes, 0);
  assert.equal(w.nS.wait_state, K.WS.WAIT_CLAIMED);      // claimed by this publish, the Post is on its semaphore
  assert.equal(w.nS.sem, 1);
  assert.equal(w.recv.seq, 1); assert.notEqual(w.recv, w.data);
  assert.equal(w.nA.state, K.AS.DATA_READY); assert.equal(w.nA.buff_addr.v, 0x1234); assert.notEqual(w.nA.buff_addr, w.data);
  assert.equal(w.q.Size(), 1); assert.notEqual(w.q.items()[0], w.data);
  assert.equal(res.reduce((a, r) => a + r.bytes, 0), 36);
  assert.equal(w.topic.busy, K.LS.UNLOCKED);
});

test('a callback that changes its argument changes the publisher\'s data (TestTopicMutationAndQueueDrop)', () => {
  const topic = new K.Topic('mutable_payload_tp', 4);
  K.RegisterCallback(topic, (isr, ts, d) => { d.v = 5678; });
  const p = K.makePayload(4); p.v = 1234;
  K.Publish(topic, p);
  assert.equal(p.v, 5678);
});

test('SYNC: copied and woken only while waiting; a second Wait() is BUSY', () => {
  const w = world();
  const { res } = K.Publish(w.topic, w.data);            // WAIT_IDLE: nobody waiting
  assert.equal(res[1].kind, 'miss');
  assert.equal(w.recv.seq, 0); assert.equal(w.nS.sem, 0);
  assert.equal(K.SyncWaitBegin(w.nS), EC.OK);
  assert.equal(K.SyncWaitBegin(w.nS), EC.BUSY);
  K.Publish(w.topic, w.data);
  K.SyncWaitEnd(w.nS);
  assert.equal(w.nS.wait_state, K.WS.WAIT_IDLE); assert.equal(w.nS.sem, 0);
});

test('ASYNC: only the first publish after StartWaiting is kept; GetData returns to IDLE', () => {
  const w = world();
  assert.equal(K.Publish(w.topic, w.data).res[2].kind, 'ignore');   // IDLE
  K.StartWaiting(w.nA);
  K.Publish(w.topic, w.data);
  const d2 = K.makePayload(12); d2.seq = 2;
  const r = K.Publish(w.topic, d2).res[2];
  assert.equal(r.kind, 'ignore'); assert.equal(r.state, K.AS.DATA_READY);
  assert.equal(K.Available(w.nA), true);
  assert.equal(K.GetData(w.nA).seq, 1);
  assert.equal(w.nA.state, K.AS.IDLE);
});

test('QUEUE: a full SPSCQueue drops the new message and keeps the old ones', () => {
  const w = world();
  for (let i = 1; i <= 5; i += 1) { const d = K.makePayload(12); d.seq = i; K.Publish(w.topic, d); }
  assert.equal(w.q.Size(), 4);
  assert.deepEqual(w.q.items().map((p) => p.seq), [1, 2, 3, 4]);
  const out = {};
  assert.equal(w.q.PopBytes(out), EC.OK); assert.equal(out.value.seq, 1);
  assert.equal(w.q.RingCapacity(), 5);
});

test('copied bytes follow the payload size; the callback stays at 0 B', () => {
  const w = world(1024);
  K.SyncWaitBegin(w.nS); K.StartWaiting(w.nA);
  const { res } = K.Publish(w.topic, w.data);
  assert.deepEqual(res.map((r) => r.bytes), [0, 1024, 1024, 1024]);
});

test('TopicSim: the walk visits the list in order, one node per step, under the lock', () => {
  const s = new K.TopicSim(12);
  s.auto = false;
  s.request();
  s.advance(0.001);
  assert.ok(s.dispatch); assert.equal(s.topic.busy, K.LS.LOCKED);
  const seen = [];
  for (let i = 0; i < 100 && s.dispatch; i += 1) { s.advance(0.05); for (const l of ['callback', 'sync', 'async', 'queue']) if (s.dispatch?.res[l] && !seen.includes(l)) seen.push(l); }
  assert.deepEqual(seen.slice(0, 3), ['callback', 'sync', 'async']);
  assert.equal(s.topic.busy, K.LS.UNLOCKED);
  assert.equal(s.last.copied, 36);
});

test('TopicSim: over time the sync thread misses publishes while it works and the queue fills and drops', () => {
  const s = new K.TopicSim(12);
  const kinds = { sync: new Set(), async: new Set(), queue: new Set() };
  let n = 0;
  for (let i = 0; i < 1200; i += 1) {
    s.advance(0.1);
    if (s.published !== n) { n = s.published; for (const l of Object.keys(kinds)) kinds[l].add(s.last.res[l].kind); }
  }
  assert.ok(kinds.sync.has('copy') && kinds.sync.has('miss'));
  assert.ok(kinds.async.has('copy') && kinds.async.has('ignore'));
  assert.ok(kinds.queue.has('copy') && kinds.queue.has('drop'));
});

test('warmTopic: the still frame shows a publish that reached all four (36 B for 12 B, 3 KB for 1 KB)', () => {
  assert.equal(K.warmTopic(12).last.copied, 36);
  assert.equal(K.warmTopic(1024).last.copied, 3072);
});

// ---------------------------------------------------------------- LinuxSharedTopic
test('CreateData takes free slots in FIFO order; PublishData sets refcount = receivers and pushes one descriptor each', () => {
  const s = new K.SharedSim(12);
  const k = s.CreateData();
  assert.equal(k, 0);
  assert.equal(s.slots[0].st, 1);
  assert.equal(s.PublishData(k), EC.OK);
  assert.equal(s.slots[0].refcount, 3);
  assert.equal(s.slots[0].sequence, 1);
  for (const u of s.subs) assert.deepEqual(s.queued(u), [{ slot_index: 0, sequence: 1 }]);
  assert.equal(s.CreateData(), 1);
});

test('every subscriber reads the same slot; the last Release() recycles it to the free queue', () => {
  const s = new K.SharedSim(12);
  s.auto = false;
  s.request();
  s.advance(K.SP.write + K.SP.wake + 0.01);
  assert.deepEqual(s.subs.map((u) => u.held), [0, 0, 0]);
  assert.equal(s.slots[0].refcount, 3);
  s.Release(s.subs[0]); s.Release(s.subs[1]);
  assert.equal(s.slots[0].refcount, 1);
  assert.ok(!s.free.includes(0));
  s.Release(s.subs[2]);
  assert.equal(s.slots[0].refcount, 0);
  assert.equal(s.free[s.free.length - 1], 0);
});

test('queue_num = 4 stores 3 descriptors; FULL fails the whole publish and returns the slot, DROP_OLD drops its oldest', () => {
  const s = new K.SharedSim(12);
  for (let i = 0; i < 3; i += 1) assert.equal(s.PublishData(s.CreateData()), EC.OK);
  assert.deepEqual(s.subs.map((u) => s.pendingOf(u)), [3, 3, 3]);
  const k = s.CreateData();
  assert.equal(s.PublishData(k), EC.FULL);               // subscriber A (BROADCAST_FULL) has no space
  assert.equal(s.publish_failures, 1);
  assert.equal(s.slots[k].st, 0); assert.ok(s.free.includes(k));
  // make room for A and B only: C (BROADCAST_DROP_OLD) drops its oldest descriptor and releases that slot reference
  for (const u of s.subs.slice(0, 2)) { s.TryPopDescriptor(u); }
  s.ReleaseSlot(0); s.ReleaseSlot(0);
  assert.equal(s.slots[0].refcount, 1);
  const k2 = s.CreateData();
  assert.equal(s.PublishData(k2), EC.OK);
  assert.equal(s.subs[2].dropped, 1);
  assert.equal(s.slots[0].refcount, 0); assert.ok(s.free.includes(0));
  assert.deepEqual(s.queued(s.subs[2]).map((d) => d.sequence), [2, 3, 4]);
});

test('SharedSim over time: the slow DROP_OLD subscriber drops, nothing leaks (refcount = holders + queued)', () => {
  const s = new K.SharedSim(1024);
  for (let i = 0; i < 400; i += 1) {
    s.advance(0.1);
    for (let k = 0; k < K.SP.slots; k += 1) {
      const sl = s.slots[k];
      if (sl.st !== 2) continue;
      const holders = s.subs.filter((u) => u.held === k).length;
      const queued = s.subs.reduce((a, u) => a + s.queued(u).filter((d) => d.slot_index === k).length, 0);
      assert.equal(sl.refcount, holders + queued, `slot ${k}`);
    }
  }
  assert.ok(s.subs[2].dropped > 0);
  assert.equal(s.publish_failures, 0);
  const used = s.slots.filter((x) => x.st !== 0).length;
  assert.equal(used + s.free.length, K.SP.slots);
});

test('warmShared: the still frame has one slot read by at least two subscribers at once', () => {
  const s = K.warmShared(12), p = s.lastPub;
  assert.ok(p);
  assert.ok(s.subs.filter((u) => u.held === p.k).length >= 2);
});

test('self-playing: both worlds publish about every 2.5 s without any request', () => {
  for (const mk of [() => new K.TopicSim(12), () => new K.SharedSim(12)]) {
    const s = mk();
    s.auto = true;
    const p0 = s.published;
    s.advance(30);
    const n = s.published - p0;
    assert.ok(n >= 10 && n <= 13, `published ${n} in 30 s`);
  }
});

test('self-playing: the shared view recycles slots on its own (refcount returns to 0, no slot is lost)', () => {
  const s = new K.SharedSim(1024);
  s.auto = true;
  for (let i = 0; i < 400; i += 1) s.advance(0.1);
  assert.ok(s.published >= 14);
  assert.ok(s.events.some((e) => e.kind === 'recycle'));
  assert.equal(s.free.length + s.slots.filter((x) => x.st !== 0).length, K.SP.slots);
});

test('view tour: four views, one choice changes at a time, rounds counted from the view start', () => {
  const tour = new K.ViewTour();
  assert.deepEqual(tour.current(), { mode: 'topic', size: 0 });
  assert.equal(tour.update(0), null);
  tour.sync({ mode: 'topic', size: 0 }, 10);
  assert.equal(tour.update(12), null);
  assert.deepEqual(tour.update(13), { mode: 'shared', size: 0 });
  tour.sync({ mode: 'shared', size: 0 }, 5);
  assert.equal(tour.update(8), null);
  assert.deepEqual(tour.update(9), { mode: 'shared', size: 1 });
  const seen = [];
  let cur = tour.current(), pub = 0;
  tour.sync(cur, pub);
  for (let i = 0; i < 8; i += 1) {
    pub += K.TOUR_ROUNDS[cur.mode];
    const nx = tour.update(pub);
    assert.ok(nx);
    assert.equal((nx.mode !== cur.mode ? 1 : 0) + (nx.size !== cur.size ? 1 : 0), 1);
    seen.push(nx); cur = nx; tour.sync(cur, pub);
  }
  assert.equal(new Set(seen.map((v) => v.mode + v.size)).size, 4);
});

test('view tour: a manual choice moves the tour to that view', () => {
  const tour = new K.ViewTour();
  tour.sync({ mode: 'topic', size: 1 }, 7);
  assert.deepEqual(tour.current(), { mode: 'topic', size: 1 });
  assert.deepEqual(tour.update(10), { mode: 'topic', size: 0 });
});
