/* TopicFanout canvas drawing. Reads the simulations (sim.ts) and never changes them. Flat 2D, XRobot Style: right angles,
   1 px lines, no shadow, no gradient; colours come from the CSS variables, the four channel colours only colour data (the
   message's sequence number mod 4, so one message keeps its colour in the original, the copies, the slot and the descriptors).
   Sizes are CSS pixels; the caller scales the canvas for devicePixelRatio. */
import { TP, SP, AS, WS, type TopicSim, type SharedSim, type Lane, type Result, type Sub } from './sim';

export type Palette = {
  ink: string; inkMuted: string; onInk: string; raised: string; sunken: string; line: string; lineStrong: string; ch: string[]; mono: string; sans: string;
};
export function readPalette(el: Element): Palette {
  const cs = getComputedStyle(el);
  const v = (n: string): string => cs.getPropertyValue(n).trim();
  return {
    ink: v('--ink'), inkMuted: v('--ink-muted'), onInk: v('--on-ink'), raised: v('--paper-raised'), sunken: v('--paper-sunken'),
    line: v('--line'), lineStrong: v('--line-strong'), ch: [v('--ch0'), v('--ch1'), v('--ch2'), v('--ch3')],
    mono: v('--font-mono') || 'monospace', sans: v('--font-sans') || 'sans-serif',
  };
}

export type CanvasTexts = {
  pubThread: string; original: string; listTitle: string; walk: string; legend: string;
  lane: Record<Lane, string>; api: Record<Lane, string>;
  syncWait: string; syncClaimed: string; syncWork: string; asyncWaiting: string; asyncReady: string; asyncIdle: string; queueFill: string; cbState: string;
  resCopy: string; resMiss: string; resIgnoreIdle: string; resIgnoreReady: string; resDrop: string; resRun: string; readsOriginal: string;
  pubProc: string; write: string; shm: string; slotFree: string; freeQueue: string;
  subWait: string; subRead: string; subWake: string; desc: string; dropOld: string; pubFail: string; noSlot: string;
};

const clamp = (x: number, a: number, b: number): number => Math.min(b, Math.max(a, x));
const ease = (x: number): number => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };
const fmt = (tpl: string, vars: Record<string, string | number>): string => tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));
export const fmtBytes = (n: number): string => (n >= 1024 ? `${+(n / 1024).toFixed(n % 1024 ? 1 : 0)} KB` : `${n} B`);
const hex4 = (v: number): string => '0x' + v.toString(16).toUpperCase().padStart(4, '0');

// ============================================================================ geometry
const PAD = 12, LANE_H = 62, LANE_GAP = 8, WIDE = 540;
type Box = { x: number; y: number; w: number; h: number };
export type TopicGeom = { W: number; wide: boolean; pub: Box; orig: Box; hubX: number; hubTop: number; lanes: Box[] };
export function topicGeom(W: number): TopicGeom {
  const wide = W >= WIDE;
  const lanesH = 4 * LANE_H + 3 * LANE_GAP;
  if (wide) {
    const top = 30, pubW = Math.round(clamp(W * 0.24, 132, 190));
    const pub = { x: PAD, y: top, w: pubW, h: lanesH };
    const hubX = PAD + pubW + 30, lx = hubX + 16;
    const lanes = [0, 1, 2, 3].map((i) => ({ x: lx, y: top + i * (LANE_H + LANE_GAP), w: W - PAD - lx, h: LANE_H }));
    const ow = pubW - 24, oh = 64;
    return { W, wide, pub, orig: { x: pub.x + 12, y: pub.y + 64, w: ow, h: oh }, hubX, hubTop: top - 12, lanes };
  }
  const pub = { x: PAD, y: PAD, w: W - 2 * PAD, h: 64 };
  const top = pub.y + pub.h + 30, hubX = PAD + 8, lx = PAD + 24;
  const lanes = [0, 1, 2, 3].map((i) => ({ x: lx, y: top + i * (LANE_H + LANE_GAP), w: W - PAD - lx, h: LANE_H }));
  const ow = Math.min(150, Math.round(pub.w * 0.42));
  return { W, wide, pub, orig: { x: pub.x + pub.w - ow - 8, y: pub.y + 8, w: ow, h: pub.h - 16 }, hubX, hubTop: pub.y + pub.h, lanes };
}
export type SharedGeom = { W: number; wide: boolean; pub: Box; shm: Box; slots: Box[]; freeY: number; subs: Box[]; gutter: number };
// wide: the slots are one column, so the line from each reading process reaches its slot without crossing another slot
const SLOT_H = 26, SLOT_GAP = 4;
export function sharedGeom(W: number): SharedGeom {
  const wide = W >= WIDE;
  if (wide) {
    const top = 30, H = 26 + SP.slots * (SLOT_H + SLOT_GAP) + 22;
    const pubW = Math.round(clamp(W * 0.2, 124, 170)), subW = Math.round(clamp(W * 0.3, 168, 230));
    const pub = { x: PAD, y: top, w: pubW, h: H };
    const sx = W - PAD - subW, sh = (H - 2 * LANE_GAP) / 3;
    const subs = [0, 1, 2].map((i) => ({ x: sx, y: top + i * (sh + LANE_GAP), w: subW, h: sh }));
    const x0 = PAD + pubW + 30, x1 = sx - 30;
    const slots = Array.from({ length: SP.slots }, (_, k) => ({ x: x0, y: top + 26 + k * (SLOT_H + SLOT_GAP), w: x1 - x0, h: SLOT_H }));
    return { W, wide, pub, shm: { x: x0 - 8, y: top, w: x1 - x0 + 16, h: H }, slots, freeY: top + H - 14, subs, gutter: x1 + 8 };
  }
  const pub = { x: PAD, y: PAD, w: W - 2 * PAD, h: 56 };
  const x0 = PAD + 8, x1 = W - PAD - 8, gap = 4, sw = (x1 - x0 - (SP.slots - 1) * gap) / SP.slots, shH = 44;
  const shmY = pub.y + pub.h + 22, gy = shmY + 26;
  const slots = Array.from({ length: SP.slots }, (_, k) => ({ x: x0 + k * (sw + gap), y: gy, w: sw, h: shH }));
  const freeY = gy + shH + 34;
  const shm = { x: PAD, y: shmY, w: W - 2 * PAD, h: freeY + 14 - shmY };
  const sy = shm.y + shm.h + LANE_GAP, sh = 60;
  const subs = [0, 1, 2].map((i) => ({ x: PAD, y: sy + i * (sh + LANE_GAP), w: W - 2 * PAD, h: sh }));
  return { W, wide, pub, shm, slots, freeY, subs, gutter: 0 };
}
export function canvasHeight(W: number): number {
  const t = topicGeom(W), s = sharedGeom(W);
  const tb = t.lanes[3].y + t.lanes[3].h, sb = Math.max(s.subs[2].y + s.subs[2].h, s.pub.y + s.pub.h);
  return Math.ceil(Math.max(tb, sb) + PAD);
}

// ============================================================================ primitives
function strokeRect(g: CanvasRenderingContext2D, b: Box, color: string, w = 1): void {
  g.strokeStyle = color; g.lineWidth = w;
  const o = w % 2 ? 0.5 : 0;
  g.strokeRect(Math.round(b.x) + o, Math.round(b.y) + o, Math.round(b.w) - (w % 2 ? 1 : 0), Math.round(b.h) - (w % 2 ? 1 : 0));
}
function fillRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha = 1): void {
  g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); g.globalAlpha = 1;
}
function line(g: CanvasRenderingContext2D, pts: number[][], color: string, w = 1): void {
  g.strokeStyle = color; g.lineWidth = w; g.beginPath();
  pts.forEach(([x, y], i) => { const px = Math.round(x) + 0.5, py = Math.round(y) + 0.5; if (i) g.lineTo(px, py); else g.moveTo(px, py); });
  g.stroke();
}
type TextOpt = { font?: 'sans' | 'mono'; size?: number; weight?: number; color?: string; align?: CanvasTextAlign; max?: number };
function text(g: CanvasRenderingContext2D, pal: Palette, s: string, x: number, y: number, o: TextOpt = {}): number {
  g.font = `${o.weight || 400} ${o.size || 12}px ${o.font === 'mono' ? pal.mono : pal.sans}`;
  g.fillStyle = o.color || pal.ink; g.textAlign = o.align || 'left'; g.textBaseline = 'middle';
  let str = s;
  if (o.max && g.measureText(str).width > o.max) {
    while (str.length > 1 && g.measureText(str + '…').width > o.max) str = str.slice(0, -1);
    str += '…';
  }
  g.fillText(str, x, y);
  return g.measureText(str).width;
}
const measure = (g: CanvasRenderingContext2D, pal: Palette, s: string, o: TextOpt = {}): number => {
  g.font = `${o.weight || 400} ${o.size || 12}px ${o.font === 'mono' ? pal.mono : pal.sans}`; return g.measureText(s).width;
};
// a message block: its colour is the sequence number mod 4, its size follows the payload size
const blockSize = (bytes: number): number => (bytes > 64 ? 22 : 12);
function msgBlock(g: CanvasRenderingContext2D, pal: Palette, cx: number, cy: number, seq: number, bytes: number, alpha = 1): void {
  const s = blockSize(bytes);
  fillRect(g, cx - s / 2, cy - s / 2, s, s, pal.ch[seq & 3], alpha);
  if (bytes > 64 && alpha > 0.5) { // a 1 KB block shows rows of samples
    g.globalAlpha = 0.45 * alpha; g.fillStyle = pal.ink;
    for (let r = 0; r < 4; r += 1) g.fillRect(Math.round(cx - s / 2 + 3), Math.round(cy - s / 2 + 4 + r * 4), s - 6, 1);
    g.globalAlpha = 1;
  }
}
function tag(g: CanvasRenderingContext2D, pal: Palette, s: string, xr: number, cy: number, strong: boolean, maxW: number): void {
  const w = Math.min(maxW, measure(g, pal, s, { size: 11, weight: 700 }) + 12);
  const b = { x: xr - w, y: cy - 10, w, h: 20 };
  if (strong) { fillRect(g, b.x, b.y, b.w, b.h, pal.ink); text(g, pal, s, b.x + 6, cy + 0.5, { size: 11, weight: 700, color: pal.onInk, max: w - 10 }); }
  else { strokeRect(g, b, pal.lineStrong); text(g, pal, s, b.x + 6, cy + 0.5, { size: 11, weight: 700, color: pal.inkMuted, max: w - 10 }); }
}

// ============================================================================ in-process Topic
const LANES: Lane[] = ['callback', 'sync', 'async', 'queue'];
const CELL = 26, CGAP = 4;
function receptacle(G: TopicGeom, i: number, lane: Lane, slot = 0): { x: number; y: number } {
  const b = G.lanes[i], cy = b.y + 21;
  if (lane === 'queue') { const n = TP.queueCap, x0 = b.x + b.w - 10 - n * CELL - (n - 1) * CGAP; return { x: x0 + slot * (CELL + CGAP) + CELL / 2, y: cy }; }
  return { x: b.x + b.w - 10 - CELL / 2, y: cy };
}
function resultText(r: Result, tx: CanvasTexts): string {
  switch (r.kind) {
    case 'copy': return fmt(tx.resCopy, { b: fmtBytes(r.bytes) });
    case 'miss': return tx.resMiss;
    case 'ignore': return r.state === AS.DATA_READY ? tx.resIgnoreReady : tx.resIgnoreIdle;
    case 'drop': return tx.resDrop;
    default: return tx.resRun;
  }
}

// colour key at the bottom of the publisher box: the colour is the message's sequence number mod 4
function legend(g: CanvasRenderingContext2D, pal: Palette, tx: CanvasTexts, P: Box): void {
  const y = P.y + P.h - 16;
  text(g, pal, tx.legend, P.x + 12, y - 18, { size: 11, color: pal.inkMuted, max: P.w - 20 });
  for (let i = 0; i < 4; i += 1) { fillRect(g, P.x + 12 + i * 22, y - 5, 10, 10, pal.ch[i]); text(g, pal, String(i), P.x + 25 + i * 22, y + 0.5, { font: 'mono', size: 10, color: pal.inkMuted }); }
}
export function drawTopic(g: CanvasRenderingContext2D, W: number, H: number, s: TopicSim, pal: Palette, tx: CanvasTexts): void {
  g.clearRect(0, 0, W, H);
  const G = topicGeom(W), t = s.t, D = s.dispatch;
  const cur = s.cursor();
  const recent = (kind: string, lane: Lane, life: number) => {
    for (let i = s.events.length - 1; i >= 0; i -= 1) { const e = s.events[i]; if (t - e.t > life) break; if (e.kind === kind && e.lane === lane) return e; }
    return null;
  };

  // ---- publisher and its own object (the original)
  const P = G.pub, O = G.orig;
  strokeRect(g, P, D ? pal.ink : pal.lineStrong);
  if (G.wide) {
    text(g, pal, tx.pubThread, P.x + 12, P.y + 18, { weight: 700, size: 13, max: P.w - 20 });
    text(g, pal, 'topic.Publish(data)', P.x + 12, P.y + 40, { font: 'mono', size: 11, color: pal.inkMuted, max: P.w - 20 });
  } else {
    text(g, pal, tx.pubThread, P.x + 10, P.y + 20, { weight: 700, size: 13, max: P.w - O.w - 30 });
    text(g, pal, 'Publish(data)', P.x + 10, P.y + 42, { font: 'mono', size: 11, color: pal.inkMuted, max: P.w - O.w - 30 });
  }
  const cbRead = recent('read', 'callback', 0.9);
  strokeRect(g, O, cbRead ? pal.ink : pal.line, cbRead ? 2 : 1);
  const oseq = s.original.seq;
  text(g, pal, tx.original, O.x + 8, O.y + 13, { size: 11, weight: 700, color: pal.inkMuted, max: O.w - 16 });
  text(g, pal, fmtBytes(s.bytes), O.x + O.w - 8, O.y + 13, { font: 'mono', size: 11, color: pal.inkMuted, align: 'right' });
  if (oseq > 0) {
    const bs = blockSize(s.bytes);
    msgBlock(g, pal, O.x + 8 + bs / 2, O.y + O.h - 8 - bs / 2, oseq, s.bytes);
    text(g, pal, `#${oseq}`, O.x + 16 + bs, O.y + O.h - 8 - bs / 2 - (G.wide ? 7 : 0), { font: 'mono', size: 11, weight: 700 });
    if (G.wide) text(g, pal, hex4(s.original.v), O.x + 16 + bs, O.y + O.h - 8 - bs / 2 + 8, { font: 'mono', size: 11, color: pal.inkMuted });
  }
  if (G.wide) {
    const yb = O.y + O.h + 20;
    text(g, pal, `Topic · ${s.topic.name}`, P.x + 12, yb, { font: 'mono', size: 11, color: pal.inkMuted, max: P.w - 20 });
    text(g, pal, `busy = ${s.topic.busy ? 'LOCKED' : 'UNLOCKED'}`, P.x + 12, yb + 18, { font: 'mono', size: 11, color: s.topic.busy ? pal.ink : pal.inkMuted, weight: s.topic.busy ? 700 : 400, max: P.w - 20 });
    if (s.pending > 0) text(g, pal, `+${s.pending}`, P.x + P.w - 12, P.y + 18, { font: 'mono', size: 11, weight: 700, align: 'right' });
    legend(g, pal, tx, P);
  }

  // ---- the subscriber list (LockFreeList, walked from the head)
  const ys = G.lanes.map((b) => b.y + b.h / 2);
  if (G.wide) {
    text(g, pal, tx.listTitle, G.hubX - 6, G.hubTop, { size: 11, weight: 700, color: pal.inkMuted });
    const wt = measure(g, pal, tx.listTitle, { size: 11, weight: 700 });
    text(g, pal, tx.walk, G.hubX + wt + 6, G.hubTop, { size: 11, color: pal.inkMuted, max: W - G.hubX - wt - 20 });
    line(g, [[P.x + P.w, ys[0]], [G.hubX, ys[0]]], D ? pal.ink : pal.lineStrong);
  } else {
    text(g, pal, tx.listTitle, G.hubX, G.hubTop + 15, { size: 11, weight: 700, color: pal.inkMuted });
    const wt = measure(g, pal, tx.listTitle, { size: 11, weight: 700 });
    text(g, pal, tx.walk, G.hubX + wt + 8, G.hubTop + 15, { size: 11, color: pal.inkMuted, max: W - G.hubX - wt - 20 });
  }
  line(g, [[G.hubX, G.wide ? ys[0] : G.hubTop], [G.hubX, ys[3]]], pal.lineStrong);
  for (let i = 0; i < 4; i += 1) {
    line(g, [[G.hubX, ys[i]], [G.lanes[i].x, ys[i]]], pal.lineStrong);
    fillRect(g, G.hubX - 3, ys[i] - 3, 7, 7, pal.raised); strokeRect(g, { x: G.hubX - 3, y: ys[i] - 3, w: 7, h: 7 }, pal.ink);
  }
  if (D && cur >= -0.5) { // the walk: a cursor moving down the list, one node per step
    const f = clamp(cur, 0, 3), i0 = Math.floor(f), y = ys[i0] + (ys[Math.min(3, i0 + 1)] - ys[i0]) * ease(f - i0);
    fillRect(g, G.hubX - 5, y - 5, 11, 11, pal.ink);
  }

  // ---- the four subscribers, in list order
  s.order.forEach((n, i) => {
    const lane = n.id, b = G.lanes[i];
    const visiting = D && cur >= i - 0.15 && cur < i + 0.85;
    strokeRect(g, b, visiting ? pal.ink : pal.line, visiting ? 2 : 1);
    const nameW = text(g, pal, tx.lane[lane], b.x + 10, b.y + 21, { weight: 700, size: 13 });
    const recW = lane === 'queue' ? TP.queueCap * CELL + (TP.queueCap - 1) * CGAP : lane === 'callback' ? 0 : CELL;
    const apiMax = b.w - 30 - nameW - recW - 10;
    if (apiMax > 60) text(g, pal, tx.api[lane], b.x + 18 + nameW, b.y + 21, { font: 'mono', size: 11, color: pal.inkMuted, max: apiMax });

    // state, as the source names it
    let st = '';
    if (lane === 'sync') st = n.wait_state === WS.WAITING ? tx.syncWait : n.wait_state === WS.WAIT_CLAIMED ? tx.syncClaimed : tx.syncWork;
    else if (lane === 'async') st = n.state === AS.WAITING ? tx.asyncWaiting : n.state === AS.DATA_READY ? tx.asyncReady : tx.asyncIdle;
    else if (lane === 'queue') st = fmt(tx.queueFill, { n: s.q.Size(), cap: s.q.MaxSize() });
    else st = tx.cbState;

    // result of the latest publish that reached this subscriber (kept while it is the latest)
    const r = s.lane[lane];
    // ... until the subscriber itself moves on (the sync thread calls Wait() again, the async consumer takes or re-registers)
    const movedOn = r && s.events.some((e) => e.lane === lane && e.t > r.t && (e.kind === 'wait' || e.kind === 'take' || e.kind === 'raise'));
    const rShow = r && !movedOn && (!D || r.seq === D.seq) && t - r.t < TP.period * 1.6;
    const rTxt = rShow ? resultText(r!, tx) : '';
    const rW = rTxt ? Math.min(b.w * 0.55, measure(g, pal, rTxt, { size: 11, weight: 700 }) + 12) : 0;
    text(g, pal, st, b.x + 10, b.y + 44, { size: 12, color: pal.inkMuted, max: b.w - 30 - rW });
    if (rShow) tag(g, pal, rTxt, b.x + b.w - 10, b.y + 44, r!.kind === 'copy' || r!.kind === 'run', b.w * 0.55);

    // receptacles: the sync subscriber's object, the async buffer, the queue's elements
    const flying = (seq: number) => { const e = recent('flight', lane, TP.flight); return !!e && e.seq === seq; };
    if (lane === 'sync' || lane === 'async') {
      const c = receptacle(G, i, lane), p = n.buff_addr!;
      const box = { x: c.x - CELL / 2, y: c.y - CELL / 2, w: CELL, h: CELL };
      strokeRect(g, box, pal.lineStrong);
      const live = lane === 'sync' ? p.seq > 0 : n.state === AS.DATA_READY;
      if (p.seq > 0 && !flying(p.seq)) msgBlock(g, pal, c.x, c.y, p.seq, p.bytes, live ? 1 : 0.3);
      const took = lane === 'sync' ? recent('wake', 'sync', 0.6) : recent('take', 'async', 0.6);
      if (took) strokeRect(g, { x: box.x - 3, y: box.y - 3, w: box.w + 6, h: box.h + 6 }, pal.ink);
    } else if (lane === 'queue') {
      const items = s.q.items();
      for (let k = 0; k < TP.queueCap; k += 1) {
        const c = receptacle(G, i, lane, k);
        strokeRect(g, { x: c.x - CELL / 2, y: c.y - CELL / 2, w: CELL, h: CELL }, pal.lineStrong);
        const it = items[k];
        if (it && !flying(it.seq)) msgBlock(g, pal, c.x, c.y, it.seq, it.bytes);
      }
      if (recent('pop', 'queue', 0.5)) { const c = receptacle(G, i, lane, 0); line(g, [[c.x - CELL / 2 - 4, c.y - CELL / 2], [c.x - CELL / 2 - 4, c.y + CELL / 2]], pal.ink, 2); }
    } else {
      // the callback: Run() gets the publisher's own object; drawn as a line back to the original
      if (cbRead) {
        if (G.wide) { // right angles: out of the original, up the gap beside the publisher, into the callback
          const oy = O.y + O.h / 2, gx = P.x + P.w + 12, ly = b.y + 12;
          line(g, [[O.x + O.w, oy], [gx, oy], [gx, ly], [b.x, ly]], pal.ink, 2);
        } else {
          const x = O.x + O.w / 2;
          line(g, [[x, O.y + O.h], [x, b.y]], pal.ink, 2);
        }
        text(g, pal, tx.readsOriginal, b.x + b.w - 10, b.y + 21, { size: 11, weight: 700, align: 'right' });
      }
    }
  });

  // ---- copies in flight: from the original to the subscriber's own storage
  for (let i = s.events.length - 1; i >= 0; i -= 1) {
    const e = s.events[i];
    if (t - e.t > TP.flight) break;
    if (e.kind !== 'flight') continue;
    const li = LANES.indexOf(e.lane), idx = s.order.findIndex((n) => n.id === e.lane);
    if (li < 0 || idx < 0) continue;
    const slot = e.lane === 'queue' ? Math.max(0, s.q.items().findIndex((p) => p.seq === e.seq)) : 0;
    const to = receptacle(G, idx, e.lane, slot);
    const bs = blockSize(e.bytes), from = { x: O.x + 8 + bs / 2, y: O.y + O.h - 8 - bs / 2 };
    const u = ease((t - e.t) / TP.flight);
    msgBlock(g, pal, from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u, e.seq, e.bytes);
  }
}

// ============================================================================ LinuxSharedTopic
function ringCells(B: Box, wide: boolean): { x: number; y: number; w: number } {
  const w = 30;
  return wide ? { x: B.x + 10 + 0, y: B.y + B.h - 22, w } : { x: B.x + B.w - 10 - 3 * w - 2 * 4, y: B.y + B.h - 22, w };
}
export function drawShared(g: CanvasRenderingContext2D, W: number, H: number, s: SharedSim, pal: Palette, tx: CanvasTexts, names: string[]): void {
  g.clearRect(0, 0, W, H);
  const G = sharedGeom(W), t = s.t;
  const recent = (kind: string, pred: (e: SharedSim['events'][number]) => boolean, life: number) => {
    for (let i = s.events.length - 1; i >= 0; i -= 1) { const e = s.events[i]; if (t - e.t > life) break; if (e.kind === kind && pred(e)) return e; }
    return null;
  };
  const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

  // ---- publisher process
  const P = G.pub, wr = s.writing;
  strokeRect(g, P, wr ? pal.ink : pal.lineStrong);
  const created = recent('create', () => true, 99);
  const pushed = s.lastPub && t - s.lastPub.t < 0.6 ? s.lastPub : null;
  const steps = [
    { label: 'CreateData(data)', on: !!wr && t - (wr.t1 - SP.write) < 0.18 },
    { label: wr ? fmt(tx.write, { k: wr.k }) : fmt(tx.write, { k: created && created.k >= 0 ? created.k : 0 }), on: !!wr },
    { label: 'Publish(data)', on: !!pushed },
  ];
  if (G.wide) {
    text(g, pal, tx.pubProc, P.x + 12, P.y + 18, { weight: 700, size: 13, max: P.w - 20 });
    steps.forEach((st, i) => text(g, pal, st.label, P.x + 12, P.y + 48 + i * 20, { font: i === 1 ? 'sans' : 'mono', size: 11, weight: st.on ? 700 : 400, color: st.on ? pal.ink : pal.inkMuted, max: P.w - 20 }));
    const fl = recent('fail', () => true, 1.2) || recent('noslot', () => true, 1.2);
    if (fl) text(g, pal, fl.kind === 'fail' ? tx.pubFail : tx.noSlot, P.x + 12, P.y + 118, { size: 11, weight: 700, max: P.w - 20 });
    text(g, pal, `${fmtBytes(s.bytes)} · seq ${s.next_sequence}`, P.x + 12, P.y + P.h - 74, { font: 'mono', size: 11, color: pal.inkMuted, max: P.w - 20 });
    legend(g, pal, tx, P);
    if (s.pending > 0) text(g, pal, `+${s.pending}`, P.x + P.w - 12, P.y + 18, { font: 'mono', size: 11, weight: 700, align: 'right' });
  } else {
    text(g, pal, tx.pubProc, P.x + 10, P.y + 18, { weight: 700, size: 13, max: P.w * 0.45 });
    const st = steps.find((x) => x.on) || steps[2];
    text(g, pal, st.label, P.x + 10, P.y + 40, { font: st === steps[1] ? 'sans' : 'mono', size: 11, weight: st.on ? 700 : 400, color: st.on ? pal.ink : pal.inkMuted, max: P.w - 20 });
    text(g, pal, `${fmtBytes(s.bytes)} · seq ${s.next_sequence}`, P.x + P.w - 10, P.y + 18, { font: 'mono', size: 11, color: pal.inkMuted, align: 'right' });
  }

  // ---- shared memory: the slots and the free queue
  const M = G.shm;
  strokeRect(g, M, pal.line);
  text(g, pal, fmt(tx.shm, { n: SP.slots }), M.x + 8, M.y + 14, { size: 11, weight: 700, color: pal.inkMuted, max: M.w - 16 });
  const reading = new Map<number, number[]>();
  s.subs.forEach((u) => { if (u.held >= 0) reading.set(u.held, [...(reading.get(u.held) || []), u.i]); });
  G.slots.forEach((b, k) => {
    const sl = s.slots[k];
    const rd = reading.get(k) || [];
    strokeRect(g, b, rd.length ? pal.ink : sl.st ? pal.lineStrong : pal.line, rd.length > 1 ? 2 : 1);
    if (sl.st === 1 && wr && wr.k === k) { // being written: fills from the left (wide) or from the bottom (narrow)
      const u = clamp((t - (wr.t1 - SP.write)) / SP.write, 0, 1), c = pal.ch[(s.next_sequence + 1) & 3];
      if (G.wide) fillRect(g, b.x + 1, b.y + 1, (b.w - 2) * u, b.h - 2, c, 0.45);
      else fillRect(g, b.x + 1, b.y + b.h - 1 - (b.h - 2) * u, b.w - 2, (b.h - 2) * u, c, 0.45);
    } else if (sl.st === 2) fillRect(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, pal.ch[sl.sequence & 3], 0.45);
    const rc = sl.st === 0 ? recent('recycle', (e) => e.k === k, 0.7) : null;
    const refTxt = sl.st === 2 ? `ref ${sl.refcount}` : rc ? 'ref 0' : '';
    if (G.wide) {
      const cy = b.y + b.h / 2 + 0.5;
      text(g, pal, `#${k}`, b.x + 8, cy, { font: 'mono', size: 11, weight: 700, color: sl.st ? pal.ink : pal.inkMuted });
      if (sl.st === 2) text(g, pal, `seq ${sl.sequence} · ${fmtBytes(sl.bytes)}`, b.x + 40, cy, { font: 'mono', size: 11, max: b.w - 110 });
      else if (sl.st === 0 && !rc) text(g, pal, tx.slotFree, b.x + 40, cy, { size: 11, color: pal.inkMuted, max: b.w - 110 });
      if (refTxt) text(g, pal, refTxt, b.x + b.w - 8, cy, { font: 'mono', size: 12, weight: 700, align: 'right' });
    } else {
      text(g, pal, `#${k}`, b.x + b.w / 2, b.y + 11, { font: 'mono', size: 11, weight: 700, align: 'center', color: sl.st ? pal.ink : pal.inkMuted });
      if (refTxt) text(g, pal, refTxt.replace('ref ', 'r'), b.x + b.w / 2, b.y + b.h - 11, { font: 'mono', size: 11, weight: 700, align: 'center' });
      if (rd.length) text(g, pal, rd.map((i) => 'ABC'[i]).join(''), b.x + b.w / 2, b.y + b.h + 10, { font: 'mono', size: 11, weight: 700, align: 'center' });
    }
  });
  const fq = s.free.map((k) => `#${k}`).join(' ');
  text(g, pal, `${tx.freeQueue}  ${fq || '—'}`, M.x + 8, G.freeY, { font: 'mono', size: 11, color: pal.inkMuted, max: M.w - 16 });
  if (wr) { // the publisher writes in place, into the slot it got from CreateData()
    const b = G.slots[wr.k];
    line(g, G.wide ? [[P.x + P.w, b.y + b.h / 2], [b.x, b.y + b.h / 2]] : [[b.x + b.w / 2, P.y + P.h], [b.x + b.w / 2, b.y]], pal.ink, 2);
  }

  // ---- subscriber processes: descriptor ring, the slot each one reads
  s.subs.forEach((u: Sub, i) => {
    const B = G.subs[i];
    const busy = u.st === 'read';
    strokeRect(g, B, busy ? pal.ink : pal.lineStrong);
    const nw = text(g, pal, names[i], B.x + 10, B.y + 16, { weight: 700, size: 13, max: B.w * 0.5 });
    const dr = recent('drop', (e) => e.i === i, 1.0);
    if (dr && !G.wide) text(g, pal, tx.dropOld, B.x + B.w - 10, B.y + 16, { size: 11, weight: 700, align: 'right', max: B.w - nw - 30 });
    else text(g, pal, u.mode ? 'DROP_OLD' : 'FULL', B.x + B.w - 10, B.y + 16, { font: 'mono', size: 10, weight: 700, color: pal.inkMuted, align: 'right', max: B.w - nw - 30 });
    const st = u.st === 'read' ? fmt(tx.subRead, { k: u.held }) : u.st === 'wake' ? tx.subWake : tx.subWait;
    const R = ringCells(B, G.wide);
    if (G.wide) text(g, pal, st, B.x + 10, B.y + 38, { size: 12, color: busy ? pal.ink : pal.inkMuted, max: B.w - 20 });
    else text(g, pal, st, B.x + 10, B.y + 40, { size: 12, color: busy ? pal.ink : pal.inkMuted, max: R.x - B.x - 16 });
    // queued descriptors, oldest first: {slot_index, sequence}, 16 B each
    const q = s.queued(u);
    if (G.wide) text(g, pal, tx.desc, R.x + 3 * (R.w + 4) + 4, R.y + 10, { size: 11, color: pal.inkMuted, max: B.x + B.w - (R.x + 3 * (R.w + 4)) - 10 });
    for (let j = 0; j < SP.queue - 1; j += 1) {
      const c = { x: R.x + j * (R.w + 4), y: R.y, w: R.w, h: 18 };
      strokeRect(g, c, pal.line);
      const d = q[j];
      if (d) {
        const fresh = t - (recent('push', (e) => e.i === i && e.seq === d.sequence, 0.4)?.t ?? -9) < 0.35;
        if (!fresh) { fillRect(g, c.x + 1, c.y + 1, c.w - 2, c.h - 2, pal.ch[d.sequence & 3], 0.45); text(g, pal, `#${d.slot_index}`, c.x + c.w / 2, c.y + 9.5, { font: 'mono', size: 11, weight: 700, align: 'center' }); }
      }
    }
    if (dr && G.wide) text(g, pal, tx.dropOld, B.x + B.w - 10, B.y + 38, { size: 11, weight: 700, align: 'right' });
    // the read: a line from the process to the slot it holds; several processes meet on the same slot
    if (u.held >= 0 && G.wide) { // right angles through the gutter; the lines of several readers end on the same slot
      const sb = G.slots[u.held], cy = sb.y + sb.h / 2, gx = G.gutter + 5 + 6 * i;
      line(g, [[B.x, B.y + 38], [gx, B.y + 38], [gx, cy], [sb.x + sb.w, cy]], pal.ink);
    }
  });

  // ---- descriptors in flight: from the slot to each receiver's ring (16 B each, the payload stays)
  for (let i = s.events.length - 1; i >= 0; i -= 1) {
    const e = s.events[i];
    if (t - e.t > 0.35) break;
    if (e.kind !== 'push') continue;
    const sb = G.slots[e.k], from = G.wide ? { x: sb.x + sb.w - 20, y: sb.y + sb.h / 2 } : center(sb), R = ringCells(G.subs[e.i], G.wide);
    const j = Math.max(0, s.queued(s.subs[e.i]).findIndex((d) => d.sequence === e.seq));
    const to = { x: R.x + j * (R.w + 4) + R.w / 2, y: R.y + 9 };
    const u = ease((t - e.t) / 0.35), x = from.x + (to.x - from.x) * u, y = from.y + (to.y - from.y) * u;
    fillRect(g, x - R.w / 2, y - 9, R.w, 18, pal.raised); strokeRect(g, { x: x - R.w / 2, y: y - 9, w: R.w, h: 18 }, pal.ink);
    text(g, pal, `#${e.k}`, x, y + 0.5, { font: 'mono', size: 11, weight: 700, align: 'center' });
  }
}
