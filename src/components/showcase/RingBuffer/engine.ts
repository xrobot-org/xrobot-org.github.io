/* RingBuffer engine: owns the simulation, the three canvases and the animation loop. Browser only (canvas, rAF); the page module
   index.tsx holds the React side. Screen time and simulated time are related by the mode's scale (microseconds of simulation per
   second on screen, 1:250 / 1:5000 / 1:10000), so that single bytes can be followed on the ring. */
import { Sim, DMA_N, PHN, GetPhase } from './sim';
import { SceneRunner, type SceneState } from './auto';
import {
  drawRing, drawBuf, drawStrip, hitRing, ringGeom, readPalette, type Hit, type Palette, type CanvasTexts, type StripTexts,
} from './draw';

export type EngineTexts = CanvasTexts & {
  slow: string; held: string; hint: string;
  cellDma: string; cellDmaEmpty: string; cellQ: string; cellQFree: string; cellQTail: string; cellQHead: string;
  pending: string; copied: string; crcByte: string;
};
export type Stats = {
  mode: number; pps: number; error: number; dropped: number; occ: number; cap: number; head: number; tail: number; dmaPos: number; last: number;
  phase: string; reader: 'waiting' | 'running' | 'away'; held: boolean; heldBytes: number; autoRecent: boolean; crc: 'ok' | 'bad' | null;
  full: boolean; empty: boolean;
};
export type EngineCallbacks = {
  onStats: (s: Stats, inspect: string) => void; onHeldEnd: (auto: boolean) => void;
  /** the self-playing scene changed the controls (away / burst) or its caption */
  onScene: (s: SceneState) => void;
};

const RATE_TEXT = ['115.2 kbps', '2 Mbps', '4 Mbps'];
const fmt = (tpl: string, vars: Record<string, string | number>): string => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
const pidOf = (m: number): number => (m >= 0 ? Math.floor(m / 512) : -1);
const idxOf = (m: number): number => (m >= 0 ? m % 512 : -1);
const hex2 = (v: number): string => v.toString(16).toUpperCase().padStart(2, '0');

export class Engine {
  sim: Sim;
  mode = 1;
  away = false;
  heldUi = false;
  running = false;
  reduced = false;
  private raf = 0;
  private lastTs = 0;
  private lastStat = 0;
  private pal: Palette | null = null;
  private hoverHit: Hit | null = null;
  private selHit: Hit | null = null;
  private dpr = 1;
  private sizes = { ring: 0, buf: [0, 0], strip: 0 } as { ring: number; buf: number[]; strip: number };
  private disposed = false;
  private autoAt = 0;
  // self-playing scenes (auto.ts); `holdFn` says the reader has the controls
  private scene = new SceneRunner();
  private holdFn: () => boolean = () => false;

  constructor(
    private root: HTMLElement,
    private ring: HTMLCanvasElement,
    private buf: HTMLCanvasElement,
    private strip: HTMLCanvasElement,
    private readonly tx: EngineTexts,
    private cb: EngineCallbacks,
  ) {
    this.sim = this.makeSim(1);
  }

  private makeSim(mode: number): Sim {
    const s = new Sim({ mode });
    s.setAway(this.away);
    this.warm(s);
    return s;
  }
  // a state worth looking at: a dozen packets in, and the instant a copy has just put bytes into the queue
  private warm(s: Sim): void {
    s.advance(14 * s.P * s.byteUs);
    const thr = Math.min(16, s.P / 2);
    for (let i = 0; i < 2500 && s.q.Size() < thr && !s.away; i++) s.advance(2);
  }

  // ---------------------------------------------------------------- controls
  setMode(i: number): void {
    if (i === this.mode && this.sim) return;
    this.mode = i;
    this.heldUi = false;
    this.hoverHit = null; this.selHit = null;
    this.sim = this.makeSim(i);
    this.refresh();
  }
  setAway(away: boolean): void {
    this.away = away;
    this.sim.setAway(away);
    if (this.reduced) this.advance(away ? 3.4 : 1.8); else this.refresh();
  }
  setHeld(on: boolean): void {
    if (on === this.heldUi) return;
    this.heldUi = on;
    if (on) this.autoAt = 0;
    this.sim.setRxMask(on);
    this.refresh();
  }
  // reduced motion: one hold-off of the RX interrupt, then the release and what follows, without animation
  pulse(): void {
    this.sim.setRxMask(true);
    this.advanceRaw(2.6);
    this.sim.setRxMask(false);
    this.advanceRaw(0.5);
    this.refresh();
  }
  advance(sec: number): void { this.advanceRaw(sec); this.refresh(); }
  private advanceRaw(sec: number): void {
    const s = this.sim, step = 0.1 * s.M.scale;
    let left = sec * s.M.scale;
    while (left > 1e-9) { const d = Math.min(step, left); s.advance(d); left -= d; }
  }
  setHold(fn: () => boolean): void { this.holdFn = fn; }
  private applyScene(st: SceneState): void {
    if (st.away !== this.away) this.setAway(st.away);
    if (st.held !== this.heldUi) this.setHeld(st.held);
    this.cb.onScene(st);
  }
  setReduced(on: boolean): void {
    this.reduced = on;
    this.syncLoop();
    this.refresh();
  }
  setRunning(on: boolean): void { this.running = on; this.syncLoop(); if (!on) this.refresh(); }
  private syncLoop(): void {
    const want = this.running && !this.reduced && !this.disposed;
    if (want && !this.raf) { this.lastTs = 0; this.raf = requestAnimationFrame(this.frame); }
    if (!want && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
  }
  dispose(): void { this.disposed = true; this.syncLoop(); }
  themeChanged(): void { this.pal = null; this.refresh(); }

  // ---------------------------------------------------------------- canvases
  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = (cv: HTMLCanvasElement): [number, number] => {
      const w = Math.max(1, Math.round(cv.clientWidth)), h = Math.max(1, Math.round(cv.clientHeight));
      const bw = Math.round(w * this.dpr), bh = Math.round(h * this.dpr);
      if (cv.width !== bw) cv.width = bw;
      if (cv.height !== bh) cv.height = bh;
      return [w, h];
    };
    this.sizes.ring = fit(this.ring)[0];
    this.sizes.buf = fit(this.buf);
    this.sizes.strip = fit(this.strip)[0];
    this.refresh();
  }
  private ctx2d(cv: HTMLCanvasElement): CanvasRenderingContext2D {
    const g = cv.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    return g;
  }
  private palette(): Palette { return this.pal || (this.pal = readPalette(this.root)); }

  // ---------------------------------------------------------------- loop
  private frame = (ts: number): void => {
    this.raf = 0;
    if (!this.running || this.reduced || this.disposed) return;
    const dt = this.lastTs ? Math.min(0.05, (ts - this.lastTs) / 1000) : 0;
    this.lastTs = ts;
    if (dt > 0) this.sim.advance(dt * this.sim.M.scale);
    if (this.heldUi && !this.sim.rxMasked) { this.heldUi = false; this.autoAt = this.sim.maskAuto ? performance.now() : 0; this.cb.onHeldEnd(this.sim.maskAuto); }
    // scenes run on top of the receive path; a switch the reader set (away, burst) or a hand on the controls holds them
    if (dt > 0) {
      const ss = this.scene.state;
      const st = this.scene.tick(dt, this.holdFn() || (this.away && !ss.away) || (this.heldUi && !ss.held));
      if (st) this.applyScene(st);
    }
    this.draw();
    if (ts - this.lastStat > 50) { this.lastStat = ts; this.emit(); }
    this.raf = requestAnimationFrame(this.frame);
  };
  refresh(): void { if (this.disposed) return; this.draw(); this.emit(); }

  draw(): void {
    const s = this.sim, tx = this.tx;
    // a canvas that is not laid out yet (width below the guard) is left alone
    if (this.sizes.ring >= 120) {
      const S = this.sizes.ring, pal = this.palette();
      drawRing(this.ctx2d(this.ring), ringGeom(S), s, { hover: this.hoverHit, sel: this.selHit, heldBytes: this.heldUi && s.rxMasked ? s.rxPending() : 0 }, pal, tx);
    }
    const [bw, bh] = this.sizes.buf;
    if (bw >= 24 && bh >= 4) drawBuf(this.ctx2d(this.buf), bw, bh, s, this.palette());
    const W = this.sizes.strip;
    if (W >= 200) {
      const strip: StripTexts = {
        laneIsr: tx.laneIsr, laneThread: tx.laneThread, laneRead: tx.laneRead, laneWrite: tx.laneWrite,
        caption: W >= 520 ? 'UART 8N1 · ' + RATE_TEXT[this.mode] : '8N1',
        slow: fmt(tx.slow, { n: Math.round(1e6 / s.M.scale) }), held: s.rxMasked ? tx.held : '',
      };
      drawStrip(this.ctx2d(this.strip), W, s, this.palette(), strip);
    }
  }

  // ---------------------------------------------------------------- readouts
  stats(): Stats {
    const s = this.sim, q = s.q, N = q.RingCapacity();
    const rt = s.rt;
    const reader: Stats['reader'] = s.away || s.reader.state === 'away' ? 'away' : rt.state === 'blocked' ? 'waiting' : 'running';
    const R = s.reader;
    return {
      mode: this.mode, pps: s.readPps(), error: s.c.error, dropped: s.c.dropped, occ: q.Size(), cap: q.MaxSize(), head: q.head_, tail: q.tail_, dmaPos: s.dma.pos,
      last: s.u.last_rx_pos_, phase: PHN[GetPhase(s.u.port.state_)], reader, held: this.heldUi && s.rxMasked, heldBytes: this.heldUi && s.rxMasked ? s.rxPending() : 0,
      autoRecent: this.autoAt > 0 && performance.now() - this.autoAt < 4000,
      crc: R.crc, full: (q.tail_ + 1) % N === q.head_, empty: q.tail_ === q.head_,
    };
  }
  private emit(): void { this.cb.onStats(this.stats(), this.describe(this.hoverHit || this.selHit)); }

  // ---------------------------------------------------------------- picking a cell
  private geom() { return ringGeom(this.sizes.ring); }
  hover(x: number, y: number): void {
    const h = hitRing(this.geom(), this.sim, x, y);
    if (JSON.stringify(h) === JSON.stringify(this.hoverHit)) return;
    this.hoverHit = h;
    if (!this.raf) this.refresh();
  }
  leave(): void { if (!this.hoverHit) return; this.hoverHit = null; if (!this.raf) this.refresh(); }
  pick(x: number, y: number): void {
    const h = hitRing(this.geom(), this.sim, x, y);
    this.selHit = h && this.selHit && h.ring === this.selHit.ring && h.idx === this.selHit.idx ? null : h;
    if (!this.raf) this.refresh();
  }
  private describe(h: Hit | null): string {
    const s = this.sim, tx = this.tx;
    if (!h) return tx.hint;
    if (h.ring === 'dma') {
      const m = s.dma.meta[h.idx];
      if (m < 0) return fmt(tx.cellDmaEmpty, { i: h.idx });
      const pend = (s.dma.pos - s.u.last_rx_pos_ + DMA_N) % DMA_N, fresh = (h.idx - s.u.last_rx_pos_ + DMA_N) % DMA_N < pend;
      return fmt(tx.cellDma, { i: h.idx, pid: pidOf(m), k: idxOf(m), hex: hex2(s.dma.buf[h.idx]), state: fresh ? tx.pending : tx.copied }) + (idxOf(m) === s.P - 1 ? ' · ' + tx.crcByte : '');
    }
    const q = s.q, N = q.RingCapacity();
    if (h.idx === q.tail_) return fmt(tx.cellQTail, { i: h.idx });
    const inQ = (h.idx - q.head_ + N) % N < q.Size();
    if (!inQ) return fmt(tx.cellQFree, { i: h.idx });
    const m = q.meta[h.idx];
    return fmt(h.idx === q.head_ ? tx.cellQHead : tx.cellQ, { i: h.idx, pid: pidOf(m), k: idxOf(m), hex: hex2(q.buf[h.idx]) }) + (idxOf(m) === s.P - 1 ? ' · ' + tx.crcByte : '');
  }
}
