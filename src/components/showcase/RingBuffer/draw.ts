/* RingBuffer canvas drawing. Reads the simulation (sim.ts) and never changes it. Flat 2D, XRobot Style: right angles, 1 px lines,
   no shadow, no gradient; colours come from the palette read off the CSS variables, the four channel colours only
   colour data (packet number mod 4). All sizes are CSS pixels; the caller scales the canvas for devicePixelRatio. */
import { DMA_N, GetPhase, PHN, EVENT_BIT, type Sim, type Block, type LineByte } from './sim';

export type Palette = {
  ink: string; inkMuted: string; onInk: string; paper: string; raised: string; sunken: string; line: string; lineStrong: string;
  ch: string[]; mono: string; sans: string;
};
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string): string => cs.getPropertyValue(n).trim();
  return {
    ink: v('--ink'), inkMuted: v('--ink-muted'), onInk: v('--on-ink'), paper: v('--paper'), raised: v('--paper-raised'), sunken: v('--paper-sunken'),
    line: v('--line'), lineStrong: v('--line-strong'), ch: [v('--ch0'), v('--ch1'), v('--ch2'), v('--ch3')],
    mono: v('--font-mono') || 'monospace', sans: v('--font-sans') || 'sans-serif',
  };
}

// words drawn on the canvases (translated by the caller)
export type CanvasTexts = {
  ringCenterLabel: string; heldPending: string; twoCopies: string;
  laneIsr: string; laneThread: string; laneRead: string; laneWrite: string;
};

const TAU = Math.PI * 2;
const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
const pidOf = (m: number): number => (m >= 0 ? Math.floor(m / 512) : -1);
const idxOf = (m: number): number => (m >= 0 ? m % 512 : -1);
const hex2 = (v: number): string => v.toString(16).toUpperCase().padStart(2, '0');
const chOf = (pal: Palette, m: number): string => pal.ch[pidOf(m) & 3];

// ============================================================================ ring (DMA ring outside, SPSC queue inside)
export type RingGeom = { S: number; cx: number; cy: number; ro: number; wo: number; ri: number; wi: number };
export function ringGeom(S: number): RingGeom {
  const ro = S / 2 - 26;
  const wo = Math.max(9, Math.round(S * 0.045));
  const gap = Math.max(14, Math.round(S * 0.075));
  const wi = Math.max(9, Math.round(S * 0.048));
  return { S, cx: S / 2, cy: S / 2, ro, wo, ri: ro - wo - gap, wi };
}
export type Hit = { ring: 'dma' | 'q'; idx: number };
// which cell is under (x, y); the rings are a little generous so that a touch lands on one
export function hitRing(geom: RingGeom, sim: Sim, x: number, y: number): Hit | null {
  const dx = x - geom.cx, dy = y - geom.cy, d = Math.hypot(dx, dy);
  let a = (Math.atan2(dy, dx) + Math.PI / 2) / TAU;
  a -= Math.floor(a);
  if (d <= geom.ro + 4 && d >= geom.ro - geom.wo - 4) return { ring: 'dma', idx: Math.min(DMA_N - 1, Math.floor(a * DMA_N)) };
  const N = sim.q.RingCapacity();
  if (d <= geom.ri + 4 && d >= geom.ri - geom.wi - 4) return { ring: 'q', idx: Math.min(N - 1, Math.floor(a * N)) };
  return null;
}
export type RingView = { hover: Hit | null; sel: Hit | null; heldBytes: number };

function A(i: number, N: number): number { return -Math.PI / 2 + (i / N) * TAU; }
function cellPath(g: CanvasRenderingContext2D, geom: RingGeom, r: number, w: number, i: number, N: number, inset = 0): void {
  const e = inset / (r - w / 2);
  g.beginPath();
  g.arc(geom.cx, geom.cy, r - inset, A(i, N) + e, A(i + 1, N) - e);
  g.arc(geom.cx, geom.cy, r - w + inset, A(i + 1, N) - e, A(i, N) + e, true);
  g.closePath();
}
function annulus(g: CanvasRenderingContext2D, geom: RingGeom, r: number, w: number, fill: string): void {
  g.beginPath(); g.arc(geom.cx, geom.cy, r, 0, TAU); g.arc(geom.cx, geom.cy, r - w, 0, TAU, true); g.fillStyle = fill; g.fill();
}
// cells of one ring in a few batches: bins[ch * 2 + fresh] are painted with the channel colour, bins[8] is overlaid with ink
function fillBins(g: CanvasRenderingContext2D, geom: RingGeom, r: number, w: number, N: number, bins: number[][], pal: Palette, alpha: [number, number], overlay: string, overlayAlpha: number): void {
  const { cx, cy } = geom;
  const add = (i: number): void => {
    const a0 = A(i, N), a1 = A(i + 1, N);
    g.moveTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
    g.arc(cx, cy, r, a0, a1);
    g.arc(cx, cy, r - w, a1, a0, true);
    g.closePath();
  };
  for (let b = 0; b < 9; b++) {
    if (!bins[b].length) continue;
    g.beginPath();
    for (const i of bins[b]) add(i);
    g.globalAlpha = b === 8 ? overlayAlpha : alpha[b & 1];
    g.fillStyle = b === 8 ? overlay : pal.ch[b >> 1];
    g.fill();
  }
  g.globalAlpha = 1;
}
function separators(g: CanvasRenderingContext2D, geom: RingGeom, r: number, w: number, N: number, color: string): void {
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const a = A(i, N), c = Math.cos(a), s = Math.sin(a);
    g.moveTo(geom.cx + (r - w) * c, geom.cy + (r - w) * s); g.lineTo(geom.cx + r * c, geom.cy + r * s);
  }
  g.strokeStyle = color; g.lineWidth = 1; g.stroke();
}
function text(g: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'center', base: CanvasTextBaseline = 'middle'): void {
  g.font = font; g.fillStyle = fill; g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y);
}
function polar(geom: RingGeom, r: number, a: number): [number, number] { return [geom.cx + r * Math.cos(a), geom.cy + r * Math.sin(a)]; }

type Label = { a: number; w: number; t: string; c: string; side?: number };
// Spreads labels along a ring of radius r: each is moved (by its own `side` first, then symmetrically) until neighbours clear each
// other. Angles are radians; the width w is in pixels.
function spreadLabels(items: Label[], r: number): Label[] {
  const out = items.map((l) => ({ ...l, a: l.a + (l.side ? l.side * (l.w / 2 + 3) / r : 0) }));
  for (let pass = 0; pass < 12; pass++) {
    out.sort((x, y) => x.a - y.a);
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      const p = out[i], q = out[(i + 1) % out.length];
      let gap = q.a - p.a;
      if (i === out.length - 1) gap += TAU;
      const need = ((p.w + q.w) / 2 + 3) / r;
      if (out.length > 1 && gap < need) { const d = (need - gap) / 2; p.a -= d; q.a += d; moved = true; }
    }
    if (!moved) break;
  }
  return out;
}

export function drawRing(g: CanvasRenderingContext2D, geom: RingGeom, sim: Sim, view: RingView, pal: Palette, tx: CanvasTexts): void {
  const { S, cx, cy, ro, wo, ri, wi } = geom;
  g.clearRect(0, 0, S, S);
  const mono = (w: number, px: number): string => `${w} ${px}px ${pal.mono}`;
  const dma = sim.dma, q = sim.q, n = DMA_N, N = q.RingCapacity(), cap = q.MaxSize();
  const k = sim.M.scale;                                              // simulated us per second on screen
  const pos = dma.pos, last = sim.u.last_rx_pos_, pend = (pos - last + n) % n;
  const qh = q.head_, qt = q.tail_, occ = q.Size();

  // ---- outer ring: the 128 B circular RX DMA buffer. Bytes waiting for HandleRxData are solid, copied ones stay faint
  const outerBins: number[][] = Array.from({ length: 9 }, () => []);          // channel * 2 + fresh, and 8 = CRC byte waiting
  annulus(g, geom, ro, wo, pal.sunken);
  for (let i = 0; i < n; i++) {
    const m = dma.meta[i];
    if (m < 0) continue;
    const fresh = (i - last + n) % n < pend;
    outerBins[(pidOf(m) & 3) * 2 + (fresh ? 1 : 0)].push(i);
    if (fresh && idxOf(m) === sim.P - 1) outerBins[8].push(i);
  }
  fillBins(g, geom, ro, wo, n, outerBins, pal, [0.3, 1], pal.ink, 0.4);
  // ---- inner ring: SPSC queue, capacity + 1 slots; [head, tail) holds bytes, the slot at tail stays free
  const cpyStep = sim.running && sim.running.step && sim.running.step.info && sim.running.step.info.copy && sim.running.step.info.copy.to === 'q' ? sim.running.step : null;
  const innerBins: number[][] = Array.from({ length: 9 }, () => []);
  annulus(g, geom, ri, wi, pal.sunken);
  for (let i = 0; i < occ; i++) {
    const c = (qh + i) % N, m = q.meta[c];
    innerBins[(pidOf(m) & 3) * 2 + 1].push(c);
    if (idxOf(m) === sim.P - 1) innerBins[8].push(c);
  }
  fillBins(g, geom, ri, wi, N, innerBins, pal, [1, 1], pal.ink, 0.4);
  // cells just handed to the read thread fade out (the pop copy and the head store happen within microseconds)
  for (const f of sim.flights) {
    if (f.kind !== 'pop') continue;
    const age = (sim.t - f.t1) / k;
    if (age < 0 || age > 0.9) continue;
    for (let j = 0; j < f.n; j++) {
      const i = (f.from + j) % f.cap;
      if ((i - qh + N) % N < occ) continue;
      cellPath(g, geom, ri, wi, i, N);
      g.globalAlpha = 0.55 * (1 - age / 0.9); g.fillStyle = chOf(pal, q.meta[i]); g.fill(); g.globalAlpha = 1;
    }
  }
  // a copy into the queue in progress: cells outlined as they are written, tail not yet stored
  if (cpyStep) {
    const cp = cpyStep.info!.copy, prog = clamp(1 - cpyStep.left / Math.max(1e-9, cpyStep.us), 0, 1);
    for (let j = 0; j < cp.n * prog; j++) {
      const i = (cp.from + j) % cp.cap;
      cellPath(g, geom, ri, wi, i, N);
      g.globalAlpha = 0.45; g.fillStyle = chOf(pal, dma.meta[(cp.src + j) % n]); g.fill(); g.globalAlpha = 1;
      g.strokeStyle = pal.ink; g.lineWidth = 1; g.stroke();
    }
  }
  // the connector of a copy: the span in the DMA ring to the span in the queue
  for (const f of sim.flights) {
    if (f.kind !== 'push') continue;
    const age = (sim.t - f.t1) / k;
    if (age > 0.4) continue;
    const a0 = A((f.src || 0) + f.n / 2, n), a1 = A(f.from + f.n / 2, f.cap);
    const [x0, y0] = polar(geom, ro - wo - 1, a0), [x1, y1] = polar(geom, ri + 1, a1);
    const [mx, my] = polar(geom, (ro - wo + ri) / 2 - 12, (a0 + a1) / 2 + (Math.abs(a1 - a0) > Math.PI ? Math.PI : 0));
    g.globalAlpha = 0.7 * (age > 0 ? 1 - age / 0.4 : 1); g.strokeStyle = pal.ink; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.stroke(); g.globalAlpha = 1;
  }
  // the radial gaps between cells: one stroke per ring
  separators(g, geom, ro, wo, n, pal.raised);
  separators(g, geom, ri, wi, N, pal.raised);
  // ring outlines
  g.strokeStyle = pal.line; g.lineWidth = 1;
  for (const [r, w] of [[ro, wo], [ri, wi]]) for (const rr of [r + 0.5, r - w - 0.5]) { g.beginPath(); g.arc(cx, cy, rr, 0, TAU); g.stroke(); }
  // the slot at tail: free by construction
  cellPath(g, geom, ri, wi, qt, N, 0.5);
  g.strokeStyle = pal.ink; g.lineWidth = 1; g.stroke();

  // ---- marks and cursors. The needles sit at their true angle; the words are spread along the ring so that they do not overlap
  const mono12 = mono(700, 12);
  g.lineWidth = 1; g.strokeStyle = pal.inkMuted;
  for (const i of [64, 0]) {
    const a = A(i, n), [x0, y0] = polar(geom, ro + 1, a), [x1, y1] = polar(geom, ro + 5, a);
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  }
  {
    // DMA write cursor (CNDTR) through the ring; last_rx_pos_ as a tick on its inner edge
    const a = A(pos, n), [x0, y0] = polar(geom, ro - wo - 3, a), [x1, y1] = polar(geom, ro + 6, a);
    g.strokeStyle = pal.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    const b = A(last, n), [y2x, y2y] = polar(geom, ro - wo - 6, b), [y3x, y3y] = polar(geom, ro - wo + 1, b);
    g.strokeStyle = pal.inkMuted; g.lineWidth = 2; g.beginPath(); g.moveTo(y2x, y2y); g.lineTo(y3x, y3y); g.stroke();
    // tail (write cursor, solid) and head (read cursor, dashed) through the queue ring
    const at = A(qt, N), ah = A(qh, N);
    for (const [ang, dash] of [[at, false], [ah, true]] as const) {
      const [p0x, p0y] = polar(geom, ri - wi - 2, ang), [p1x, p1y] = polar(geom, ri + 7, ang);
      g.strokeStyle = pal.ink; g.lineWidth = 2; g.setLineDash(dash ? [3, 2] : []); g.beginPath(); g.moveTo(p0x, p0y); g.lineTo(p1x, p1y); g.stroke(); g.setLineDash([]);
    }
  }
  {
    const outer = spreadLabels([{ a: A(64, n), w: 16, t: 'HT', c: pal.inkMuted }, { a: A(0, n), w: 16, t: 'TC', c: pal.inkMuted }, { a: A(pos, n), w: 24, t: 'DMA', c: pal.ink }], ro + 13);
    for (const l of outer) { const [lx, ly] = polar(geom, ro + 13, l.a); text(g, l.t, lx, ly, mono12, l.c); }
    // the label of the cursor that is behind in clockwise order goes counter-clockwise, so that head == tail and a full queue stay legible
    const headBehind = (qt - qh + N) % N <= N / 2;
    const inner = spreadLabels([{ a: A(qt, N), w: 30, t: 'tail', c: pal.ink, side: headBehind ? 1 : -1 }, { a: A(qh, N), w: 30, t: 'head', c: pal.ink, side: headBehind ? -1 : 1 }], ri + 13);
    for (const l of inner) { const [lx, ly] = polar(geom, ri + 13, l.a); text(g, l.t, lx, ly, mono12, l.c); }
  }

  // ---- picked cells
  for (const [h, w] of [[view.sel, 2], [view.hover, 1]] as const) {
    if (!h) continue;
    const isD = h.ring === 'dma';
    cellPath(g, geom, isD ? ro : ri, isD ? wo : wi, h.idx, isD ? n : N, -1.2);
    g.strokeStyle = pal.ink; g.lineWidth = w; g.stroke();
  }

  // ---- centre: occupancy of the queue and one line of state
  const full = (qt + 1) % N === qh, empty = qt === qh;
  const fs = S < 240 ? 0.85 : 1;
  text(g, tx.ringCenterLabel, cx, cy - 26 * fs, mono(700, 12), pal.inkMuted);
  text(g, String(occ), cx - 2, cy - 2 * fs, mono(700, 28), pal.ink, 'right');
  text(g, '/' + cap, cx + 1, cy + 3 * fs, mono(400, 14), pal.inkMuted, 'left');
  let state = '';
  if (view.heldBytes > 0) state = tx.heldPending.replace('{n}', String(view.heldBytes));
  else if (sim.u.lastSpan && sim.u.lastSpan.spans === 2 && sim.lastPush && (sim.t - sim.lastPush.t1) / k < 1.4) state = tx.twoCopies;
  else if (full) state = 'tail + 1 == head';
  else if (empty) state = 'head == tail';
  if (state) text(g, state, cx, cy + 24 * fs, mono(400, 12), pal.ink);
}

// ============================================================================ read thread buffer: the last packet it received
export function drawBuf(g: CanvasRenderingContext2D, W: number, H: number, sim: Sim, pal: Palette): void {
  g.clearRect(0, 0, W, H);
  const cells = 32, per = Math.max(1, sim.P / cells), gap = 1, cw = (W - gap * (cells - 1)) / cells, R = sim.reader;
  const mine = sim.readerBuf;
  for (let c = 0; c < cells; c++) {
    const x = c * (cw + gap), m = mine.meta[Math.floor(c * per)];
    g.fillStyle = pal.sunken; g.fillRect(x, 0, cw, H);
    if (m >= 0) {
      g.globalAlpha = R.state === 'away' ? 0.4 : 1;
      g.fillStyle = chOf(pal, m); g.fillRect(x, 0, cw, H);
      if (Math.floor(c * per) + per >= sim.P) { g.globalAlpha = 0.4; g.fillStyle = pal.ink; g.fillRect(x, 0, cw, H); }
      g.globalAlpha = 1;
    }
  }
  g.strokeStyle = pal.line; g.lineWidth = 1; g.strokeRect(0.5, 0.5, W - 1, H - 1);
}

// ============================================================================ timeline: RX line (UART 8N1 + hex decode), interrupts, threads
export const STRIP = { H: 104, LM: 56, RM: 8 };
export type StripTexts = { laneIsr: string; laneThread: string; laneRead: string; laneWrite: string; caption: string; slow: string; held: string };
// bytes of the line shown across the strip: wide strips show about 44 bytes, narrow ones fewer so that the hex digits stay readable
export function stripSpanBytes(W: number): number { return clamp(Math.floor((W - STRIP.LM - STRIP.RM) / 17), 14, 44); }

export function drawStrip(g: CanvasRenderingContext2D, W: number, sim: Sim, pal: Palette, tx: StripTexts): void {
  const { H, LM, RM } = STRIP;
  g.clearRect(0, 0, W, H);
  const mono = (w: number, px: number): string => `${w} ${px}px ${pal.mono}`;
  const bu = sim.byteUs, spanB = stripSpanBytes(W), t1 = sim.t, t0 = t1 - spanB * bu;
  const X = (t: number): number => LM + ((t - t0) / (t1 - t0)) * (W - LM - RM);
  const rows = { rx: [20, 52] as [number, number], isr: [56, 72] as [number, number], th: [76, 92] as [number, number] };

  // caption row
  text(g, tx.caption, LM, 8, mono(400, 12), pal.inkMuted, 'left');
  text(g, tx.slow, W - RM, 8, mono(400, 12), pal.inkMuted, 'right');
  // lane names
  text(g, 'RX', 4, (rows.rx[0] + rows.rx[1]) / 2, mono(700, 12), pal.inkMuted, 'left');
  text(g, tx.laneIsr, 4, (rows.isr[0] + rows.isr[1]) / 2, mono(700, 12), pal.inkMuted, 'left');
  text(g, tx.laneThread, 4, (rows.th[0] + rows.th[1]) / 2, mono(700, 12), pal.inkMuted, 'left');
  // lane backgrounds and divisions
  g.fillStyle = pal.sunken;
  g.fillRect(LM, rows.rx[0], W - LM - RM, rows.rx[1] - rows.rx[0]);
  g.fillRect(LM, rows.isr[0], W - LM - RM, rows.isr[1] - rows.isr[0]);
  g.fillRect(LM, rows.th[0], W - LM - RM, rows.th[1] - rows.th[0]);
  g.strokeStyle = pal.line; g.lineWidth = 1;
  for (let i = 1; i < 8; i++) { const gx = Math.round(LM + (i * (W - LM - RM)) / 8) + 0.5; g.beginPath(); g.moveTo(gx, rows.rx[0]); g.lineTo(gx, rows.th[1]); g.stroke(); }

  // ---- RX: the bits as a digital trace (idle high), and below it the decoded byte in hex
  const yH = rows.rx[0] + 4, yL = rows.rx[0] + 14, yD0 = rows.rx[0] + 17, yD1 = rows.rx[1] - 1;
  const bytes: LineByte[] = [];
  for (const b of sim.bytes) { if (b.t0 > t1) break; if (b.t0 + bu < t0) continue; bytes.push(b); }
  const bitUs = bu / 10;
  g.strokeStyle = pal.ink; g.lineWidth = 1.5; g.beginPath();
  let lvl = 1;
  g.moveTo(X(t0), yH);
  for (const b of bytes) {
    for (let kk = 0; kk < 10; kk++) {
      const tb = b.t0 + kk * bitUs, l = kk === 0 ? 0 : kk === 9 ? 1 : (b.v >> (kk - 1)) & 1;
      if (tb > t1) break;
      if (l !== lvl) { const x = X(Math.max(t0, tb)); g.lineTo(x, lvl ? yH : yL); g.lineTo(x, l ? yH : yL); lvl = l; }
    }
  }
  g.lineTo(X(t1), lvl ? yH : yL); g.stroke();
  for (const b of bytes) {
    const xa = X(Math.max(t0, b.t0)), xe = b.t0 + bu, xb = X(Math.min(t1, xe));
    if (xb - xa < 1.5) continue;
    g.globalAlpha = 0.28; g.fillStyle = chOf(pal, b.m); g.fillRect(xa + 0.5, yD0, xb - xa - 1, yD1 - yD0); g.globalAlpha = 1;
    if (idxOf(b.m) === sim.P - 1) { g.fillStyle = pal.ink; g.fillRect(xa + 0.5, yD1 - 2, xb - xa - 1, 2); }
    if (b.noise) { g.fillStyle = pal.ink; g.fillRect(xa + 0.5, yD0, xb - xa - 1, yD1 - yD0); }
    if (xe <= t1 && xb - xa >= 15) text(g, hex2(b.v), (xa + xb) / 2, (yD0 + yD1) / 2 + 0.5, mono(400, 12), b.noise ? pal.onInk : pal.ink);
  }

  // ---- RX interrupts held off: the pending request waits, the lane is hatched from the moment the mask was set
  for (const ms of sim.maskSpans) {
    const a = Math.max(t0, ms.a), b = Math.min(t1, ms.b === null ? t1 : ms.b);
    if (b <= a) continue;
    const xa = X(a), xb = X(b);
    g.save(); g.beginPath(); g.rect(xa, rows.isr[0], xb - xa, rows.isr[1] - rows.isr[0]); g.clip();
    g.strokeStyle = pal.inkMuted; g.lineWidth = 1;
    for (let x = xa - (rows.isr[1] - rows.isr[0]); x < xb; x += 6) { g.beginPath(); g.moveTo(x, rows.isr[1]); g.lineTo(x + (rows.isr[1] - rows.isr[0]), rows.isr[0]); g.stroke(); }
    g.restore();
  }
  // ---- ISR and thread lanes
  g.font = mono(700, 12); g.textBaseline = 'middle'; g.textAlign = 'left';
  for (const bl of sim.blocks as Block[]) {
    if (bl.b < t0 || bl.a > t1) continue;
    const r = bl.row === 1 ? rows.isr : rows.th;
    const xa = Math.max(LM, X(bl.a)), xb = Math.min(W - RM, X(bl.b)), w = Math.max(2, xb - xa);
    const muted = bl.kind === 'write' || bl.kind === 'tx';
    g.globalAlpha = muted ? 0.55 : 1;
    g.fillStyle = bl.row === 1 || bl.kind === 'read' ? pal.ink : pal.inkMuted;
    g.fillRect(xa, r[0] + 1, w, r[1] - r[0] - 2);
    g.globalAlpha = 1;
    const lab = bl.row === 1 ? bl.label : bl.kind === 'read' ? tx.laneRead : tx.laneWrite;
    if (w > g.measureText(lab).width + 6) { g.fillStyle = bl.kind === 'write' || bl.kind === 'tx' ? pal.ink : pal.onInk; g.fillText(lab, xa + 3, (r[0] + r[1]) / 2 + 0.5); }
  }
  // interrupt requests as ticks above the ISR lane
  g.fillStyle = pal.ink;
  for (const mk of sim.marks) { if (mk.kind !== 'irq' || mk.t < t0 || mk.t > t1) continue; const x = Math.round(X(mk.t)); g.fillRect(x, rows.isr[0] - 3, 1, 3); }
  // "now": the byte arriving at the DMA
  const nx = Math.round(X(t1)) - 0.5;
  g.strokeStyle = pal.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(nx, rows.rx[0] - 2); g.lineTo(nx, rows.th[1] + 2); g.stroke();
  if (tx.held) text(g, tx.held, W - RM - 4, (rows.isr[0] + rows.isr[1]) / 2, mono(700, 12), pal.ink, 'right');
}

// ============================================================================ names for the state of the reader and of the port
export function phaseName(sim: Sim): string {
  const s = sim.u.port.state_;
  return PHN[GetPhase(s)] + (((s & EVENT_BIT) >>> 0) !== 0 ? '+EVENT' : '');
}
