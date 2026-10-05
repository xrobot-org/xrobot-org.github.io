/* TopicFanout: one publish and where it goes. Two views on one canvas:
   - in-process Topic: the publish walks the subscriber list; the sync subscriber gets a copy only while it waits in Wait(),
     the async one only after StartWaiting(), the queued one gets a copy into its SPSCQueue (or loses it when full), the
     callback runs on the publisher's own object;
   - LinuxSharedTopic: the publisher writes into a shared-memory slot, each subscriber gets a 16 B descriptor with the slot
     number and reads the same memory; the slot goes back to the free queue when the last one releases it.
   The key number is the data copied for the subscribers by one publish. sim.ts is the port of the LibXR functions, draw.ts
   draws it. Interface: ../README.md. `active` false stops the loop; `reducedMotion` shows still frames and a press
   of "publish" shows the finished result.
   Self-playing: while active (and motion allowed) the simulations publish about every 2.5 s, and ViewTour (sim.ts) moves the
   view between in-process / shared memory and 12 B / 1 KB after a few publishes. A hover, press, key or focus on the controls
   pauses that for 8 s of quiet (autoplay.ts); a view the user picked becomes the tour's current one. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';
import {
  TopicSim, SharedSim, ViewTour, warmTopic, warmShared, SIZES, DESC_BYTES, SP, TP, WSN, ASN, MODEN, type Lane, type Result, type TourView,
} from './sim';
import { useIdleGate } from '../useIdleGate';
import { drawTopic, drawShared, readPalette, canvasHeight, fmtBytes, type CanvasTexts, type Palette } from './draw';

export type ShowcaseProps = { active: boolean; reducedMotion: boolean };
type Mode = 'topic' | 'shared';

function buildTexts() {
  const c: CanvasTexts = {
    pubThread: translate({ id: 'showcase.topic.pub.thread', message: '发布者线程' }),
    original: translate({ id: 'showcase.topic.pub.original', message: '原件' }),
    listTitle: translate({ id: 'showcase.topic.list.title', message: '订阅者链表' }),
    walk: translate({ id: 'showcase.topic.list.walk', message: '从表头依次分发' }),
    legend: translate({ id: 'showcase.topic.legend', message: '颜色：序号 mod 4' }),
    lane: {
      callback: translate({ id: 'showcase.topic.lane.callback', message: '回调' }),
      sync: translate({ id: 'showcase.topic.lane.sync', message: '同步订阅' }),
      async: translate({ id: 'showcase.topic.lane.async', message: '异步订阅' }),
      queue: translate({ id: 'showcase.topic.lane.queue', message: '队列订阅' }),
    },
    api: { callback: 'Callback', sync: 'SyncSubscriber', async: 'ASyncSubscriber', queue: 'QueuedSubscriber' },
    syncWait: translate({ id: 'showcase.topic.sync.wait', message: '在 Wait() 中等待下一条' }),
    syncClaimed: translate({ id: 'showcase.topic.sync.claimed', message: '已被本次发布占用，正在唤醒' }),
    syncWork: translate({ id: 'showcase.topic.sync.work', message: '处理收到的数据，未在等待' }),
    asyncWaiting: translate({ id: 'showcase.topic.async.waiting', message: '已 StartWaiting()，等下一条' }),
    asyncReady: translate({ id: 'showcase.topic.async.ready', message: '有一份待取' }),
    asyncIdle: translate({ id: 'showcase.topic.async.idle', message: '未登记' }),
    queueFill: translate({ id: 'showcase.topic.queue.fill', message: '队列 {n}/{cap}' }),
    cbState: translate({ id: 'showcase.topic.cb.state', message: '发布时直接调用' }),
    resCopy: translate({ id: 'showcase.topic.res.copy', message: '复制 {b}' }),
    resMiss: translate({ id: 'showcase.topic.res.miss', message: '未在等待，错过' }),
    resIgnoreIdle: translate({ id: 'showcase.topic.res.ignoreIdle', message: '未登记，忽略' }),
    resIgnoreReady: translate({ id: 'showcase.topic.res.ignoreReady', message: '上一份未取，忽略' }),
    resDrop: translate({ id: 'showcase.topic.res.drop', message: '队列已满，丢弃' }),
    resRun: translate({ id: 'showcase.topic.res.run', message: '读原件，0 B' }),
    readsOriginal: translate({ id: 'showcase.topic.cb.reads', message: '读发布者的原件' }),
    pubProc: translate({ id: 'showcase.topic.shm.pub', message: '发布者进程' }),
    write: translate({ id: 'showcase.topic.shm.write', message: '原地写入槽 #{k}' }),
    shm: translate({ id: 'showcase.topic.shm.title', message: '共享内存 · {n} 个槽' }),
    slotFree: translate({ id: 'showcase.topic.shm.free', message: '空闲' }),
    freeQueue: translate({ id: 'showcase.topic.shm.freeQueue', message: '空闲队列' }),
    subWait: translate({ id: 'showcase.topic.shm.subWait', message: '在 Wait() 中等待' }),
    subRead: translate({ id: 'showcase.topic.shm.subRead', message: '读槽 #{k}' }),
    subWake: translate({ id: 'showcase.topic.shm.subWake', message: 'futex 唤醒' }),
    desc: translate({ id: 'showcase.topic.shm.desc', message: '描述符队列' }),
    dropOld: translate({ id: 'showcase.topic.shm.dropOld', message: '丢弃最旧描述符' }),
    pubFail: translate({ id: 'showcase.topic.shm.pubFail', message: '队列已满，本次发布失败' }),
    noSlot: translate({ id: 'showcase.topic.shm.noSlot', message: '无空闲槽' }),
  };
  const ui = {
    aria: translate({ id: 'showcase.topic.aria', message: 'Topic 的一次发布如何到达各个订阅者' }),
    canvasTopic: translate({ id: 'showcase.topic.canvas.topic', message: '发布者线程、订阅者链表与四种订阅者' }),
    canvasShared: translate({ id: 'showcase.topic.canvas.shared', message: '发布者进程、共享内存槽与三个订阅者进程' }),
    modeGroup: translate({ id: 'showcase.topic.mode.group', message: '分发方式' }),
    modeTopic: translate({ id: 'showcase.topic.mode.topic', message: '进程内 Topic' }),
    modeShared: translate({ id: 'showcase.topic.mode.shared', message: '跨进程共享内存' }),
    sizeGroup: translate({ id: 'showcase.topic.size.group', message: '数据大小' }),
    publish: translate({ id: 'showcase.topic.publish', message: '发布一条' }),
    keyLabel: translate({ id: 'showcase.topic.key.label', message: '一次发布为订阅者复制的数据' }),
    keyShared: translate({ id: 'showcase.topic.key.shared', message: '{n} 个订阅者读同一个槽 #{k}，各收到一个 {d} 描述符' }),
    keySharedNone: translate({ id: 'showcase.topic.key.sharedNone', message: '每个订阅者收到一个 {d} 描述符' }),
    captionTopic: translate({
      id: 'showcase.topic.caption.topic',
      message: '一次发布沿订阅者链表依次分发：同步订阅者在等待时被唤醒并得到一份，异步订阅者登记后得到一份，队列订阅者的一份进入队列，回调直接读发布者的数据。',
    }),
    captionShared: translate({
      id: 'showcase.topic.caption.shared',
      message: '发布者把数据写进共享内存槽，订阅者只收到槽号并读同一块内存；所有订阅者释放后引用计数归零，槽回到空闲队列。',
    }),
    details: translate({ id: 'showcase.topic.details', message: '展开细节' }),
    dTopicNote: translate({
      id: 'showcase.topic.d.topicNote',
      message: '`LockFreeList::Add` 把新订阅者插在表头，遍历从最后注册的订阅者开始。发布期间 Topic 的 busy 为 LOCKED，默认的单发布者 Topic 同一时刻只有一次发布。',
    }),
    dSub: translate({ id: 'showcase.topic.d.sub', message: '订阅者' }),
    dState: translate({ id: 'showcase.topic.d.state', message: '状态' }),
    dLast: translate({ id: 'showcase.topic.d.last', message: '上一次发布' }),
    dCount: translate({ id: 'showcase.topic.d.count', message: '已发布 {n} 条，累计复制 {b}' }),
    dSharedNote: translate({
      id: 'showcase.topic.d.sharedNote',
      message: '这里的发布者用 `CreateData()` 申请槽后原地写入；按值调用 `Publish(data)` 时先把数据复制进槽一次。`PublishData()` 把引用计数设为接收者数量，给每个接收者放一个 `{slot_index, sequence}` 描述符；`Release()` 把引用计数减一，减到 0 时槽回到空闲队列。',
    }),
    dSlot: translate({ id: 'showcase.topic.d.slot', message: '槽' }),
    dReading: translate({ id: 'showcase.topic.d.reading', message: '读取中' }),
    dQueued: translate({ id: 'showcase.topic.d.queued', message: '排队中' }),
    dMode: translate({ id: 'showcase.topic.d.mode', message: '模式' }),
    dPending: translate({ id: 'showcase.topic.d.pending', message: '待取' }),
    dDropped: translate({ id: 'showcase.topic.d.dropped', message: '丢弃' }),
    dConfig: translate({ id: 'showcase.topic.d.config', message: 'slot_num = {s}，subscriber_num = {u}，queue_num = {q}（环形队列最多存 {m} 个描述符）' }),
    reducedNote: translate({ id: 'showcase.topic.reduced', message: '已减少动态效果：画面保持静止，点按“发布一条”后显示分发结果。' }),
    subNames: [
      translate({ id: 'showcase.topic.shm.subA', message: '订阅者进程 A' }),
      translate({ id: 'showcase.topic.shm.subB', message: '订阅者进程 B' }),
      translate({ id: 'showcase.topic.shm.subC', message: '订阅者进程 C' }),
    ],
  };
  return { c, ui };
}

const fmt = (tpl: string, vars: Record<string, string | number>): string => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
const code = (s: string): React.ReactNode => s.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part));
const LANE_ORDER: Lane[] = ['callback', 'sync', 'async', 'queue'];

type Snap = { n: number }; // a tick that makes React re-read the simulations

export default function TopicFanout({ active, reducedMotion }: ShowcaseProps): JSX.Element {
  const t = useMemo(buildTexts, []);
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('topic');
  const [size, setSize] = useState(0);
  const sizeRef = useRef(0);
  const [, setSnap] = useState<Snap>({ n: 0 });
  const sims = useRef<{ topic: TopicSim; shared: SharedSim } | null>(null);
  if (!sims.current) sims.current = { topic: warmTopic(SIZES[0]), shared: warmShared(SIZES[0]) };
  const live = useRef({ active, reducedMotion, mode });
  live.current = { active, reducedMotion, mode };
  const { idle, props: idleEvents } = useIdleGate();
  const tour = useRef<ViewTour | null>(null);
  if (!tour.current) tour.current = new ViewTour();
  const view = useRef({ pal: null as Palette | null, dpr: 1, W: 0, H: 0, raf: 0, last: 0, lastSnap: 0 });

  // ---- drawing
  const draw = (): void => {
    const cv = canvasRef.current, root = rootRef.current, S = sims.current;
    if (!cv || !root || !S) return;
    const v = view.current;
    if (v.W < 200) return;
    if (!v.pal) v.pal = readPalette(root);
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    if (live.current.mode === 'topic') drawTopic(g, v.W, v.H, S.topic, v.pal, t.c);
    else drawShared(g, v.W, v.H, S.shared, v.pal, t.c, t.ui.subNames);
  };
  const resize = (): void => {
    const cv = canvasRef.current;
    if (!cv) return;
    const v = view.current;
    v.dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(cv.clientWidth));
    const H = canvasHeight(W);
    if (cv.style.height !== `${H}px`) cv.style.height = `${H}px`;
    v.W = W; v.H = H;
    const bw = Math.round(W * v.dpr), bh = Math.round(H * v.dpr);
    if (cv.width !== bw) cv.width = bw;
    if (cv.height !== bh) cv.height = bh;
    draw();
  };
  const bump = (): void => setSnap((s) => ({ n: s.n + 1 }));

  // ---- the loop: only while active and motion is allowed
  useEffect(() => {
    const S = sims.current!;
    const run = active && !reducedMotion;
    S.topic.auto = run; S.shared.auto = run;
    const v = view.current;
    if (!run) { cancelAnimationFrame(v.raf); v.raf = 0; draw(); bump(); return undefined; }
    v.last = 0;
    let wasAuto = false;
    tour.current!.sync({ mode: live.current.mode, size: sizeRef.current } as TourView, (live.current.mode === 'topic' ? S.topic : S.shared).published);
    const frame = (ts: number): void => {
      const dt = v.last ? Math.min(0.05, (ts - v.last) / 1000) : 0;
      v.last = ts;
      // the user's hand on a control pauses the automatic publishing and the view tour; the quiet time resumes it
      const auto = !idle.paused(ts);
      const sim = live.current.mode === 'topic' ? S.topic : S.shared;
      if (auto && !wasAuto) {
        tour.current!.sync({ mode: live.current.mode, size: sizeRef.current } as TourView, sim.published);
        sim.nextAuto = Math.max(sim.nextAuto, sim.t + 0.6);
      }
      wasAuto = auto;
      S.topic.auto = auto; S.shared.auto = auto;
      if (dt > 0) sim.advance(dt);
      if (auto) {
        const next = tour.current!.update(sim.published);
        if (next) showView(next);
      }
      draw();
      if (ts - v.lastSnap > 120) { v.lastSnap = ts; bump(); }
      v.raf = requestAnimationFrame(frame);
    };
    v.raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(v.raf); v.raf = 0; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reducedMotion]);

  // ---- size and theme
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(cv);
    const mo = new MutationObserver(() => { view.current.pal = null; draw(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => { ro.disconnect(); mo.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { draw(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- controls
  const pickMode = (m: Mode): void => {
    setMode(m); live.current.mode = m;
    const S = sims.current!;
    tour.current!.sync({ mode: m, size: sizeRef.current as 0 | 1 }, (m === 'topic' ? S.topic : S.shared).published);
    draw(); bump();
  };
  const pickSize = (i: number): void => {
    if (i === sizeRef.current) return;
    setSize(i); sizeRef.current = i;
    // a different payload type is a different Topic (the type contract includes the size): both worlds start over
    const S = sims.current!;
    const run = live.current.active && !live.current.reducedMotion;
    S.topic = warmTopic(SIZES[i]); S.shared = warmShared(SIZES[i]);
    S.topic.auto = run; S.shared.auto = run;
    tour.current!.sync({ mode: live.current.mode, size: i as 0 | 1 }, (live.current.mode === 'topic' ? S.topic : S.shared).published);
    draw(); bump();
  };
  // the tour's own switch (same effect as the two segmented controls, without touching the quiet-time gate)
  const showView = (v: TourView): void => {
    const idx = v.size;
    if (idx !== sizeRef.current) {
      sizeRef.current = idx; setSize(idx);
      const S = sims.current!;
      S.topic = warmTopic(SIZES[idx]); S.shared = warmShared(SIZES[idx]);
      S.topic.auto = true; S.shared.auto = true;
    }
    if (v.mode !== live.current.mode) { live.current.mode = v.mode; setMode(v.mode); }
    const S2 = sims.current!;
    tour.current!.sync(v, (v.mode === 'topic' ? S2.topic : S2.shared).published);
    draw(); bump();
  };
  const publish = (): void => {
    const S = sims.current!;
    const sim = live.current.mode === 'topic' ? S.topic : S.shared;
    sim.request();
    if (sim === S.topic) S.topic.nextAuto = S.topic.t + TP.period * 1.5; else S.shared.nextAuto = S.shared.t + SP.period * 1.5;
    if (live.current.reducedMotion || !live.current.active) sim.settle();
    draw(); bump();
  };
  const segKeys = <T,>(items: T[], cur: T, pick: (x: T) => void) => (ev: React.KeyboardEvent): void => {
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    ev.preventDefault();
    const i = (items.indexOf(cur) + d + items.length) % items.length;
    pick(items[i]);
    (ev.currentTarget.querySelectorAll('button')[i] as HTMLElement | undefined)?.focus();
  };

  // ---- readouts (read straight from the simulations on every render)
  const S = sims.current;
  const T = S.topic, H = S.shared;
  let keyValue = '', keySub: React.ReactNode = '';
  if (mode === 'topic') {
    const res: Partial<Record<Lane, Result>> = T.dispatch ? T.dispatch.res : T.last ? T.last.res : {};
    const copied = T.dispatch ? T.dispatch.copied : T.last ? T.last.copied : 0;
    keyValue = fmtBytes(copied);
    keySub = LANE_ORDER.map((l) => {
      const r = res[l];
      return `${t.c.lane[l]} ${r ? fmtBytes(r.bytes) : '—'}`;
    }).join(' · ');
  } else {
    keyValue = fmtBytes(0);
    const p = H.lastPub;
    const readers = p ? H.subs.filter((u) => u.held === p.k).length : 0;
    keySub = p && readers > 1 ? fmt(t.ui.keyShared, { n: readers, k: p.k, d: fmtBytes(DESC_BYTES) }) : fmt(t.ui.keySharedNone, { d: fmtBytes(DESC_BYTES) });
  }
  const stateOf = (l: Lane): string => {
    if (l === 'sync') return `wait_state = ${WSN[T.nS.wait_state || 0]}`;
    if (l === 'async') return `state = ${ASN(T.nA.state || 0)}`;
    if (l === 'queue') return `head = ${T.q.head_} · tail = ${T.q.tail_} · ${T.q.Size()}/${T.q.MaxSize()}`;
    return '—';
  };
  const lastOf = (l: Lane): string => {
    const r = T.last?.res[l];
    if (!r) return '—';
    const m: Record<string, string> = { copy: fmt(t.c.resCopy, { b: fmtBytes(r.bytes) }), miss: t.c.resMiss, ignore: r.state === 0xffffffff ? t.c.resIgnoreReady : t.c.resIgnoreIdle, drop: t.c.resDrop, run: t.c.resRun };
    return `#${r.seq} ${m[r.kind]}`;
  };
  const modes: Mode[] = ['topic', 'shared'];

  return (
    <section ref={rootRef} className={styles.root} aria-label={t.ui.aria}>
      <div className={styles.ctl} {...idleEvents}>
        <div className={styles.seg} role="radiogroup" aria-label={t.ui.modeGroup} onKeyDown={segKeys(modes, mode, pickMode)}>
          {modes.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} tabIndex={mode === m ? 0 : -1} onClick={() => pickMode(m)}>
              {m === 'topic' ? t.ui.modeTopic : t.ui.modeShared}
            </button>
          ))}
        </div>
        <div className={styles.seg} role="radiogroup" aria-label={t.ui.sizeGroup} onKeyDown={segKeys([0, 1], size, pickSize)}>
          {SIZES.map((b, i) => (
            <button key={b} type="button" role="radio" aria-checked={size === i} tabIndex={size === i ? 0 : -1} onClick={() => pickSize(i)}>
              {fmtBytes(b)}
            </button>
          ))}
        </div>
        <button type="button" className={styles.btn} onClick={publish}>{t.ui.publish}</button>
      </div>

      <div className={styles.key}>
        <span className={styles.cap}>{t.ui.keyLabel}</span>
        <span className={styles.num} aria-live="off">{keyValue}</span>
        <span className={styles.keySub}>{keySub}</span>
      </div>

      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={mode === 'topic' ? t.ui.canvasTopic : t.ui.canvasShared} />
      <p className={styles.caption}>{mode === 'topic' ? t.ui.captionTopic : t.ui.captionShared}</p>
      {reducedMotion && <p className={styles.caption}>{t.ui.reducedNote}</p>}

      <details className={styles.details}>
        <summary>{t.ui.details}</summary>
        {mode === 'topic' ? (
          <div className={styles.dBody}>
            <p>{code(t.ui.dTopicNote)}</p>
            <table className={styles.table}>
              <thead><tr><th>{t.ui.dSub}</th><th>{t.ui.dState}</th><th>{t.ui.dLast}</th></tr></thead>
              <tbody>
                {T.order.map((n) => (
                  <tr key={n.id}>
                    <td><code>{t.c.api[n.id]}</code></td>
                    <td><code>{stateOf(n.id)}</code></td>
                    <td>{lastOf(n.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.muted}>{fmt(t.ui.dCount, { n: T.published, b: fmtBytes(T.copiedTotal) })}</p>
          </div>
        ) : (
          <div className={styles.dBody}>
            <p>{code(t.ui.dSharedNote)}</p>
            <p className={styles.muted}><code>{fmt(t.ui.dConfig, { s: SP.slots, u: SP.subs, q: SP.queue, m: SP.queue - 1 })}</code></p>
            <table className={styles.table}>
              <thead><tr><th>{t.ui.dSlot}</th><th>sequence</th><th>refcount</th><th>{t.ui.dReading}</th><th>{t.ui.dQueued}</th></tr></thead>
              <tbody>
                {H.slots.map((sl, k) => {
                  const r = H.refsOf(k);
                  const nm = (ids: number[]) => ids.map((i) => 'ABC'[i]).join(' ') || '—';
                  return (
                    <tr key={k}>
                      <td><code>#{k}</code></td>
                      <td><code>{sl.st === 2 ? sl.sequence : '—'}</code></td>
                      <td><code>{sl.refcount}</code></td>
                      <td>{nm(r.reading)}</td>
                      <td>{nm(r.queued)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <table className={styles.table}>
              <thead><tr><th>{t.ui.dSub}</th><th>{t.ui.dMode}</th><th>{t.ui.dPending}</th><th>{t.ui.dDropped}</th></tr></thead>
              <tbody>
                {H.subs.map((u) => (
                  <tr key={u.i}>
                    <td>{t.ui.subNames[u.i]}</td>
                    <td><code>{MODEN[u.mode]}</code></td>
                    <td><code>{H.pendingOf(u)}</code></td>
                    <td><code>{u.dropped}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.muted}><code>GetPublishFailedNum() = {H.publish_failures}</code></p>
          </div>
        )}
      </details>
    </section>
  );
}
