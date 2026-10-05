// Robot arm drawing for RobotModules/arm.ts. Generated from the arm beat 5-1 of the XRobot Style harness
// (export_svg.py export_arm_rig), then reduced to the drawing: drawArm() and the geometry, kinematics and helpers it
// calls, with the token tables of both themes and the scene anchors it reads. arm.ts drives it along ARM_KEYS.
/* eslint-disable */
// @ts-nocheck
export const TOKENS = {"light":{"paper":"#f2f3f2","paper-raised":"#ffffff","paper-sunken":"#e6e8e6","line":"#d3d6d3","line-strong":"#7c827e","ink":"#111312","ink-muted":"#4d524f","on-ink":"#f2f3f2","ch0":"#7a5c00","ch1":"#006573","ch2":"#a1206f","ch3":"#2a6e1b","pass":"#16693a","fail":"#b42318","blocked":"#7d5100","hero":"#00838f","focus":"#111312","link":"#111312","ln-sil":"#111312e6","ln-face":"#111312c7","ln-fold":"#11131273","ln-detail":"#11131247","ln-wire":"#1113129e","m-plinth":"#ffffff","m-plinth-l":"#e8e8e8","m-plinth-f":"#d1d1d1","m-neutral":"#e5e6e4","m-neutral-l":"#cecfcd","m-neutral-f":"#b8b9b7","m-pcb-own":"#3e6aa4","m-pcb-own-l":"#2a568e","m-pcb-own-f":"#164278","m-pcb-green":"#397054","m-pcb-green-l":"#245c41","m-pcb-green-f":"#0c482f","m-pcb-black":"#40454c","m-pcb-black-l":"#2e3339","m-pcb-black-f":"#1d2228","m-pcb-red":"#914743","m-pcb-red-l":"#7b3330","m-pcb-red-f":"#651f1e","m-gold":"#deb866","m-gold-l":"#c7a24f","m-gold-f":"#b18c38","m-silk":"#f2f2ef","m-silk-l":"#dbdbd8","m-silk-f":"#c4c4c1","m-ic":"#262a28","m-ic-l":"#161918","m-ic-f":"#070a08","m-alu":"#dee2e5","m-alu-l":"#c7cbce","m-alu-f":"#b1b5b8","m-graphite":"#3a3d41","m-graphite-l":"#282b2f","m-graphite-f":"#181a1e","m-plastic-white":"#e4e3df","m-plastic-white-l":"#cdccc8","m-plastic-white-f":"#b7b6b2","m-cream":"#f0e7d6","m-cream-l":"#d9d0bf","m-cream-f":"#c2baa9","m-xt-yellow":"#e1c15d","m-xt-yellow-l":"#caab45","m-xt-yellow-f":"#b4952b","m-print-blue":"#6689b3","m-print-blue-l":"#52749d","m-print-blue-f":"#3e6087","m-copper":"#b97c52","m-copper-l":"#a2673d","m-copper-f":"#8c5329","m-fr4-edge":"#cbc9a8","m-fr4-edge-l":"#b5b392","m-fr4-edge-f":"#9f9d7d","m-mannequin":"#d6d0c9","m-mannequin-l":"#bfbab3","m-mannequin-f":"#a9a49d","m-passive":"#c9b28c","m-passive-l":"#b39c77","m-passive-f":"#9d8762","m-glass":"#17262e","m-glass-l":"#07161d","m-glass-f":"#00070d","m-screen":"#0f1211","m-screen-l":"#030504","m-screen-f":"#000000","m-led-r":"#c35045","m-led-r-l":"#ab3a31","m-led-r-f":"#93221d","m-led-g":"#2a904b","m-led-g-l":"#027b37","m-led-g-f":"#006623","m-led-b":"#2e69b2","m-led-b-l":"#17549b","m-led-b-f":"#004085","f-top":"#e5e6e4","f-left":"#cecfcd","f-front":"#b8b9b7","f-dark":"#262a28","hero-t":"#40a8b4","hero-f":"#00606b","hero-glow":"#00838f59","log-d":"#ff85cb","log-i":"#4fdded","log-p":"#8be36a","log-w":"#ffd84d","log-e":"#ff8a7a","space-1":"4px","space-2":"8px","space-3":"12px","space-4":"16px","space-6":"24px","space-8":"32px","space-12":"48px","space-16":"64px","radius-none":"0","chamfer":"8px","stroke":"1px","stroke-strong":"2px","duration-fast":"80ms","t-press":"120ms","duration-base":"160ms","measure-prose":"40em","measure-code":"100ch","measure-page":"1200px","size-control":"36px","size-target":"32px","size-nav":"56px","font-sans":"system-ui, -apple-system, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", \"Source Han Sans SC\", sans-serif","font-mono":"ui-monospace, \"SF Mono\", \"Cascadia Mono\", \"JetBrains Mono\", Consolas, \"Noto Sans Mono CJK SC\", monospace"},"dark":{"paper":"#0c0e0d","paper-raised":"#151816","paper-sunken":"#070908","line":"#2a2e2c","line-strong":"#6f7672","ink":"#e6e8e6","ink-muted":"#a3a9a5","on-ink":"#0c0e0d","ch0":"#ffd84d","ch1":"#4fdded","ch2":"#ff85cb","ch3":"#8be36a","pass":"#5bd68a","fail":"#ff8a7a","blocked":"#f0b54a","hero":"#4fdded","focus":"#e6e8e6","link":"#e6e8e6","ln-sil":"#e6e8e68c","ln-face":"#e6e8e675","ln-fold":"#e6e8e638","ln-detail":"#e6e8e629","ln-wire":"#e6e8e680","m-plinth":"#151816","m-plinth-l":"#0a0d0b","m-plinth-f":"#040604","m-neutral":"#464b48","m-neutral-l":"#393e3b","m-neutral-f":"#2f3331","m-pcb-own":"#2c4e7b","m-pcb-own-l":"#1f406c","m-pcb-own-f":"#143560","m-pcb-green":"#28523c","m-pcb-green-l":"#1a442f","m-pcb-green-f":"#0e3a25","m-pcb-black":"#32363b","m-pcb-black-l":"#26292e","m-pcb-black-f":"#1c2024","m-pcb-red":"#6c3531","m-pcb-red-l":"#5d2824","m-pcb-red-f":"#511d1a","m-gold":"#b89a5a","m-gold-l":"#a88b4b","m-gold-f":"#9c7f3f","m-silk":"#d1d1ce","m-silk-l":"#c1c1be","m-silk-f":"#b4b4b1","m-ic":"#1b1e1c","m-ic-l":"#101311","m-ic-f":"#080a08","m-alu":"#6b6f73","m-alu-l":"#5d6165","m-alu-f":"#525659","m-graphite":"#3a3e43","m-graphite-l":"#2d3136","m-graphite-f":"#24272c","m-plastic-white":"#484845","m-plastic-white-l":"#3b3b38","m-plastic-white-f":"#31312e","m-cream":"#b1aa9c","m-cream-l":"#a19b8d","m-cream-f":"#958e81","m-xt-yellow":"#b69c4b","m-xt-yellow-l":"#a68d3b","m-xt-yellow-f":"#9a802d","m-print-blue":"#496588","m-print-blue-l":"#3b5779","m-print-blue-f":"#314c6d","m-copper":"#936240","m-copper-l":"#845432","m-copper-f":"#774927","m-fr4-edge":"#898870","m-fr4-edge-l":"#7a7962","m-fr4-edge-f":"#6f6e56","m-mannequin":"#5c5752","m-mannequin-l":"#4e4945","m-mannequin-f":"#433f3a","m-passive":"#8e7b5e","m-passive-l":"#7f6c50","m-passive-f":"#736145","m-glass":"#111c22","m-glass-l":"#061116","m-glass-f":"#02080d","m-screen":"#0f1211","m-screen-l":"#050807","m-screen-f":"#020302","m-led-r":"#c65a4f","m-led-r-l":"#b54b41","m-led-r-f":"#a73e35","m-led-g":"#3b9555","m-led-g-l":"#298647","m-led-g-f":"#187a3b","m-led-b":"#467cc0","m-led-b-l":"#376db0","m-led-b-f":"#2c61a3","f-top":"#464b48","f-left":"#393e3b","f-front":"#2f3331","f-dark":"#1b1e1c","hero-t":"#7dffff","hero-f":"#02b6c6","hero-glow":"#4fdded59","log-d":"#ff85cb","log-i":"#4fdded","log-p":"#8be36a","log-w":"#ffd84d","log-e":"#ff8a7a","space-1":"4px","space-2":"8px","space-3":"12px","space-4":"16px","space-6":"24px","space-8":"32px","space-12":"48px","space-16":"64px","radius-none":"0","chamfer":"8px","stroke":"1px","stroke-strong":"2px","duration-fast":"80ms","t-press":"120ms","duration-base":"160ms","measure-prose":"40em","measure-code":"100ch","measure-page":"1200px","size-control":"36px","size-target":"32px","size-nav":"56px","font-sans":"system-ui, -apple-system, \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", \"Noto Sans CJK SC\", \"Source Han Sans SC\", sans-serif","font-mono":"ui-monospace, \"SF Mono\", \"Cascadia Mono\", \"JetBrains Mono\", Consolas, \"Noto Sans Mono CJK SC\", monospace"}};
export const ANCHORS = {"arm.base":[0.0,120.0,0.0],"armmat.ring":[-440.0,-16.0,6.0],"armmat.c":[-300.0,-15.0,6.0],"arm.panel":[-110.3,-26.0,84.0],"arm.led":[-110.3,46.0,62.0],"arm.plug":[0.0,123.5,28.0],"arm.o":[0.0,0.0,0.0],"arm.S":[0.0,0.0,316.0],"arm.j2":[0.0,84.0,316.0],"arm.j3":[-187.78862511435634,60.0,669.1790371435707],"arm.j4":[-511.1478406547085,28.0,564.1132590560885],"arm.grip":[-511.1478406547085,-16.0,344.1132590560885],"arm.top":[-187.78862511435634,0.0,757.1790371435707],"arm.back":[130.0,-130.0,0.0],"arm.front":[-500.0,200.0,0.0],"arm.envL":[-600.0,-60.0,240.0],"arm.envT":[-200.0,60.0,810.0]};
export const ARM_REST = {"q": [35, 62, -80, -72], "grip": 20};
export const ARM_K = 0.55;
export const ARM_KEYS = [[0.0, 35, 62, -80, -72, 20], [1.6, 35, 84, -70, -54, 20], [3.2, 5, 84, -70, -54, 20], [3.9, 5, 70, -88, -66, 10], [4.6, 5, 84, -70, -54, 20], [6.4, 35, 62, -80, -72, 20], [7.2, 35, 62, -80, -72, 20]];
export function loadArmBeat(XR5, document) {
  const window = {XR5};
  const __out = {};
(function () {
'use strict';
const XR5 = window.XR5, {clamp} = XR5.m, I3 = XR5.iso, PJ = I3.PJ;
const D2R = Math.PI / 180;

// arm geometry (mm; 2 world units per mm), shared with the scene the anchors come from
const G = {MM: 2, zRing: 72, flR: 42, flH: 6, HS: 158, L1: 200, L2: 170, L3: 110, toolY: -8, ringAt: 220, zMat: 3,
  j: [null,
    {r: 40, a0: 0, a1: 44, bell: 18},        // J2 (shoulder): housing on the turret, cap towards the viewer
    {r: 34, a0: -12, a1: 30, bell: 16},      // J3 (elbow)
    {r: 26, a0: -20, a1: 12, bell: 13}],     // J4 (wrist)
  turret: [-8, 0], link1: [-18, -12], link2: [-26, -20]};
const HOME = {q: [0, 62 * D2R, -80 * D2R, -72 * D2R], grip: 12};

// =============================================================================================== kinematics (arm plane)
// plane coordinates (mm): r forward from the J1 axis, z up from the desk; joint angles q1 yaw, q2 shoulder (absolute from
// horizontal), q3 elbow and q4 wrist (relative). World: O + MM (r f + z up + a A), f = (-cos q1, -sin q1, 0), A = (-sin q1, cos q1, 0).
function fk(q) {
  const a2 = q[1], a3 = a2 + q[2], a4 = a3 + q[3];
  const S = [0, G.HS], E = [S[0] + G.L1 * Math.cos(a2), S[1] + G.L1 * Math.sin(a2)];
  const W = [E[0] + G.L2 * Math.cos(a3), E[1] + G.L2 * Math.sin(a3)];
  const t = [Math.cos(a4), Math.sin(a4)], T = [W[0] + G.L3 * t[0], W[1] + G.L3 * t[1]];
  return {S, E, W, T, t, a2, a3, a4};
}

// pose and state the drawing reads; arm.ts sets q (rad) and grip (mm) before each draw
const V51 = {dialA: [1.0, 2.5, 1.5, .8], loadMax: 800};   // dq dial full scale per joint (A), payload range (g)
const SIM = {q: HOME.q.slice(), grip: HOME.grip, en: [true, true, true, true], id: [0, 0, 0, 0], iq: [0, 0, 0, 0], hand: null, dist: null, lastInput: -1e9};
const FX = {pk: []};                             // frames on the bus (none: the widget draws no bus traffic)
function resetSim() { SIM.q = HOME.q.slice(); SIM.grip = HOME.grip; SIM.en = [true, true, true, true]; SIM.hand = null; SIM.dist = null; }
function payloadSize(g) { return 16 + 18 * Math.cbrt(g / V51.loadMax); }

// =============================================================================================== drawing helpers (L2, world projected coordinates)
const COL = {theme: null, c: {}};
function tk(n) { return XR5.tok(n); }
function rgb(hex) {
  let v = COL.c[hex]; if (v) return v;
  const m = /^#([0-9a-f]{6})/i.exec(hex);
  if (m) { const n = parseInt(m[1], 16); v = [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  else { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = hex; const s = c.fillStyle; const mm = /^#([0-9a-f]{6})/i.exec(s); v = mm ? [parseInt(mm[1].slice(0, 2), 16), parseInt(mm[1].slice(2, 4), 16), parseInt(mm[1].slice(4, 6), 16)] : [128, 128, 128]; }
  return COL.c[hex] = v;
}
const css = (c, a) => a === undefined || a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// material shade for a world normal: blend of the token's three face colours (top, left = -x, front = +y), light from the back-left-top
function shade(mat, n) {
  const m = XR5.mat(mat), T = rgb(m[0]), L = rgb(m[1]), F = rgb(m[2]);
  const wt = Math.max(0, n[2]), wl = Math.max(0, -n[0]), wf = Math.max(0, n[1]), s = wt + wl + wf;
  if (s < 1e-6) return F;
  return [(T[0] * wt + L[0] * wl + F[0] * wf) / s, (T[1] * wt + L[1] * wl + F[1] * wf) / s, (T[2] * wt + L[2] * wl + F[2] * wf) / s];
}
const VIEWV = [-1, 1, 1];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function hull(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
// arm frame for the current yaw: world point of plane coords (r, z) and lateral a (mm)
const FR = {O: [0, 0, 0], f: [-1, 0, 0], A: [0, 1, 0], q1: 0};
function setFrame(q1) { const o = XR5.anchor('arm.o'); FR.O = o; FR.q1 = q1; FR.f = [-Math.cos(q1), -Math.sin(q1), 0]; FR.A = [-Math.sin(q1), Math.cos(q1), 0]; }
function W3(r, z, a) { const M = G.MM; return [FR.O[0] + M * (r * FR.f[0] + a * FR.A[0]), FR.O[1] + M * (r * FR.f[1] + a * FR.A[1]), FR.O[2] + M * z]; }
const W2 = (r, z, a) => PJ(W3(r, z, a));
const nPlane = (nr, nz) => [nr * FR.f[0], nr * FR.f[1], nz];               // in-plane normal (r, z components) -> world

// a joint-axis cylinder: centre (r, z), radius R, lateral span [a0, a1]; side with a sampled light gradient, the far end hidden
function cylA(g, c, R, a0, a1, mat, o) {
  o = o || {}; const n = o.n || (R > 30 ? 32 : 24), ring0 = [], ring1 = [];
  for (let i = 0; i < n; i++) { const ph = i / n * Math.PI * 2, cr = Math.cos(ph), sr = Math.sin(ph); ring0.push(W2(c[0] + R * cr, c[1] + R * sr, a0)); ring1.push(W2(c[0] + R * cr, c[1] + R * sr, a1)); }
  const sil = hull(ring0.concat(ring1));
  const alpha = dot(FR.f, VIEWV), phc = Math.atan2(1, alpha);           // normals facing the viewer most: phi = phc
  const pA = W2(c[0] + R * Math.cos(phc - Math.PI / 2), c[1] + R * Math.sin(phc - Math.PI / 2), (a0 + a1) / 2);
  const pB = W2(c[0] + R * Math.cos(phc + Math.PI / 2), c[1] + R * Math.sin(phc + Math.PI / 2), (a0 + a1) / 2);
  const x = g.ctx, gr = x.createLinearGradient(pA[0], pA[1], pB[0], pB[1]), dx = pB[0] - pA[0], dy = pB[1] - pA[1], L2_ = dx * dx + dy * dy || 1;
  for (let k = 0; k <= 8; k++) {
    const ph = phc - Math.PI / 2 + k / 8 * Math.PI, nr = Math.cos(ph), nz = Math.sin(ph), p = W2(c[0] + R * nr, c[1] + R * nz, (a0 + a1) / 2);
    const u = clamp(((p[0] - pA[0]) * dx + (p[1] - pA[1]) * dy) / L2_, 0, 1);
    let col = shade(mat, nPlane(nr, nz)); if (o.tint) col = mixc(col, o.tint[0], o.tint[1]);
    gr.addColorStop(u, css(col));
  }
  x.beginPath(); x.moveTo(sil[0][0], sil[0][1]); for (let i = 1; i < sil.length; i++) x.lineTo(sil[i][0], sil[i][1]); x.closePath();
  x.globalAlpha = o.alpha === undefined ? 1 : o.alpha; x.fillStyle = gr; x.fill();
  x.lineWidth = 1 / g.k; x.strokeStyle = tk('ln-face'); x.lineJoin = 'round'; x.stroke(); x.globalAlpha = 1;
  const capVis = dot(FR.A, VIEWV) > 0, cap = capVis ? ring1 : ring0;
  return {sil, cap, ring0, ring1};
}
function fillPoly(g, pts, fill, stroke, lw, alpha) { g.poly(pts, {fill, stroke: stroke || null, lw: lw === undefined ? .8 : lw, alpha, join: 'round'}); }
// oriented box in the arm frame: centre (r, z, a), in-plane unit axis u = (ur, uz) with half extents hu, hv (in-plane normal), ha (lateral)
function boxA(g, c, u, hu, hv, ha, mat, o) {
  o = o || {}; const v = [-u[1], u[0]], pts = [];
  const P = (su, sv, sa) => W3(c[0] + su * hu * u[0] + sv * hv * v[0], c[1] + su * hu * u[1] + sv * hv * v[1], c[2] + sa * ha);
  const faces = [
    {q: [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], n: nPlane(u[0], u[1])}, {q: [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]], n: nPlane(-u[0], -u[1])},
    {q: [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], n: nPlane(v[0], v[1])}, {q: [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]], n: nPlane(-v[0], -v[1])},
    {q: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], n: FR.A}, {q: [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1]], n: [-FR.A[0], -FR.A[1], 0]}];
  const vis = [];
  for (const f of faces) { if (dot(f.n, VIEWV) <= 1e-6) continue; const q3 = f.q.map(s => P(...s)); vis.push({q: q3.map(PJ), n: f.n, d: q3.reduce((s, p) => s + I3.depth(p), 0) / 4}); }
  vis.sort((a, b) => a.d - b.d);
  for (const f of vis) { let col = shade(mat, f.n); if (o.tint) col = mixc(col, o.tint[0], o.tint[1]); fillPoly(g, f.q, css(col), tk('ln-face'), .8, o.alpha); pts.push(...f.q); }
  return pts;
}
// a plate in the arm plane (links, turret): outline (plane pts, CCW), lateral span [a0, a1]; edges shaded by their normals,
// pockets = inner outlines drawn as recesses (floor + the inner walls that face the viewer)
function plateA(g, outline, a0, a1, mat, pockets, o) {
  o = o || {}; const n = outline.length, front = outline.map(p => W2(p[0], p[1], a1));
  const edges = [];
  for (let i = 0; i < n; i++) { const a = outline[i], b = outline[(i + 1) % n], er = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(er, ez) || 1, nw = nPlane(ez / L, -er / L);
    if (dot(nw, VIEWV) <= 1e-6) continue; edges.push({q: [W2(a[0], a[1], a0), W2(b[0], b[1], a0), W2(b[0], b[1], a1), W2(a[0], a[1], a1)], n: nw}); }
  for (const e of edges) fillPoly(g, e.q, css(shade(mat, e.n)), css(shade(mat, e.n)), .6, o.alpha);
  fillPoly(g, front, css(shade(mat, FR.A)), tk('ln-face'), .8, o.alpha);
  for (const pk of pockets || []) {
    const d = pk.depth || 2.5, fl = pk.pts.map(p => W2(p[0], p[1], a1 - d)), fc = mixc(shade(mat, FR.A), rgb(tk('ink')), .22);
    fillPoly(g, fl, css(fc), null, 0, o.alpha);
    const m = pk.pts.length;
    for (let i = 0; i < m; i++) { const a = pk.pts[i], b = pk.pts[(i + 1) % m], er = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(er, ez) || 1, nw = nPlane(-ez / L, er / L);
      if (dot(nw, VIEWV) <= 1e-6) continue;
      fillPoly(g, [W2(a[0], a[1], a1 - d), W2(b[0], b[1], a1 - d), W2(b[0], b[1], a1), W2(a[0], a[1], a1)], css(shade(mat, nw)), null, 0, o.alpha); }
    g.poly(pk.pts.map(p => W2(p[0], p[1], a1)), {stroke: tk('ln-fold'), lw: .7, join: 'round'});
  }
  return hull(front.concat(edges.flatMap(e => e.q)));
}
function circPlane(c, R, n, a0) { const o = []; for (let i = 0; i < n; i++) { const ph = (a0 || 0) + i / n * Math.PI * 2; o.push([c[0] + R * Math.cos(ph), c[1] + R * Math.sin(ph)]); } return o; }
function stadium(p0, r0, p1, r1, n) { return hull(circPlane(p0, r0, n || 28).concat(circPlane(p1, r1, n || 28))); }
// points on a joint cap: cap-plane frame (u right, v up at home; rotated by rho), lateral a
function capPt(c, a, rho, x, y) { const cu = Math.cos(rho), su = Math.sin(rho); const ur = -cu, uz = -su, vr = -su, vz = cu;
  return W2(c[0] + x * ur + y * vr, c[1] + x * uz + y * vz, a); }
function capMatrix(c, a, rho, scale) {         // canvas transform: cap-plane (x right, y down) in mm -> projected world
  const o = capPt(c, a, rho, 0, 0), ex = capPt(c, a, rho, 1, 0), ey = capPt(c, a, rho, 0, -1);
  return [(ex[0] - o[0]) * scale, (ex[1] - o[1]) * scale, (ey[0] - o[0]) * scale, (ey[1] - o[1]) * scale, o[0], o[1]];
}

// =============================================================================================== the arm (drawn every frame)
const PARTS = {};                                // name -> {hull (projected), c3 (target point)}
function activeJoint(s) {                       // the joint XRobot is working on now (hero on its dial): drag, narrative push, single-step
  if (SIM.hand) return 0;
  if (s.step >= 0) return s.sel;
  const nr = SIM.dist; if (nr && nr.a > .05) return nr.j;
  return 0;
}
function drawArm(g, ctx) {
  const s = ctx.s, q = SIM.q, K = fk(q), lod = ctx.lod || 0, hero = tk('hero'), dark = XR5.theme() === 'dark';
  setFrame(q[0]);
  for (const k in PARTS) delete PARTS[k];
  const act = activeJoint(s), pts = {};
  // ---- J1 output flange with six screws (turns with the yaw)
  const fl = [];
  for (let i = 0; i < 40; i++) { const ph = i / 40 * Math.PI * 2; fl.push([G.flR * Math.cos(ph), G.flR * Math.sin(ph)]); }
  const flTop = fl.map(p => PJ([FR.O[0] + G.MM * (p[0] * FR.f[0] - p[1] * FR.A[0]), FR.O[1] + G.MM * (p[0] * FR.f[1] - p[1] * FR.A[1]), G.MM * (G.zRing + G.flH)]));
  const flBot = fl.map(p => PJ([FR.O[0] + G.MM * (p[0] * FR.f[0] - p[1] * FR.A[0]), FR.O[1] + G.MM * (p[0] * FR.f[1] - p[1] * FR.A[1]), G.MM * G.zRing]));
  const am = XR5.mat('alu');
  const flH = hull(flTop.concat(flBot)); pts.flange = flH;
  fillPoly(g, flH, css(mixc(rgb(am[1]), rgb(am[2]), .5)), tk('ln-face'), .8);
  fillPoly(g, flTop, am[0], tk('ln-face'), .8);
  if (!lod) for (let i = 0; i < 6; i++) { const ph = q[0] + i * Math.PI / 3 + .3, rr = G.flR - 6;
    const c3 = [FR.O[0] + G.MM * rr * Math.cos(ph + Math.PI), FR.O[1] + G.MM * rr * Math.sin(ph + Math.PI), G.MM * (G.zRing + G.flH)];
    const sc = []; for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; sc.push(PJ([c3[0] + 5 * Math.cos(a), c3[1] + 5 * Math.sin(a), c3[2]])); }
    fillPoly(g, sc, tk('m-graphite'), null, 0); }
  // ---- forearm (link 2): aluminium plate, pockets
  const a3 = K.a3, e3 = [Math.cos(a3), Math.sin(a3)], nrm3 = [-e3[1], e3[0]];
  const pk2 = [pocket(K.E, e3, nrm3, 44, 108, 8)];
  pts.link2 = plateA(g, stadium(K.E, 24, K.W, 20), G.link2[0], G.link2[1], 'alu', lod ? [] : pk2);
  // ---- harness on the forearm: J3 out -> J4 in; the bus lights while the visitor works the arm; packets ride on it
  const hs = harness(K), inter = !!(SIM.hand || s.step >= 0 || XR5.clock.t - SIM.lastInput < 2.5), pk = packetsOn(hs);
  drawCable(g, hs.seg3, inter, pk[3]);
  // ---- upper arm (link 1)
  const a2 = K.a2, e2 = [Math.cos(a2), Math.sin(a2)], nrm2 = [-e2[1], e2[0]];
  const pk1 = [pocket(K.S, e2, nrm2, 50, 150, 10)];
  pts.link1 = plateA(g, stadium(K.S, 30, K.E, 26), G.link1[0], G.link1[1], 'alu', lod ? [] : pk1);
  drawCable(g, hs.seg2, inter, pk[2]);
  // ---- turret: foot on the flange and a round-topped plate up to the shoulder axis
  boxA(g, [0, G.zRing + G.flH + 6, -6], [1, 0], 30, 6, 16, 'alu');
  const tur = hull(circPlane([0, G.HS], 32, 28).concat([[-34, G.zRing + G.flH + 12], [34, G.zRing + G.flH + 12]]));
  pts.turret = plateA(g, tur, G.turret[0], G.turret[1], 'alu', lod ? [] : [{pts: stadium([0, G.zRing + 40], 9, [0, G.HS - 38], 9, 16), depth: 2}]);
  drawCable(g, hs.seg1, inter, pk[1]);
  // ---- gripper (tool): adapter, body with the servo horn, linkage, two fingers, optional payload block
  pts.tool = drawGripper(g, K, s, lod);
  // ---- joint modules J4, J3, J2 (front-most last)
  for (const j of [4, 3, 2]) pts['j' + j] = drawJoint(g, j, K, s, act, lod);
  // J1 dial on the pedestal panel (its packet goes from the gland straight to the panel)
  drawDialJ1(g, s, act);

  // ---- parts for picking and outlines (last drawn = topmost)
  // pick shapes in paint order (the engine tests the last one first): what is drawn in front wins
  const band = (P, w) => { const L = [], R_ = []; for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; L.push([P[i][0] + nx, P[i][1] + ny]); R_.push([P[i][0] - nx, P[i][1] - ny]); } return L.concat(R_.reverse()); };
  const termH = hull(hs.term.concat(hs.term.map(p => [p[0] + g.px(4), p[1] - g.px(4)])));
  const order = [['arm.flange', pts.flange], ['arm.link2', pts.link2], ['arm.bus', band(hs.seg3, 4.6 * G.MM)], ['arm.link1', pts.link1], ['arm.bus', band(hs.seg2, 4.6 * G.MM)], ['arm.turret', pts.turret],
    ['arm.tool', pts.tool], ['arm.j4', pts.j4], ['arm.term', termH], ['arm.enc', PARTS['arm.enc4'] && PARTS['arm.enc4'].hull], ['arm.j3', pts.j3], ['arm.conn', PARTS['arm.conn3'] && PARTS['arm.conn3'].hull], ['arm.enc', PARTS['arm.enc3'] && PARTS['arm.enc3'].hull],
    ['arm.j2', pts.j2], ['arm.conn', PARTS['arm.conn2'] && PARTS['arm.conn2'].hull], ['arm.enc', PARTS['arm.enc2'] && PARTS['arm.enc2'].hull]];
  for (const [nm, h] of order) { if (!h || h.length < 3) continue; if (nm !== 'arm.bus') PARTS[nm] = {hull: h}; if (ctx.view && ctx.view.hold) g.hit(nm, {poly: h}); }
  PARTS['arm.bus'] = {line: hs.all};
  return K;
}
function pocket(P0, e, n, s0, s1, w) {         // an obround recess along a link from s0 to s1 (mm from P0), half width w
  const a = [P0[0] + e[0] * s0, P0[1] + e[1] * s0], b = [P0[0] + e[0] * s1, P0[1] + e[1] * s1];
  return {pts: stadium(a, w, b, w, 18), depth: 2.5};
}
// harness: J1 flange -> turret front -> J2 top connectors -> along link 1 -> J3 -> along link 2 -> J4 (terminator in the out port)
function harness(K) {
  const conn = (j) => connPos(j, K);
  const c2 = conn(2), c3 = conn(3), c4 = conn(4);
  const up = (p, d) => [p[0], p[1] + d];
  const seg1 = [[ -20, G.zRing + G.flH + 2, 12], [-26, G.zRing + 40, 1.5], [-30, G.HS - 20, 1.5], [c2.inp[0] - 8, c2.inp[1] + 8, c2.a], [c2.inp[0], c2.inp[1] + 2, c2.a]];
  const along = (P0, P1, e, lift, a, f0, f1) => { const o = []; for (const f of [f0, .35, .65, f1]) o.push([P0[0] + (P1[0] - P0[0]) * f + (-e[1]) * lift, P0[1] + (P1[1] - P0[1]) * f + e[0] * lift, a]); return o; };
  const e2 = [Math.cos(K.a2), Math.sin(K.a2)], e3 = [Math.cos(K.a3), Math.sin(K.a3)];
  const seg2 = [[c2.out[0], c2.out[1] + 2, c2.a], [c2.out[0] + 4, c2.out[1] + 10, c2.a - 10]].concat(along(K.S, K.E, e2, 17, G.link1[1] + 3, .22, .78)).concat([[c3.inp[0], c3.inp[1] + 8, c3.a - 6], [c3.inp[0], c3.inp[1] + 2, c3.a]]);
  const seg3 = [[c3.out[0], c3.out[1] + 2, c3.a], [c3.out[0] + 3, c3.out[1] + 9, c3.a - 10]].concat(along(K.E, K.W, e3, 15, G.link2[1] + 3, .2, .8)).concat([[c4.inp[0], c4.inp[1] + 8, c4.a - 6], [c4.inp[0], c4.inp[1] + 2, c4.a]]);
  const P = s => smooth(s.map(p => W3(p[0], p[1], p[2])));
  const t4 = c4.out, term = [W2(t4[0] - 4, t4[1], c4.a - 3), W2(t4[0] + 4, t4[1], c4.a - 3), W2(t4[0] + 4, t4[1] + 9, c4.a - 3), W2(t4[0] - 4, t4[1] + 9, c4.a - 3)];
  const s1 = P(seg1), s2 = P(seg2), s3 = P(seg3);
  return {seg1: s1, seg2: s2, seg3: s3, all: [s1, s2, s3], term, c2, c3, c4};
}
function smooth(p3) {                          // Chaikin on 3D points, projected
  let Q = p3; for (let it = 0; it < 2; it++) { const R_ = [Q[0]]; for (let i = 0; i < Q.length - 1; i++) { const a = Q[i], b = Q[i + 1]; R_.push(I3.add(I3.mul(a, .75), I3.mul(b, .25)), I3.add(I3.mul(a, .25), I3.mul(b, .75))); } R_.push(Q[Q.length - 1]); Q = R_; }
  return Q.map(PJ);
}
function drawCable(g, pts, hot, packets) {
  const x = g.ctx, w = 4.6 * G.MM; x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.strokeStyle = tk('ln-sil'); x.lineWidth = w + 1.6 / g.k; x.stroke();
  x.strokeStyle = tk('m-graphite'); x.lineWidth = w; x.stroke();
  x.strokeStyle = tk('m-graphite-l'); x.lineWidth = w * .35; x.globalAlpha = .9; x.setLineDash([2.2 * G.MM, 1.6 * G.MM]); x.stroke(); x.setLineDash([]);
  if (hot) { x.globalAlpha = .6; x.strokeStyle = tk('hero'); x.lineWidth = 1.3 / g.k; x.stroke(); }
  x.restore();
  for (const p of packets || []) drawPacket(g, p);
}
// a frame on the bus (hero); the one that lost an arbitration is drawn hollow while it backs off
function drawPacket(g, p) { if (!p.lose) { g.packet(p.q, g.px(7)); return; } const s = g.px(7); g.rect(p.q[0] - s / 2, p.q[1] - s / 2, s, s, {fill: tk('paper-raised'), stroke: tk('hero'), lw: 1.5}); }
// the frame on the bus now, as a packet: gland -> joint (commands) or back (replies), split by the harness piece it is on
function packetsOn(hs) {
  const out = {0: [], 1: [], 2: [], 3: [], j1: []}, pl = PJ(XR5.anchor('arm.plug')), up = PJ(W3(-20, G.zRing + G.flH + 2, 12));
  const len = P => { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
  const pieces = [[pl, up], hs.seg1, hs.seg2, hs.seg3], L = pieces.map(len);
  for (const p of FX.pk) {
    const u = p.kind === 'cmd' ? p.u : 1 - p.u;
    if (p.j === 1) { const q = along3([pl, PJ(XR5.anchor('arm.led'))], u); if (q) out.j1.push({q, lose: p.lose}); continue; }
    const n = p.j, tot = L.slice(0, n).reduce((a, b) => a + b, 0); let d = u * tot, k = 0;
    while (k < n - 1 && d > L[k]) { d -= L[k]; k++; }
    const q = along3(pieces[k], L[k] ? d / L[k] : 0); if (q) out[k].push({q, lose: p.lose}); if (q && p.lose) FX.loseQ = {q, id: p.id, t: XR5.clock.te};
  }
  return out;
}
// XT30(2+2) connector pair on a module: on the housing rim, towards the parent link's "up"
function connPos(j, K) {
  const J = G.j[j - 1], c = j === 2 ? [0, G.HS] : j === 3 ? K.E : K.W, par = j === 2 ? Math.PI / 2 : j === 3 ? K.a2 : K.a3;
  const up = par + (j === 2 ? 0 : Math.PI / 2), u = [Math.cos(up), Math.sin(up)], R = J.r + 2;
  const base = [c[0] + u[0] * R, c[1] + u[1] * R], t = [u[1], -u[0]];
  return {base, u, t, a: J.a1 - 7, inp: [base[0] - t[0] * 6.5 + u[0] * 5, base[1] - t[1] * 6.5 + u[1] * 5], out: [base[0] + t[0] * 6.5 + u[0] * 5, base[1] + t[1] * 6.5 + u[1] * 5], c};
}
const BELL_SLOTS = 8, GEAR = 6;             // the bell is the motor rotor: 6:1 planetary, so it turns six times the joint
function drawJoint(g, j, K, s, act, lod) {
  const J = G.j[j - 1], c = j === 2 ? [0, G.HS] : j === 3 ? K.E : K.W;
  const outAng = j === 2 ? SIM.q[1] : j === 3 ? SIM.q[2] : SIM.q[3];      // rotor (bell) angle relative to the housing
  const rho = j === 2 ? 0 : j === 3 ? K.a2 - HOME.q[1] : K.a3 - (HOME.q[1] + HOME.q[2]);  // housing rotation from home
  const aB = J.a0 + J.bell, aH0 = aB + .6, aC = J.a1 - 2.5;
  // bell (rotor, brushed aluminium) with its cooling slots turning with the joint
  const bell = cylA(g, c, J.r, J.a0, aB, 'alu');
  if (!lod) {
    const x = g.ctx, alpha = dot(FR.f, VIEWV), phc = Math.atan2(1, alpha);
    for (let k = 0; k < BELL_SLOTS; k++) {
      const ph = outAng * GEAR + k / BELL_SLOTS * Math.PI * 2, dph = ((ph - phc + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(dph) > Math.PI / 2 - .25) continue;
      const w = .13, r = J.r + .05, q4 = [W2(c[0] + r * Math.cos(ph - w), c[1] + r * Math.sin(ph - w), J.a0 + 3), W2(c[0] + r * Math.cos(ph + w), c[1] + r * Math.sin(ph + w), J.a0 + 3),
        W2(c[0] + r * Math.cos(ph + w), c[1] + r * Math.sin(ph + w), aB - 3), W2(c[0] + r * Math.cos(ph - w), c[1] + r * Math.sin(ph - w), aB - 3)];
      fillPoly(g, q4, tk('m-graphite-f'), null, 0, .85);
    }
  }
  // stator side housing (black anodised) and the cap
  const hou = cylA(g, c, J.r - 1.2, aH0, aC, 'graphite');
  const capR = cylA(g, c, J.r - 1.2, aC, J.a1, 'alu');
  const cap = capR.cap, capA = J.a1;
  fillPoly(g, cap, css(shade('alu', FR.A)), tk('ln-face'), .8);
  // connectors XT30(2+2) on the rim: in and out (J4: out carries the 120 ohm terminator)
  const cp = connPos(j, K);
  const cpts = [];
  for (const [k, pnt] of [['inp', cp.inp], ['out', cp.out]]) {
    cpts.push(...boxA(g, [pnt[0] - cp.u[0] * 3, pnt[1] - cp.u[1] * 3, cp.a], cp.u, 4.2, 4.6, 5.2, 'xt-yellow'));
    if (j === 4 && k === 'out') boxA(g, [pnt[0] + cp.u[0] * 3.5, pnt[1] + cp.u[1] * 3.5, cp.a], cp.u, 3.2, 3.6, 4.2, 'graphite');
  }
  // cap face: aluminium ring, black face, six screws, the dq window, printed ID, status LED
  const face = []; for (let i = 0; i < 40; i++) { const ph = i / 40 * Math.PI * 2; face.push(W2(c[0] + (J.r - 5.5) * Math.cos(ph), c[1] + (J.r - 5.5) * Math.sin(ph), capA)); }
  fillPoly(g, face, tk('m-graphite'), tk('ln-fold'), .7);
  if (!lod) for (let i = 0; i < 6; i++) { const ph = rho + i * Math.PI / 3 + Math.PI / 6, rr = J.r - 3.1, sc = [];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; sc.push(W2(c[0] + rr * Math.cos(ph) + 1.5 * Math.cos(a), c[1] + rr * Math.sin(ph) + 1.5 * Math.sin(a), capA + .1)); }
    fillPoly(g, sc, tk('m-alu-f'), tk('ln-detail'), .5); }
  const dr = j === 2 ? 17 : j === 3 ? 14.5 : 11;
  const dc = [0, j === 4 ? 2.5 : 4];            // window centre in the cap frame (mm, up)
  dial(g, c, capA + .15, rho, dc, dr, j, s, act === j, lod);
  // printed CAN ID under the window (silk), a green status LED to its right (blinks on this joint's frames)
  if (!lod) {
    const x = g.ctx, m = capMatrix(c, capA + .2, rho, 1), fs = j === 4 ? 6.2 : 7.2;
    x.save(); x.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    x.font = `700 ${fs}px ${tk('font-mono')}`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = tk('m-silk');
    x.fillText('ID ' + j, 0, -dc[1] + (j === 4 ? 17.8 : j === 3 ? 22.6 : 25.6));
    x.restore();
    const led = FX.pk.some(p => p.j === j && p.kind === 'cmd' && p.u > .96) || (SIM.en[j - 1] && Math.floor(XR5.clock.t * 1.7 + j) % 7 === 0);
    const lp = capPt(c, capA + .2, rho, j === 4 ? 13.5 : 18, j === 4 ? -10 : -13), lr = 1.6 * G.MM;
    g.circle(lp, lr, {fill: SIM.en[j - 1] ? (led ? tk('m-led-g') : tk('m-led-g-f')) : tk('m-led-r-f'), stroke: null});
  }
  PARTS['arm.conn' + j] = {hull: hull(cpts)};
  return hull(bell.sil.concat(hou.sil).concat(capR.sil));
}
// the dq dial: current vector in the rotor frame (d right, q up) on a dark round window; hero while XRobot works this joint
function dial(g, c, a, rho, dc, R, j, s, hot, lod) {
  const x = g.ctx, pt = (u, v) => capPt(c, a, rho, dc[0] + u, dc[1] + v);
  const ring = []; for (let i = 0; i < 36; i++) { const ph = i / 36 * Math.PI * 2; ring.push(pt(R * Math.cos(ph), R * Math.sin(ph))); }
  fillPoly(g, ring, tk('m-screen'), tk('m-alu-f'), 1);
  const on = SIM.en[j - 1], lite = '#dfe7e4', mut = 'rgba(223,231,228,.34)';
  if (!lod) {
    x.save(); x.lineWidth = .8 / g.k; x.strokeStyle = mut; x.beginPath();
    for (let i = 0; i < 12; i++) { const ph = i / 12 * Math.PI * 2, r0 = R * (i % 3 === 0 ? .68 : .8), r1 = R * .9, p0 = pt(r0 * Math.cos(ph), r0 * Math.sin(ph)), p1 = pt(r1 * Math.cos(ph), r1 * Math.sin(ph)); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); }
    x.stroke();
    x.setLineDash([1.5 / g.k, 2 / g.k]); x.beginPath(); let p0 = pt(-R * .62, 0), p1 = pt(R * .62, 0); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); p0 = pt(0, -R * .62); p1 = pt(0, R * .62); x.moveTo(p0[0], p0[1]); x.lineTo(p1[0], p1[1]); x.stroke(); x.setLineDash([]);
    x.restore();
  }
  // vector: (id, iq) / (1.25 x holding peak) -> length; enabled joints only
  const ipk = V51.dialA[j - 1], idv = SIM.id[j - 1], iqv = SIM.iq[j - 1];
  const L = on ? clamp(Math.hypot(idv, iqv) / ipk, 0, 1) * R * .86 : 0, ang = Math.atan2(iqv, idv);
  const col = hot ? tk('hero') : lite;
  if (L > R * .03) {
    const e = pt(L * Math.cos(ang), L * Math.sin(ang)), o = pt(0, 0), h1 = pt((L - R * .2) * Math.cos(ang) + R * .12 * Math.cos(ang + Math.PI / 2), (L - R * .2) * Math.sin(ang) + R * .12 * Math.sin(ang + Math.PI / 2)),
      h2 = pt((L - R * .2) * Math.cos(ang) - R * .12 * Math.cos(ang + Math.PI / 2), (L - R * .2) * Math.sin(ang) - R * .12 * Math.sin(ang + Math.PI / 2));
    g.line(o, e, {stroke: col, lw: hot ? 2.2 : 1.7, cap: 'round'}); g.poly([e, h1, h2], {fill: col, stroke: col, lw: .6});
    // the |iq| arc on the rim
    if (!lod) { const ar = []; const sgn = iqv >= 0 ? 1 : -1, sweep = clamp(Math.abs(iqv) / ipk, 0, 1) * Math.PI * .9;
      for (let k = 0; k <= 12; k++) { const ph = Math.PI / 2 * sgn - sgn * sweep * k / 12; ar.push(pt(R * .95 * Math.cos(ph), R * .95 * Math.sin(ph))); }
      g.polyline(ar, {stroke: col, lw: 1.3, alpha: .75}); }
  }
  // the pivot is the magnetic encoder: its chip on the driver board, the magnet ring on the shaft end under it
  const er = Math.max(1.6, R * .13), mg = []; for (let i = 0; i < 20; i++) { const ph = i / 20 * Math.PI * 2; mg.push(pt(er * 1.45 * Math.cos(ph), er * 1.45 * Math.sin(ph))); }
  g.poly(mg, {stroke: mut, lw: .8}, true);
  const chip = [pt(-er, -er), pt(er, -er), pt(er, er), pt(-er, er)];
  g.poly(chip, {fill: tk('m-ic'), stroke: on ? lite : mut, lw: .7});
  g.circle(pt(-er * .55, er * .55), er * .18 * G.MM, {fill: on ? lite : mut, stroke: null});
  PARTS['arm.enc' + j] = {hull: hull(mg)};
  if (!on && !lod) { const m = capMatrix(c, a + .05, rho, 1); x.save(); x.transform(m[0], m[1], m[2], m[3], m[4], m[5]); x.font = `700 ${R * .42}px ${tk('font-mono')}`; x.fillStyle = tk('m-led-r'); x.textAlign = 'center'; x.fillText('OFF', dc[0], -dc[1] + R * .55); x.restore(); }
}
function drawDialJ1(g, s, act) {
  const p = XR5.anchor('arm.panel'), R = 14, x = g.ctx;
  // window on the -x face: local u = +y, v = +z
  const pt = (u, v) => PJ([p[0] - .3, p[1] + u * G.MM, p[2] + v * G.MM]);
  const ring = []; for (let i = 0; i < 36; i++) { const ph = i / 36 * Math.PI * 2; ring.push(pt(R * .96 * Math.cos(ph), R * .96 * Math.sin(ph))); }
  fillPoly(g, ring, tk('m-screen'), null, 0);
  const lite = '#dfe7e4', mut = 'rgba(223,231,228,.34)', on = SIM.en[0], hot = act === 1;
  x.save(); x.lineWidth = .8 / g.k; x.strokeStyle = mut; x.beginPath();
  for (let i = 0; i < 12; i++) { const ph = i / 12 * Math.PI * 2, r0 = R * (i % 3 === 0 ? .68 : .8), r1 = R * .9, a = pt(r0 * Math.cos(ph), r0 * Math.sin(ph)), b = pt(r1 * Math.cos(ph), r1 * Math.sin(ph)); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); }
  x.stroke(); x.restore();
  const ipk = V51.dialA[0], L = on ? clamp(Math.hypot(SIM.id[0], SIM.iq[0]) / ipk, 0, 1) * R * .86 : 0, ang = Math.atan2(SIM.iq[0], SIM.id[0]);
  if (L > R * .03) g.line(pt(0, 0), pt(L * Math.cos(ang), L * Math.sin(ang)), {stroke: hot ? tk('hero') : lite, lw: 1.7, cap: 'round'});
  g.circle(pt(0, 0), R * .07 * G.MM, {fill: on ? lite : mut, stroke: null});
  const led = XR5.anchor('arm.led'), blink = FX.pk.some(q => q.j === 1 && q.u > .96) || Math.floor(XR5.clock.t * 1.7 + 1) % 7 === 0;
  g.circle(PJ(led), 2.1 * G.MM, {fill: SIM.en[0] ? (blink ? tk('m-led-g') : tk('m-led-g-f')) : tk('m-led-r-f'), stroke: null});
  PARTS['arm.j1'] = {hull: null};
}
function drawGripper(g, K, s, lod) {
  const t = K.t, n = [-t[1], t[0]], W = K.W, a = G.toolY, P = (d, m) => [W[0] + t[0] * d + n[0] * m, W[1] + t[1] * d + n[1] * m];
  const all = [];
  all.push(...boxA(g, [...P(29, 0), a], t, 4, 14, 14, 'alu'));                        // adapter flange
  const bodyC = P(48, 0);
  all.push(...boxA(g, [bodyC[0], bodyC[1], a], t, 15, 23, 16, 'graphite'));            // body (servo inside)
  if (!lod) {                                                                            // servo horn on the front face
    const hc = P(44, -9), hr = []; for (let i = 0; i < 16; i++) { const ph = i / 16 * Math.PI * 2; hr.push(W2(hc[0] + 5 * Math.cos(ph), hc[1] + 5 * Math.sin(ph), a + 16.2)); }
    fillPoly(g, hr, tk('m-alu'), tk('ln-face'), .6);
    g.circle(W2(hc[0], hc[1], a + 16.3), 1.2 * G.MM, {fill: tk('m-graphite-f'), stroke: null});
  }
  const o = clamp(SIM.grip, 6, 40), off = o / 2 + 4;
  // payload block between the fingers
  if (s.load > 0) { const b = payloadSize(s.load), bc = P(84 + b / 2, 0);
    all.push(...boxA(g, [bc[0], bc[1], a], t, b / 2, b / 2 - .2, b / 2, 'alu', {tint: [rgb(tk('m-print-blue')), .35]})); }
  // linkage bars from the body to each finger (the "two fingers + links" of the plan)
  for (const sg of [-1, 1]) {
    const p0 = P(62, sg * 7), p1 = P(70, sg * off);
    const e = [p1[0] - p0[0], p1[1] - p0[1]], L = Math.hypot(e[0], e[1]) || 1, u = [e[0] / L, e[1] / L];
    boxA(g, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, a + 13], u, L / 2 + 2, 2.2, 1.4, 'alu');
  }
  for (const sg of [-1, 1]) {
    const fc = P(87, sg * off);
    all.push(...boxA(g, [fc[0], fc[1], a], t, 23, 4, 12, 'alu'));
    const pad = P(94, sg * (off - 4.3));
    boxA(g, [pad[0], pad[1], a], t, 15, .6, 10.5, 'graphite');
  }
  return hull(all);
}

function along3(P, u) {
  if (!P || P.length < 2) return null; let L = 0; const seg = [];
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); L += d; }
  let t = clamp(u, 0, 1) * L;
  for (let i = 0; i < seg.length; i++) { if (t <= seg[i]) { const f = seg[i] ? t / seg[i] : 0; return [P[i][0] + (P[i + 1][0] - P[i][0]) * f, P[i][1] + (P[i + 1][1] - P[i][1]) * f]; } t -= seg[i]; }
  return P[P.length - 1];
}

;__out.X = {drawArm, resetSim, SIM, FX};
})();

  return __out.X;
}
