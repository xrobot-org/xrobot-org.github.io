/* RingBuffer: the receive path of a UART. Bytes arrive on the line (8N1), the circular DMA writes them into a 128 B ring, an
   interrupt (HT / TC / IDLE) runs STM32UART::HandleRxData, which copies the new span into the ReadPort's SPSC queue and, when the
   read thread waits in Read, copies it on in the same interrupt. The simulation (sim.ts) is a port of the LibXR functions; this
   file is the React side: controls, readouts, and the three canvases that engine.ts draws.
   Self-playing: every ~10 s of running time a scene plays on top of the receive path (auto.ts, driven by the engine's frames):
   the read thread stops reading and the queue fills, then reading resumes; or the interrupt is held off and released. One line
   of small text says what is on. A hover, press, key or focus on the controls or the ring pauses the scenes (8 s of quiet to
   resume) and puts back what a scene had switched on.
   Interface: ../README.md. `active` false stops the loop (no timers run); `reducedMotion` shows still frames. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';
import { Engine, type EngineTexts, type Stats } from './engine';
import type { Caption } from './auto';
import { useIdleGate } from '../useIdleGate';

export type ShowcaseProps = { active: boolean; reducedMotion: boolean };

const MODE_LABELS = ['115200 · 32 B', '2M · 32 B', '4M · 128 B'];

function buildTexts() {
  const engine: EngineTexts = {
    ringCenterLabel: translate({ id: 'showcase.ringbuffer.ring.center', message: 'SPSC 队列' }),
    heldPending: translate({ id: 'showcase.ringbuffer.ring.held', message: '中断暂缓 {n} B' }),
    twoCopies: translate({ id: 'showcase.ringbuffer.ring.twoCopies', message: '2 次拷贝' }),
    laneIsr: translate({ id: 'showcase.ringbuffer.lane.isr', message: '中断' }),
    laneThread: translate({ id: 'showcase.ringbuffer.lane.thread', message: '线程' }),
    laneRead: translate({ id: 'showcase.ringbuffer.lane.read', message: '读' }),
    laneWrite: translate({ id: 'showcase.ringbuffer.lane.write', message: '写' }),
    slow: translate({ id: 'showcase.ringbuffer.strip.slow', message: '时间放慢 1:{n}' }),
    held: translate({ id: 'showcase.ringbuffer.strip.held', message: '中断暂缓' }),
    hint: translate({ id: 'showcase.ringbuffer.inspect.hint', message: '点按环上的格子，查看序号与内容。' }),
    cellDma: translate({ id: 'showcase.ringbuffer.cell.dma', message: 'DMA 环 #{i} · 包 {pid} 第 {k} 字节 = 0x{hex} · {state}' }),
    cellDmaEmpty: translate({ id: 'showcase.ringbuffer.cell.dmaEmpty', message: 'DMA 环 #{i} · 尚未写入' }),
    cellQ: translate({ id: 'showcase.ringbuffer.cell.queue', message: 'SPSC 队列 #{i} · 包 {pid} 第 {k} 字节 = 0x{hex} · 位于 head 与 tail 之间' }),
    cellQHead: translate({ id: 'showcase.ringbuffer.cell.queueHead', message: 'SPSC 队列 #{i} · head 所在格：包 {pid} 第 {k} 字节 = 0x{hex}，下一个被取走' }),
    cellQFree: translate({ id: 'showcase.ringbuffer.cell.queueFree', message: 'SPSC 队列 #{i} · 空闲' }),
    cellQTail: translate({ id: 'showcase.ringbuffer.cell.queueTail', message: 'SPSC 队列 #{i} · tail 所在格，保持空闲；tail + 1 == head 即队列已满' }),
    pending: translate({ id: 'showcase.ringbuffer.cell.pending', message: '待拷贝' }),
    copied: translate({ id: 'showcase.ringbuffer.cell.copied', message: '已拷入队列' }),
    crcByte: translate({ id: 'showcase.ringbuffer.cell.crc', message: '校验字节 CRC8' }),
  };
  const ui = {
    aria: translate({ id: 'showcase.ringbuffer.aria', message: '串口接收路径：DMA 环、SPSC 队列与读线程' }),
    ringAria: translate({ id: 'showcase.ringbuffer.ring.aria', message: '外圈为 DMA 环，内圈为 SPSC 队列，标出 DMA 写入位置、head 与 tail' }),
    stripAria: translate({ id: 'showcase.ringbuffer.strip.aria', message: '时间线：串口字节流、中断与线程' }),
    caption: translate({ id: 'showcase.ringbuffer.caption', message: '外圈 DMA 环，内圈 SPSC 队列' }),
    modeGroup: translate({ id: 'showcase.ringbuffer.mode.group', message: '串口速率与包长' }),
    waiting: translate({ id: 'showcase.ringbuffer.waiting.label', message: '读线程在等' }),
    waitingOn: translate({ id: 'showcase.ringbuffer.waiting.on', message: 'Read 已挂起：字节入队后，在同一次中断内拷给读线程。' }),
    waitingOff: translate({ id: 'showcase.ringbuffer.waiting.off', message: '未调用 Read：字节留在队列里，队列满后多出的字节被丢弃。' }),
    burst: translate({ id: 'showcase.ringbuffer.burst.label', message: '突发' }),
    burstHint: translate({ id: 'showcase.ringbuffer.burst.hint', message: '按住：接收中断暂缓，字节留在 DMA 环；松开后一次拷入队列。' }),
    burstHintReduced: translate({ id: 'showcase.ringbuffer.burst.hintReduced', message: '接收中断暂缓一段时间，字节留在 DMA 环；随后一次拷入队列。' }),
    burstHeld: translate({ id: 'showcase.ringbuffer.burst.held', message: '已暂缓 {n} B' }),
    burstAuto: translate({ id: 'showcase.ringbuffer.burst.auto', message: 'DMA 环将满，已自动松开。' }),
    pps: translate({ id: 'showcase.ringbuffer.read.pps', message: '每秒收包' }),
    ppsUnit: translate({ id: 'showcase.ringbuffer.read.unit', message: '包/s' }),
    err: translate({ id: 'showcase.ringbuffer.read.err', message: 'CRC 错误' }),
    drop: translate({ id: 'showcase.ringbuffer.read.drop', message: '丢弃' }),
    reader: translate({ id: 'showcase.ringbuffer.reader.label', message: '读线程' }),
    readerWaiting: translate({ id: 'showcase.ringbuffer.reader.waiting', message: '挂起在 Read' }),
    readerRunning: translate({ id: 'showcase.ringbuffer.reader.running', message: '取数并校验 CRC' }),
    readerAway: translate({ id: 'showcase.ringbuffer.reader.away', message: '忙于其他事务' }),
    bufTitle: translate({ id: 'showcase.ringbuffer.buf.title', message: '读线程缓冲' }),
    crcOk: translate({ id: 'showcase.ringbuffer.buf.crcOk', message: 'CRC 通过' }),
    crcBad: translate({ id: 'showcase.ringbuffer.buf.crcBad', message: 'CRC 不符' }),
    legend: translate({ id: 'showcase.ringbuffer.legend', message: '颜色：包序号除以 4 的余数' }),
    step: translate({ id: 'showcase.ringbuffer.step', message: '推进 1 s' }),
    scene: {
      idle: translate({ id: 'showcase.ringbuffer.scene.idle', message: '持续接收：读线程挂起在 Read，字节入队后立即拷给读线程。' }),
      awayOn: translate({ id: 'showcase.ringbuffer.scene.awayOn', message: '正在演示：读线程暂时停止读取，队列水位上涨。' }),
      awayOff: translate({ id: 'showcase.ringbuffer.scene.awayOff', message: '正在演示：读线程恢复读取，队列水位回落。' }),
      burstOn: translate({ id: 'showcase.ringbuffer.scene.burstOn', message: '正在演示：接收中断暂缓，字节留在 DMA 环。' }),
      burstOff: translate({ id: 'showcase.ringbuffer.scene.burstOff', message: '正在演示：接收中断恢复，积压的字节一次拷入队列。' }),
    } as Record<Caption, string>,
    reducedNote: translate({ id: 'showcase.ringbuffer.reduced.note', message: '已减少动态效果：画面保持静止，操作后推进到下一个状态。' }),
  };
  return { engine, ui };
}

const INITIAL: Stats = {
  mode: 1, pps: 6000, error: 0, dropped: 0, occ: 0, cap: 128, head: 0, tail: 0, dmaPos: 0, last: 0, phase: 'PENDING', reader: 'waiting', held: false,
  heldBytes: 0, autoRecent: false, crc: null, full: false, empty: true,
};

export default function RingBuffer({ active, reducedMotion }: ShowcaseProps): JSX.Element {
  const t = useMemo(buildTexts, []);
  const rootRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLCanvasElement>(null);
  const bufRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const eng = useRef<Engine | null>(null);
  const [mode, setModeState] = useState(1);
  const [away, setAwayState] = useState(false);
  const [held, setHeldState] = useState(false);
  const [stats, setStats] = useState<Stats>(INITIAL);
  const [inspect, setInspect] = useState(t.engine.hint);
  const [caption, setCaption] = useState<Caption>('idle');
  const { idle, props: idleEvents } = useIdleGate();
  const live = useRef({ active, reducedMotion });
  live.current = { active, reducedMotion };

  // the engine lives as long as the component; the canvases, the theme and the size of the container are watched here
  useEffect(() => {
    const root = rootRef.current, ring = ringRef.current, buf = bufRef.current, strip = stripRef.current;
    if (!root || !ring || !buf || !strip) return undefined;
    const e = new Engine(root, ring, buf, strip, t.engine, {
      onStats: (s, ins) => { setStats(s); setInspect(ins); },
      onHeldEnd: () => setHeldState(false),
      onScene: (st) => { setAwayState(st.away); setHeldState(st.held); setCaption(st.caption); },
    });
    e.setHold(() => idle.paused());
    eng.current = e;
    e.setReduced(live.current.reducedMotion);
    e.setRunning(live.current.active);
    e.resize();
    const ro = new ResizeObserver(() => e.resize());
    ro.observe(ring); ro.observe(strip); ro.observe(buf);
    const mo = new MutationObserver(() => e.themeChanged());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => { ro.disconnect(); mo.disconnect(); e.dispose(); eng.current = null; };
  }, [t, idle]);
  useEffect(() => { eng.current?.setReduced(reducedMotion); }, [reducedMotion]);
  useEffect(() => { eng.current?.setRunning(active); }, [active]);

  // ---- controls
  const pickMode = (i: number): void => { setModeState(i); setHeldState(false); eng.current?.setMode(i); };
  const onSegKey = (ev: React.KeyboardEvent): void => {
    const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    ev.preventDefault();
    const i = (mode + d + MODE_LABELS.length) % MODE_LABELS.length;
    pickMode(i);
    (ev.currentTarget.querySelectorAll('button')[i] as HTMLElement | undefined)?.focus();
  };
  const toggleWaiting = (): void => { const next = !away; setAwayState(next); eng.current?.setAway(next); };
  const hold = (on: boolean): void => { if (live.current.reducedMotion) return; setHeldState(on); eng.current?.setHeld(on); };
  const burstProps = {
    onPointerDown: (ev: React.PointerEvent<HTMLButtonElement>) => { if (ev.button !== 0) return; try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch { /* not capturable */ } hold(true); },
    onPointerUp: () => hold(false),
    onPointerCancel: () => hold(false),
    onLostPointerCapture: () => hold(false),
    onBlur: () => hold(false),
    onContextMenu: (ev: React.MouseEvent) => ev.preventDefault(),
    onKeyDown: (ev: React.KeyboardEvent) => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat && !live.current.reducedMotion) { ev.preventDefault(); hold(true); } },
    onKeyUp: (ev: React.KeyboardEvent) => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); hold(false); } },
    onClick: () => { if (live.current.reducedMotion) eng.current?.pulse(); },
  };

  // ---- the ring: hover shows a cell, a click or tap pins it
  const ringXY = (ev: React.PointerEvent | React.MouseEvent): [number, number] => {
    const r = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };

  const fmtN = (tpl: string, n: number): string => tpl.replace('{n}', String(n));
  const readerText = stats.reader === 'waiting' ? t.ui.readerWaiting : stats.reader === 'running' ? t.ui.readerRunning : t.ui.readerAway;

  return (
    <section ref={rootRef} className={styles.root} aria-label={t.ui.aria}>
      <div className={styles.main}>
        <div className={styles.ringBox} {...idleEvents}>
          <canvas
            ref={ringRef} className={styles.ring} role="img" aria-label={t.ui.ringAria}
            onPointerMove={(ev) => { if (ev.pointerType === 'mouse') { const [x, y] = ringXY(ev); eng.current?.hover(x, y); } }}
            onPointerLeave={() => eng.current?.leave()}
            onClick={(ev) => { const [x, y] = ringXY(ev); eng.current?.pick(x, y); }}
          />
          <p className={styles.caption}>{t.ui.caption}</p>
        </div>

        <div className={styles.readout}>
            <div className={styles.stat}>
              <span className={styles.cap}>{t.ui.pps}</span>
              <span className={styles.num}>{stats.pps}<span className={styles.unit}>{t.ui.ppsUnit}</span></span>
            </div>
            <div className={styles.stat}>
              <span className={styles.cap}>{t.ui.err}</span>
              <span className={styles.num}>{stats.error}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.cap}>{t.ui.drop}</span>
              <span className={styles.numSm}>{stats.dropped}<span className={styles.unit}>B</span></span>
            </div>
        </div>

        <div className={styles.rest}>
          <div className={styles.bufRow}>
            <span className={styles.cap}>{t.ui.bufTitle}</span>
            <span className={stats.crc === 'ok' && stats.reader !== 'away' ? styles.tag : `${styles.tag} ${styles.tagMuted}`}>
              {stats.crc === null ? '—' : stats.crc === 'ok' ? t.ui.crcOk : t.ui.crcBad}
            </span>
            <canvas ref={bufRef} className={styles.buf} aria-hidden="true" />
          </div>
          <dl className={styles.grid}>
            <div className={styles.kv}><dt className={styles.k}>DMA</dt><dd className={styles.v}>{stats.dmaPos}</dd></div>
            <div className={styles.kv}><dt className={styles.k}>last_rx_pos_</dt><dd className={styles.v}>{stats.last}</dd></div>
            <div className={styles.kv}><dt className={styles.k}>head</dt><dd className={styles.v}>{stats.head}</dd></div>
            <div className={styles.kv}><dt className={styles.k}>tail</dt><dd className={styles.v}>{stats.tail}</dd></div>
            <div className={`${styles.kv} ${styles.kvWide}`}><dt className={styles.k}>ReadPort</dt><dd className={styles.v}>{stats.phase}</dd></div>
            <div className={`${styles.kv} ${styles.kvWide}`}><dt className={styles.k}>{t.ui.reader}</dt><dd className={styles.v}>{readerText}</dd></div>
          </dl>
          <p className={styles.inspect}>{inspect}</p>
        </div>

        <div className={styles.ctl} {...idleEvents}>
          <div className={styles.item}>
            <div className={styles.seg} role="radiogroup" aria-label={t.ui.modeGroup} onKeyDown={onSegKey}>
              {MODE_LABELS.map((label, i) => (
                <button key={label} type="button" role="radio" aria-checked={mode === i} tabIndex={mode === i ? 0 : -1} onClick={() => pickMode(i)}>{label}</button>
              ))}
            </div>
          </div>
          <div className={styles.item}>
            <button type="button" role="switch" aria-checked={!away} className={styles.sw} onClick={toggleWaiting}>
              <span className={styles.track} aria-hidden="true" />{t.ui.waiting}
            </button>
            <p className={styles.hint}>{away ? t.ui.waitingOff : t.ui.waitingOn}</p>
          </div>
          <div className={styles.item}>
            <div className={styles.row2}>
              <button type="button" className={styles.btn} aria-pressed={held} {...burstProps}>{t.ui.burst}</button>
              {held && <span className={styles.hint} aria-live="off">{fmtN(t.ui.burstHeld, stats.heldBytes)}</span>}
              {!held && stats.autoRecent && <span className={styles.hint}>{t.ui.burstAuto}</span>}
              {reducedMotion && <button type="button" className={styles.btn} onClick={() => eng.current?.advance(1)}>{t.ui.step}</button>}
            </div>
            <p className={styles.hint}>{reducedMotion ? t.ui.burstHintReduced : t.ui.burstHint}</p>
          </div>
          <div className={styles.item}>
            <p className={styles.legend}>
              <span>{t.ui.legend}</span>
              {[0, 1, 2, 3].map((n) => (<span key={n} className={styles.sws}><i style={{ background: `var(--ch${n})` }} />{n}</span>))}
            </p>
            {reducedMotion && <p className={styles.note}>{t.ui.reducedNote}</p>}
          </div>
        </div>
      </div>
      {!reducedMotion && <p className={styles.scene} aria-live="off">{t.ui.scene[caption]}</p>}
      <canvas ref={stripRef} className={styles.strip} role="img" aria-label={t.ui.stripAria} />
    </section>
  );
}
