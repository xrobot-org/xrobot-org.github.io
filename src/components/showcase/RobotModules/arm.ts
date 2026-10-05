/**
 * Runtime robot arm of the RobotModules widget: the drawing's moving part (<g data-arm> in robot-arm.svg) redrawn by the
 * same drawArm() (armRig.js) that exported it, at the pose of the teach motion (sim.ts armPoseAt over ARM_KEYS).
 *
 * drawArm() paints through the engine's `g` wrapper onto a canvas; here, as in the exporter (of which makeXR5 / Rec / makeG
 * are a port), a recording canvas collects the fills, strokes and texts, and they become SVG
 * markup with the colours of the current theme (TOKENS in armRig.js, both themes). The static file keeps the
 * same elements at the rest pose with theme variables, so the still frame and the first animated frame match.
 * Only loaded in the browser (dynamic import from index.tsx); nothing here touches the DOM at module level.
 */
import { ANCHORS, ARM_K, ARM_KEYS, TOKENS, loadArmBeat } from './armRig.js';
import type { ArmPose } from './sim';

export { ARM_KEYS };

type Theme = 'light' | 'dark';
type Pt = [number, number];
type Grad = { lg: true; p0: Pt; p1: Pt; stops: Array<[number, string]>; addColorStop?: (u: number, c: string) => void };
type El =
  | { t: 'fill'; d: string; fill: string | Grad; alpha: number }
  | { t: 'stroke'; d: string; stroke: string; lw: number; alpha: number; dash: number[]; cap: string; join: string }
  | { t: 'text'; text: string; x: number; y: number; tf: number[]; font: string; align: string; fill: string; alpha: number };

// ------------------------------------------------------------------ iso projection (same as w25.py)
const C = Math.cos(Math.PI / 6);
const PJ = (p: number[]): Pt => [(p[0] + p[1]) * C, (p[1] - p[0]) / 2 - (p[2] || 0)];
const depth = (p: number[]) => p[1] - p[0] + (p[2] || 0);
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

// ------------------------------------------------------------------ XR5 stub: enough engine for the beat to load and draw
/* eslint-disable @typescript-eslint/no-explicit-any */
function makeXR5(theme: { v: Theme }): any {
  const T = () => (TOKENS as Record<Theme, Record<string, string>>)[theme.v];
  const noop = () => {};
  const callable = (): any =>
    new Proxy(function () {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : callable()), apply: () => callable() });
  const base: Record<string, any> = {
    proto: {},
    m: {
      clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
      lerp: (a: number, b: number, t: number) => a + (b - a) * t,
      sm: (a: number, b: number, t: number) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); },
      ease: (t: number) => t * t * (3 - 2 * t),
    },
    iso: { PJ, C, depth, add: (a: number[], b: number[]) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a: number[], k: number) => [a[0] * k, a[1] * k, a[2] * k], sub },
    tok: (n: string) => { const v = T()[n]; if (v === undefined) throw new Error('token ' + n); return v; },
    mat: (m: string) => [T()['m-' + m], T()['m-' + m + '-l'], T()['m-' + m + '-f']],
    theme: () => theme.v,
    anchor: (n: string) => { const a = (ANCHORS as Record<string, number[]>)[n]; if (!a) throw new Error('anchor ' + n); return a.slice(); },
    clock: { t: 0, te: 0 }, reduced: () => true,
    rand: () => () => 0.5, cyc: () => ({ u: 0, n: 0 }),
    idle: noop, on: noop, beat: noop, store: { touch: noop, state: { beats: {} } }, h: () => callable(),
    fmt: { num: String }, R: {}, XR: { VIEW: { vx: 0, vy: 0, k: 1 } },
  };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k as string] : callable()) });
}
const stubDocument = { createElement: () => ({ style: {}, getContext: () => null, appendChild() {} }), head: { appendChild() {} } };

// ------------------------------------------------------------------ recording canvas: canvas 2D calls -> element list
type M6 = [number, number, number, number, number, number];
function mulM(a: M6, b: M6): M6 {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
type RecState = { tf: M6; fillStyle: any; strokeStyle: any; lineWidth: number; globalAlpha: number; dash: number[]; lineCap: string; lineJoin: string; font: string; textAlign: string; textBaseline: string };
class Rec {
  els: El[] = [];
  s: RecState = { tf: [1, 0, 0, 1, 0, 0], fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1, dash: [], lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic' };
  stack: RecState[] = [];
  path: Array<{ pts: Pt[]; closed: boolean }> = [];
  cur: Pt[] | null = null;
  _t(x: number, y: number): Pt { const m = this.s.tf; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  _sc() { const m = this.s.tf; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); }
  save() { this.stack.push({ ...this.s, dash: this.s.dash.slice() }); }
  restore() { const s = this.stack.pop(); if (s) this.s = s; }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.s.tf = [a, b, c, d, e, f]; }
  transform(a: number, b: number, c: number, d: number, e: number, f: number) { this.s.tf = mulM(this.s.tf, [a, b, c, d, e, f]); }
  translate(x: number, y: number) { this.transform(1, 0, 0, 1, x, y); }
  scale(x: number, y: number) { this.transform(x, 0, 0, y, 0, 0); }
  rotate(a: number) { this.transform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0); }
  beginPath() { this.path = []; this.cur = null; }
  moveTo(x: number, y: number) { this.cur = [this._t(x, y)]; this.path.push({ pts: this.cur, closed: false }); }
  lineTo(x: number, y: number) { if (!this.cur) { this.moveTo(x, y); return; } this.cur.push(this._t(x, y)); }
  closePath() { if (this.path.length) this.path[this.path.length - 1].closed = true; this.cur = null; }
  arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw?: boolean) {
    let d = a1 - a0;
    if (!ccw && d < 0) d += Math.PI * 2;
    if (ccw && d > 0) d -= Math.PI * 2;
    if (Math.abs(a1 - a0) >= Math.PI * 2 - 1e-9) d = ccw ? -Math.PI * 2 : Math.PI * 2;
    const n = Math.max(8, Math.ceil(Math.abs(d) / (Math.PI / 18)));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (d * i) / n, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0 && this.cur) this.lineTo(x, y); else if (i === 0) this.moveTo(x, y); else this.lineTo(x, y);
    }
  }
  rect(x: number, y: number, w: number, h: number) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
  setLineDash(d: number[]) { this.s.dash = d.slice(); }
  getLineDash() { return this.s.dash.slice(); }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Grad {
    const g: Grad = { lg: true, p0: this._t(x0, y0), p1: this._t(x1, y1), stops: [] };
    g.addColorStop = (u, c) => { g.stops.push([u, c]); };
    return g;
  }
  measureText(t: string) { return { width: String(t).length * 6 }; }
  clip() {}
  clearRect() {}
  drawImage() {}
  fillRect(x: number, y: number, w: number, h: number) { this.beginPath(); this.rect(x, y, w, h); this.fill(); }
  strokeRect(x: number, y: number, w: number, h: number) { this.beginPath(); this.rect(x, y, w, h); this.stroke(); }
  _d() { return this.path.filter((p) => p.pts.length > 1).map((p) => 'M' + p.pts.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + (p.closed ? 'Z' : '')).join(''); }
  fill() { const d = this._d(); if (d) this.els.push({ t: 'fill', d, fill: this.s.fillStyle, alpha: this.s.globalAlpha }); }
  stroke() {
    const d = this._d();
    if (d) this.els.push({ t: 'stroke', d, stroke: this.s.strokeStyle, lw: this.s.lineWidth * this._sc(), alpha: this.s.globalAlpha, dash: this.s.dash.map((v) => v * this._sc()), cap: this.s.lineCap, join: this.s.lineJoin });
  }
  fillText(text: string, x: number, y: number) { this.els.push({ t: 'text', text: String(text), x, y, tf: this.s.tf.slice(), font: this.s.font, align: this.s.textAlign, fill: this.s.fillStyle, alpha: this.s.globalAlpha }); }
  set fillStyle(v: any) { this.s.fillStyle = v; } get fillStyle() { return this.s.fillStyle; }
  set strokeStyle(v: any) { this.s.strokeStyle = v; } get strokeStyle() { return this.s.strokeStyle; }
  set lineWidth(v: number) { this.s.lineWidth = v; } get lineWidth() { return this.s.lineWidth; }
  set globalAlpha(v: number) { this.s.globalAlpha = v; } get globalAlpha() { return this.s.globalAlpha; }
  set lineCap(v: string) { this.s.lineCap = v; } get lineCap() { return this.s.lineCap; }
  set lineJoin(v: string) { this.s.lineJoin = v; } get lineJoin() { return this.s.lineJoin; }
  set font(v: string) { this.s.font = v; } get font() { return this.s.font; }
  set textAlign(v: string) { this.s.textAlign = v; } get textAlign() { return this.s.textAlign; }
  set textBaseline(v: string) { this.s.textBaseline = v; } get textBaseline() { return this.s.textBaseline; }
}

// the engine's g wrapper (world units; k = canvas scale, so lw / k is one screen pixel)
function makeG(k: number) {
  const x = new Rec();
  const path = (pts: Pt[], closed: boolean) => { x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); if (closed) x.closePath(); };
  const draw = (pts: Pt[], o: any, closed: boolean) => {
    o = o || {};
    x.save();
    if (o.alpha !== undefined && o.alpha !== null) x.globalAlpha = o.alpha;
    path(pts, closed);
    if (o.fill) { x.fillStyle = o.fill; x.fill(); }
    if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = (o.lw === undefined ? 1 : o.lw) / k; x.lineJoin = o.join || 'round'; x.lineCap = o.cap || 'butt'; x.stroke(); }
    x.restore();
  };
  return {
    ctx: x, k, px: (n: number) => n / k,
    poly(pts: Pt[], o: any) { draw(pts, o, true); },
    polyline(pts: Pt[], o: any) { draw(pts, { ...o, fill: null }, false); },
    line(a: Pt, b: Pt, o: any) { draw([a, b], { ...o, fill: null }, false); },
    circle(p: Pt, r: number, o: any) {
      o = o || {};
      x.save();
      if (o.alpha !== undefined) x.globalAlpha = o.alpha;
      x.beginPath(); x.arc(p[0], p[1], r, 0, Math.PI * 2); x.closePath();
      if (o.fill) { x.fillStyle = o.fill; x.fill(); }
      if (o.stroke) { x.strokeStyle = o.stroke; x.lineWidth = (o.lw || 1) / k; x.stroke(); }
      x.restore();
    },
    rect(x0: number, y0: number, w: number, h: number, o: any) { draw([[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]], o, true); },
    packet() {}, hit() {}, occlude() {}, cached(_key: string, _bb: unknown, fn: (g: unknown) => void) { fn(this); },
  };
}

// ------------------------------------------------------------------ recorded elements -> svg markup (export_svg.py rec_svg, literal colours)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, "'");
function markup(els: El[]): string {
  const out: string[] = [];
  const defs: string[] = [];
  for (const a of els) {
    const al = a.alpha < 0.999 ? ` opacity="${+a.alpha.toPrecision(3)}"` : '';
    if (a.t === 'fill') {
      let fill: string;
      if (typeof a.fill === 'object') {
        const id = `xr-arm-g${defs.length}`;
        const stops = a.fill.stops.map(([u, c]) => `<stop offset="${u.toFixed(3)}" style="stop-color:${c}"/>`).join('');
        defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${a.fill.p0[0].toFixed(1)}" y1="${a.fill.p0[1].toFixed(1)}" x2="${a.fill.p1[0].toFixed(1)}" y2="${a.fill.p1[1].toFixed(1)}">${stops}</linearGradient>`);
        fill = `url(#${id})`;
      } else fill = a.fill;
      out.push(`<path d="${a.d}" style="fill:${fill}"${al}/>`);
    } else if (a.t === 'stroke') {
      const dash = a.dash.length ? `;stroke-dasharray:${a.dash.map((v) => v.toFixed(2)).join(' ')}` : '';
      out.push(`<path d="${a.d}" style="fill:none;stroke:${a.stroke};stroke-width:${a.lw.toFixed(2)};stroke-linecap:${a.cap};stroke-linejoin:${a.join}${dash};vector-effect:none"${al}/>`);
    } else {
      const anchor = a.align === 'center' ? 'middle' : a.align === 'right' || a.align === 'end' ? 'end' : 'start';
      out.push(`<text transform="matrix(${a.tf.map((v) => v.toFixed(4)).join(',')})" x="${a.x.toFixed(2)}" y="${a.y.toFixed(2)}" text-anchor="${anchor}" style="font:${esc(a.font)};fill:${a.fill}"${al}>${esc(a.text)}</text>`);
    }
  }
  return (defs.length ? `<defs>${defs.join('')}</defs>` : '') + out.join('');
}

// ------------------------------------------------------------------ the rig: one beat instance, drawn at any pose
export type ArmRig = { draw(pose: ArmPose, theme: Theme): string };

export function createArmRig(): ArmRig {
  const theme = { v: 'light' as Theme };
  const X = loadArmBeat(makeXR5(theme), stubDocument);
  X.resetSim();
  return {
    draw(pose, th) {
      theme.v = th;
      X.SIM.q = pose.q.map((d) => (d * Math.PI) / 180);
      X.SIM.grip = pose.grip;
      const g = makeG(ARM_K);
      X.drawArm(g, { s: { step: -1, sel: 0, load: 0, mode: 'imp' }, lod: 0 });
      return markup(g.ctx.els);
    },
  };
}
