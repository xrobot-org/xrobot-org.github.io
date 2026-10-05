/* UsbDebug: one USB port, three device classes, and the SWD read the debug class performs.
   Left: the composite device opened out from its plug. The class list {{&dap, &cdc, &dfu_rt}} is bound in order, so the
   start_itf cursor gives interface 0 to CMSIS-DAP, 1-2 to CDC and 3 to the DFU runtime; each class contributes its block of
   the configuration descriptor (116 B = 9 + 23 + 66 + 18) and its BOS capability. Every byte is the output of LibXR's
   XRUSB classes built on a host (sim.ts); pointing at a byte names its descriptor and field.
   Right: a logic-analyzer view of SWCLK / SWDIO for one DP read of DPIDR at 1 MHz, drawn with the timing of
   SwdGeneralGPIO. "Read chip ID" plays the exchange: DAP_Transfer arrives on EP1 OUT, the 46 SWD cycles run and the value
   fills in from the low nibble, the reply leaves on EP1 IN.
   Self-playing: while active (and motion allowed) it loops: read the chip ID (bit-by-bit scan) AUTO.firstMs after the widget
   becomes active, rest 2 s, light the three device classes one after another with some of their descriptors, read again
   (sim.ts autoPlan). A press, key or focus on the widget, or moving the pointer over the bytes or the waveform (inspecting
   them), pauses that for 8 s of quiet (autoplay.ts); the loop then starts again from the read. A pointer that only rests
   over the widget does not pause it: the page scrolling under a still pointer would otherwise keep the loop from starting.
   Interface: ../README.md. `active` false stops the playback (no frames, no timers); `reducedMotion`: the complete
   capture is the still frame and the button steps field by field. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';
import { useIdleGate } from '../useIdleGate';
import {
  autoPlan, AUTO, type DescKind,
  device, blockBytes, byteAt, readDP, partialHex, dpidrFields, h2, USB, DPIDR,
  type BlockKey, type Func, type FuncKey, type Cycle,
} from './sim';

type ShowcaseProps = { active: boolean; reducedMotion: boolean };
type Phase = 'done' | 'out' | 'swd' | 'in';

const PRE = 2;                 // idle cycles drawn before and after the transfer
const SPAN = 46 + 2 * PRE;     // cycles across the plot
const OUT_MS = 600;            // EP1 OUT highlighted before the clock starts
const CYCLE_MS = 50;           // playback speed: one SWD cycle (1 us on the wire)
const IN_MS = 900;             // EP1 IN highlighted after the transfer
const END = 46 + PRE;
const READ_MS = OUT_MS + (END + PRE) * CYCLE_MS + IN_MS; // one complete read
// reduced motion: one press, one field
const STEPS: { phase: Phase; tc: number }[] = [
  { phase: 'out', tc: -PRE }, { phase: 'swd', tc: 8 }, { phase: 'swd', tc: 9 }, { phase: 'swd', tc: 12 },
  { phase: 'swd', tc: 44 }, { phase: 'swd', tc: 45 }, { phase: 'in', tc: END },
];

function texts() {
  const kind: Record<DescKind, string> = {
    device: translate({ id: 'showcase.usbdebug.kind.device', message: '设备描述符' }),
    config: translate({ id: 'showcase.usbdebug.kind.config', message: '配置描述符头' }),
    interface: translate({ id: 'showcase.usbdebug.kind.interface', message: '接口描述符' }),
    endpoint: translate({ id: 'showcase.usbdebug.kind.endpoint', message: '端点描述符' }),
    iad: translate({ id: 'showcase.usbdebug.kind.iad', message: '接口关联描述符（IAD）' }),
    cdcHeader: translate({ id: 'showcase.usbdebug.kind.cdcHeader', message: 'CDC 头功能描述符' }),
    cdcCall: translate({ id: 'showcase.usbdebug.kind.cdcCall', message: 'CDC 呼叫管理功能描述符' }),
    cdcAcm: translate({ id: 'showcase.usbdebug.kind.cdcAcm', message: 'CDC ACM 功能描述符' }),
    cdcUnion: translate({ id: 'showcase.usbdebug.kind.cdcUnion', message: 'CDC 联合功能描述符' }),
    dfuFunc: translate({ id: 'showcase.usbdebug.kind.dfuFunc', message: 'DFU 功能描述符' }),
    bos: translate({ id: 'showcase.usbdebug.kind.bos', message: 'BOS 头' }),
    msos: translate({ id: 'showcase.usbdebug.kind.msos', message: 'MS OS 2.0 平台能力' }),
    usb2ext: translate({ id: 'showcase.usbdebug.kind.usb2ext', message: 'USB 2.0 扩展能力' }),
    string: translate({ id: 'showcase.usbdebug.kind.string', message: '字符串描述符' }),
    other: translate({ id: 'showcase.usbdebug.kind.other', message: '描述符' }),
  };
  return {
    kind,
    aria: translate({ id: 'showcase.usbdebug.aria', message: 'XRUSB 复合设备的描述符，以及 DAPLink 经 SWD 读取 DPIDR 的波形' }),
    devPath: translate({ id: 'showcase.usbdebug.dev.path', message: 'XRUSB / 复合设备' }),
    listNote: translate({ id: 'showcase.usbdebug.dev.listNote', message: '类列表的顺序即接口号的顺序' }),
    rowsLabel: translate({ id: 'showcase.usbdebug.dev.rows', message: '复合设备中的三个设备类，选择一个查看它的描述符字节' }),
    func: {
      dap: translate({ id: 'showcase.usbdebug.func.dap', message: '调试器' }),
      cdc: translate({ id: 'showcase.usbdebug.func.cdc', message: '虚拟串口' }),
      dfu: translate({ id: 'showcase.usbdebug.func.dfu', message: '升级口' }),
    } as Record<FuncKey, string>,
    itf: translate({ id: 'showcase.usbdebug.itf', message: '接口 {n}' }),
    bulk: translate({ id: 'showcase.usbdebug.ep.bulk', message: '批量' }),
    intr: translate({ id: 'showcase.usbdebug.ep.interrupt', message: '中断' }),
    ep0: translate({ id: 'showcase.usbdebug.ep.ep0only', message: '只用 EP0' }),
    cfgSum: translate({ id: 'showcase.usbdebug.sum.cfg', message: '配置描述符 {n} B =' }),
    cfgHead: translate({ id: 'showcase.usbdebug.sum.cfgHead', message: '配置头' }),
    devDesc: translate({ id: 'showcase.usbdebug.sum.dev', message: '设备描述符' }),
    sumLabel: translate({ id: 'showcase.usbdebug.sum.label', message: '描述符组成' }),
    owner: {
      hdr: translate({ id: 'showcase.usbdebug.owner.hdr', message: 'BOS 头' }),
      dap: translate({ id: 'showcase.usbdebug.owner.dap', message: '由 CMSIS-DAP 提供' }),
      dfu: translate({ id: 'showcase.usbdebug.owner.dfu', message: '由 DFU 运行时提供' }),
      stack: translate({ id: 'showcase.usbdebug.owner.stack', message: '由协议栈补上' }),
    } as Record<string, string>,
    byteInfo: translate({ id: 'showcase.usbdebug.byte.info', message: '{desc} · 第 {i} 字节 · {field} = {value}' }),
    bytesLabel: translate({ id: 'showcase.usbdebug.byte.label', message: '描述符字节，方向键逐字节移动' }),
    descLit: translate({ id: 'showcase.usbdebug.byte.desc', message: '{desc} · {n} B' }),
    byteHint: translate({ id: 'showcase.usbdebug.byte.hint', message: '指向或点按字节，查看所属描述符和字段。' }),
    swdPath: translate({ id: 'showcase.usbdebug.swd.path', message: 'DEBUG / SWD · 1 MHz' }),
    state: {
      done: translate({ id: 'showcase.usbdebug.state.done', message: '读取完成' }),
      out: translate({ id: 'showcase.usbdebug.state.out', message: 'EP1 OUT 收到 DAP_Transfer' }),
      swd: translate({ id: 'showcase.usbdebug.state.swd', message: 'SWD 读取中' }),
      in: translate({ id: 'showcase.usbdebug.state.in', message: 'EP1 IN 发出回复' }),
    } as Record<Phase, string>,
    paused: translate({ id: 'showcase.usbdebug.state.paused', message: '已暂停' }),
    read: translate({ id: 'showcase.usbdebug.read', message: '读芯片 ID' }),
    next: translate({ id: 'showcase.usbdebug.next', message: '下一段' }),
    keyCap: translate({ id: 'showcase.usbdebug.key.cap', message: 'DPIDR · DP 地址 0x0' }),
    legendHost: translate({ id: 'showcase.usbdebug.legend.host', message: '主机驱动' }),
    legendTarget: translate({ id: 'showcase.usbdebug.legend.target', message: '目标驱动' }),
    legendZ: translate({ id: 'showcase.usbdebug.legend.z', message: '释放，上拉为高' }),
    waveAria: translate({
      id: 'showcase.usbdebug.wave.aria',
      message: 'SWCLK 与 SWDIO 波形：请求 0xA5、转向、ACK 100、32 位数据低位先、偶校验、转向，共 46 个时钟。方向键逐个时钟查看。',
    }),
    cycleInfo: translate({ id: 'showcase.usbdebug.wave.cycle', message: '第 {k} 个时钟 · {name} = {v} · {who}' }),
    whoHost: translate({ id: 'showcase.usbdebug.wave.host', message: '主机在低电平半周期写出，目标在上升沿采样' }),
    whoTarget: translate({ id: 'showcase.usbdebug.wave.target', message: '目标在前一个上升沿驱动，主机在上升沿之前采样' }),
    whoTrn: translate({ id: 'showcase.usbdebug.wave.trn', message: '转向：主机释放 SWDIO，上拉保持高电平，目标在上升沿接管' }),
    whoTrn2: translate({ id: 'showcase.usbdebug.wave.trn2', message: '转向：目标释放 SWDIO，主机接回并保持高电平' }),
    waveHint: translate({ id: 'showcase.usbdebug.wave.hint', message: '指向波形查看每个时钟周期的位和驱动方。' }),
    outNote: translate({ id: 'showcase.usbdebug.usb.out', message: 'DAP_Transfer：读 DP 0x0' }),
    inNote: translate({ id: 'showcase.usbdebug.usb.in', message: 'ACK OK，数据低字节在前' }),
    usbLabel: translate({ id: 'showcase.usbdebug.usb.label', message: 'CMSIS-DAP 命令与回复' }),
    dpidrLabel: translate({ id: 'showcase.usbdebug.dpidr.label', message: 'DPIDR 字段' }),
    designer: translate({ id: 'showcase.usbdebug.dpidr.designer', message: 'Arm' }),
    us: 'µs',
  };
}
type Texts = ReturnType<typeof texts>;

const fmt = (tpl: string, v: Record<string, string | number>): string => tpl.replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));

function epText(f: Func, t: Texts): string[] {
  if (!f.eps.length) return [t.ep0];
  const groups = new Map<string, { ep: number; dirs: string[]; type: string; mps: number }>();
  for (const e of f.eps) {
    const k = `${e.ep}/${e.type}/${e.mps}`;
    const g = groups.get(k);
    if (g) g.dirs.push(e.dir);
    else groups.set(k, { ep: e.ep, dirs: [e.dir], type: e.type, mps: e.mps });
  }
  return Array.from(groups.values()).map((g) => `EP${g.ep} ${g.dirs.join('/')} · ${g.type === 'Bulk' ? t.bulk : t.intr} ${g.mps} B`);
}
const itfText = (f: Func, t: Texts): string => fmt(t.itf, { n: f.itfs.length > 1 ? `${f.itfs[0]}–${f.itfs[f.itfs.length - 1]}` : f.itfs[0] });

// ============================================================================ waveform
type WaveProps = {
  t: Texts; width: number; tc: number; playing: boolean; sel: number | null;
  onSel: (k: number | null) => void;
};
const TR = readDP();
const NIBBLES = Array.from({ length: 8 }, (_, i) => ((DPIDR >>> (4 * i)) & 15).toString(16).toUpperCase());

function Wave({ t, width, tc, playing, sel, onSel }: WaveProps): JSX.Element {
  const narrow = width < 420;
  const LX = narrow ? 42 : 46;
  const x0 = LX, x1 = width - 2, px = (x1 - x0) / SPAN;
  const X = (c: number) => x0 + (c + PRE) * px;
  const Y = { axis: 10, clkHi: 22, clkLo: 42, ioHi: 56, ioLo: 76, fTop: 86, fBot: 104, dTop: 106, dBot: 120 };
  const H = 124;
  const clip = `ud-clip-${width}`;
  const reveal = Math.max(-PRE, Math.min(END, tc));

  // SWCLK: low before, then per cycle low half / high half, low after
  let clk = `M${X(-PRE)},${Y.clkLo}`;
  for (let k = 0; k < TR.n; k++) clk += `H${X(k + 0.5)}V${Y.clkHi}H${X(k + 1)}V${Y.clkLo}`;
  clk += `H${X(END)}`;

  // SWDIO: one polyline per driver; the idle line before and after is the host holding it high
  const segs = [{ t0: -PRE, t1: 0, v: 1 as const, drv: 'host' as const }, ...TR.segs, { t0: 46, t1: END, v: 1 as const, drv: 'host' as const }];
  const ioY = (v: 0 | 1 | null) => (v === 0 ? Y.ioLo : Y.ioHi);
  const paths: Record<'host' | 'target' | 'z', string> = { host: '', target: '', z: '' };
  segs.forEach((s, i) => {
    const prev = segs[i - 1];
    const yPrev = prev ? ioY(prev.v) : ioY(s.v);
    paths[s.drv] += `M${X(s.t0)},${yPrev}V${ioY(s.v)}H${X(s.t1)}`;
  });

  const fieldLabel = (key: string): string => (
    key === 'req' ? '0xA5' : key === 'ack' ? 'ACK 100' : key === 'data' ? '0x2BA01477' : key === 'par' ? 'P' : 'Trn');
  const cellText = (c: Cycle): string | null => {
    if (c.field === 'req' || c.field === 'ack' || c.field === 'par') return String(c.v);
    return null;
  };
  const showBits = px >= 5.5;
  const samp = (k: number) => (TR.cycles[k].drv === 'target' ? 0.4 : 0.5);

  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const tt = (e.clientX - r.left - x0) / px - PRE;
    let c = Math.floor(tt);
    // a target bit is on the line from the rising edge before its cycle: the right half of a cycle shows the next bit
    if (tt - c >= 0.5 && TR.cycles[c + 1] && TR.cycles[c + 1].drv === 'target') c += 1;
    onSel(c >= 0 && c < TR.n ? c : null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) { if (e.key === 'Escape') onSel(null); return; }
    e.preventDefault();
    onSel(sel === null ? (d > 0 ? 0 : TR.n - 1) : Math.max(0, Math.min(TR.n - 1, sel + d)));
  };

  const ticks = [0, 10, 20, 30, 40];
  return (
    <svg
      className={styles.wave} width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={t.waveAria} tabIndex={0}
      onPointerMove={(e) => { if (e.pointerType === 'mouse') pick(e); }}
      onPointerDown={pick}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') onSel(null); }}
      onKeyDown={onKey}
      onBlur={() => onSel(null)}
    >
      <defs>
        <clipPath id={clip}><rect x={0} y={0} width={X(reveal)} height={H} /></clipPath>
      </defs>
      {/* the selected cycle, behind everything */}
      {sel !== null && (
        <rect className={styles.selBand} x={X(TR.cycles[sel].drv === 'target' ? sel - 0.5 : sel)} y={Y.clkHi - 6} width={px} height={Y.ioLo - Y.clkHi + 12} />
      )}
      {/* time axis: 1 cycle = 1 us at 1 MHz */}
      {ticks.map((k) => (
        <g key={k}>
          <line className={styles.tick} x1={X(k)} x2={X(k)} y1={Y.axis + 4} y2={Y.dBot} />
          <text className={styles.axis} x={X(k) + 2} y={Y.axis}>{k === 0 ? `0 ${t.us}` : k}</text>
        </g>
      ))}
      <text className={styles.chName} x={0} y={(Y.clkHi + Y.clkLo) / 2 + 4}>SWCLK</text>
      <text className={styles.chName} x={0} y={(Y.ioHi + Y.ioLo) / 2 + 4}>SWDIO</text>
      <g clipPath={`url(#${clip})`}>
        <path className={styles.clk} d={clk} />
        <path className={styles.ioHost} d={paths.host} />
        <path className={styles.ioTarget} d={paths.target} />
        <path className={styles.ioZ} d={paths.z} />
      </g>
      {/* decode: fields appear once they are complete on the wire */}
      {TR.fields.map((f) => {
        const done = reveal >= f.c1;
        if (!done && !(reveal > f.c0)) return null;
        const w = X(f.c1) - X(f.c0);
        const lab = fieldLabel(f.key);
        const fits = lab.length * 6.6 + 6 <= w;
        return (
          <g key={f.key}>
            <rect className={f.key === 'data' ? styles.fData : styles.fBox} x={X(f.c0) + 0.5} y={Y.fTop + 0.5} width={Math.max(0, Math.min(w, X(reveal) - X(f.c0)) - 1)} height={Y.fBot - Y.fTop - 1} />
            {done && fits && (
              <text className={f.key === 'data' ? styles.fTextData : styles.fText} x={X(f.c0) + w / 2} y={Y.fBot - 5} textAnchor="middle">{lab}</text>
            )}
          </g>
        );
      })}
      {/* per-bit values for request / ACK / parity, hex digits per nibble of the data (low nibble first on the wire) */}
      {showBits && TR.cycles.map((c) => {
        const s = cellText(c);
        if (s === null || reveal < c.k + 1) return null;
        return <text key={c.k} className={styles.bit} x={X(c.k + 0.5)} y={Y.dBot - 3} textAnchor="middle">{s}</text>;
      })}
      {NIBBLES.map((n, i) => {
        const c0 = 12 + 4 * i;
        if (reveal < c0 + 4) return null;
        return (
          <g key={`n${i}`}>
            <line className={styles.nibSep} x1={X(c0)} x2={X(c0)} y1={Y.dTop} y2={Y.dBot} />
            <text className={styles.nib} x={X(c0 + 2)} y={Y.dBot - 3} textAnchor="middle">{n}</text>
          </g>
        );
      })}
      {/* sample point of the selected cycle: the rising edge */}
      {sel !== null && (
        <g>
          {/* where the bit is sampled: the target on the rising edge, the host just before it */}
          <line className={styles.selEdge} x1={X(sel + samp(sel))} x2={X(sel + samp(sel))} y1={Y.clkHi - 6} y2={Y.ioLo + 4} />
          {TR.cycles[sel].v !== null && <rect className={styles.selDot} x={X(sel + samp(sel)) - 3} y={ioY(TR.cycles[sel].v) - 3} width={6} height={6} />}
        </g>
      )}
      {playing && reveal < END && <line className={styles.cursor} x1={X(reveal)} x2={X(reveal)} y1={Y.clkHi - 6} y2={Y.dBot} />}
    </svg>
  );
}

// ============================================================================ widget
export default function UsbDebug({ active, reducedMotion }: ShowcaseProps): JSX.Element {
  const t = useMemo(texts, []);
  const dev = useMemo(device, []);
  const [block, setBlock] = useState<BlockKey>('dap');
  const [byteSel, setByteSel] = useState<number | null>(null);
  const [cycleSel, setCycleSel] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('done');
  const [tc, setTc] = useState(END);
  const [step, setStep] = useState(-1);
  const [waveW, setWaveW] = useState(420);
  const waveBox = useRef<HTMLDivElement>(null);
  const clock = useRef({ ms: 0 });          // playback time, advanced only while active
  const [lit, setLit] = useState<{ block: BlockKey; o: number; len: number; kind: DescKind } | null>(null); // descriptor lit by the loop
  const { idle, props: idleBase } = useIdleGate();
  // hover alone is not "in use" (see the header); only presses, keys, focus and real pointer movement over the inspectors
  const idleEvents = { onPointerDown: idleBase.onPointerDown, onKeyDown: idleBase.onKeyDown, onFocus: idleBase.onFocus };
  const inspectMove = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && (e.movementX !== 0 || e.movementY !== 0)) idle.touch();
  }, [idle]);
  const phaseRef = useRef<Phase>('done');
  phaseRef.current = phase;

  // ---- size of the plot
  useEffect(() => {
    const el = waveBox.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setWaveW(Math.max(280, Math.floor(el.clientWidth))));
    ro.observe(el);
    setWaveW(Math.max(280, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  // ---- playback: OUT -> 46 cycles -> IN; runs on animation frames only while active
  const playing = phase !== 'done' && !reducedMotion;
  useEffect(() => {
    if (!playing || !active) return undefined;
    let raf = 0;
    let last = performance.now();
    const swdMs = (END + PRE) * CYCLE_MS;
    const tick = (now: number) => {
      clock.current.ms += Math.min(100, Math.max(0, now - last));
      last = now;
      const ms = clock.current.ms;
      if (ms < OUT_MS) { setPhase('out'); setTc(-PRE); }
      else if (ms < OUT_MS + swdMs) { setPhase('swd'); setTc(-PRE + (ms - OUT_MS) / CYCLE_MS); }
      else if (ms < OUT_MS + swdMs + IN_MS) { setPhase('in'); setTc(END); }
      else { setPhase('done'); setTc(END); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, active]);

  // the loop: read -> rest -> tour of the classes -> read; timers only while active, restarted from the read after a pause
  useEffect(() => {
    if (!active || reducedMotion) return undefined;
    const plan = autoPlan(dev, READ_MS);
    let timer = 0, i = 0, paused = false, alive = true;
    const go = (): void => {
      if (!alive) return;
      if (idle.paused()) {
        if (!paused) { paused = true; setLit(null); }
        timer = window.setTimeout(go, Math.max(250, idle.waitMs()));
        return;
      }
      if (paused) { paused = false; i = 0; }
      const st = plan.steps[i];
      i = (i + 1) % plan.steps.length;
      if (st.kind === 'read') {
        setLit(null);
        if (phaseRef.current === 'done') { clock.current.ms = 0; setCycleSel(null); setStep(-1); setPhase('out'); setTc(-PRE); }
      } else if (st.kind === 'block') { setBlock(st.block); setLit(null); }
      else if (st.kind === 'desc') setLit({ block: st.block, o: st.o, len: st.len, kind: st.descKind });
      else setLit(null);
      timer = window.setTimeout(go, st.wait);
    };
    timer = window.setTimeout(go, AUTO.firstMs);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [active, reducedMotion, dev, idle]);

  // switching to reduced motion mid-play: show the complete capture
  useEffect(() => {
    if (reducedMotion && phase !== 'done' && step < 0) { setPhase('done'); setTc(END); }
  }, [reducedMotion, phase, step]);

  const onRead = useCallback(() => {
    setCycleSel(null);
    if (reducedMotion) {
      const n = step + 1;
      if (n >= STEPS.length) { setStep(-1); setPhase('done'); setTc(END); return; }
      setStep(n); setPhase(STEPS[n].phase); setTc(STEPS[n].tc);
      return;
    }
    clock.current.ms = 0;
    setStep(-1);
    setPhase('out');
    setTc(-PRE);
  }, [reducedMotion, step]);

  // ---- left: bytes of the selected block
  const blk = useMemo(() => blockBytes(dev, block), [dev, block]);
  useEffect(() => setByteSel(null), [block]);
  const at = byteSel !== null ? byteAt(blk.descs, byteSel) : null;
  const fieldRange = at && at.field ? [at.desc.o + at.field.o, at.desc.o + at.field.o + at.field.n] : null;
  const descIndex = (i: number) => blk.descs.findIndex((d) => i >= d.o && i < d.o + d.len);
  const litNow = lit && lit.block === block ? lit : null;
  let byteLine = litNow && !at ? fmt(t.descLit, { desc: t.kind[litNow.kind], n: litNow.len }) : t.byteHint;
  if (at) {
    byteLine = fmt(t.byteInfo, {
      desc: t.kind[at.desc.kind], i: at.rel, field: at.field ? at.field.name : '-', value: at.field ? at.field.value : '-',
    });
    if (blk.owner && blk.owner[byteSel as number]) byteLine += ` · ${t.owner[blk.owner[byteSel as number] as string]}`;
  }
  const onBytesKey = (e: React.KeyboardEvent) => {
    const cols = getComputedStyle(e.currentTarget).gridTemplateColumns.split(' ').length || 16;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : e.key === 'ArrowUp' ? -cols : 0;
    if (!d) { if (e.key === 'Escape') setByteSel(null); return; }
    e.preventDefault();
    const n = blk.bytes.length;
    setByteSel((s) => (s === null ? 0 : Math.max(0, Math.min(n - 1, s + d))));
  };
  const onRowsKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const keys = dev.funcs.map((f) => f.key);
    const i = Math.max(0, keys.indexOf(block as FuncKey));
    const n = (i + d + keys.length) % keys.length;
    setBlock(keys[n]);
    (e.currentTarget.querySelectorAll('button')[n] as HTMLElement | undefined)?.focus();
  };

  // ---- right
  const value = partialHex(TR, tc);
  const busy = phase !== 'done';
  const cyc = cycleSel !== null ? TR.cycles[cycleSel] : null;
  const cycleLine = cyc
    ? fmt(t.cycleInfo, {
      k: cyc.k + 1, name: cyc.name, v: cyc.v === null ? 'Z' : cyc.v,
      who: cyc.field === 'trn' ? t.whoTrn : cyc.field === 'trn2' ? t.whoTrn2 : cyc.drv === 'host' ? t.whoHost : t.whoTarget,
    })
    : t.waveHint;
  const stateText = busy && !active && !reducedMotion ? `${t.state[phase]} · ${t.paused}` : t.state[phase];
  const live = (k: 'out' | 'in') => phase === k;
  const inShown = phase === 'done' || phase === 'in';
  const btnLabel = reducedMotion && step >= 0 ? t.next : t.read;

  const pathEl = (p: string) => p.split('/').map((s, i) => (
    <React.Fragment key={i}>{i > 0 && <i className={styles.sep}>/</i>}{s.trim()}</React.Fragment>
  ));

  return (
    <section className={styles.root} aria-label={t.aria} {...idleEvents}>
      <div className={styles.grid}>
      {/* ------------------------------------------------------------ composite device */}
      <div className={styles.dev}>
        <div className={styles.bar}>
          <span className={styles.path}>{pathEl(t.devPath)}</span>
          <span className={styles.meta}>{dev.vidpid} · USB 2.10</span>
        </div>
        <p className={styles.list}>
          <code className={styles.code}>{`{{${dev.funcs.map((f) => f.entry).join(', ')}}}`}</code>
          <span className={styles.note}>{t.listNote}</span>
        </p>
        <div className={styles.tree}>
          <span className={styles.trunk} aria-hidden="true" />
          <svg className={styles.plug} viewBox="0 0 30 40" aria-hidden="true">
            {/* USB-C plug, contacts toward the host on the left; its cable runs to the three classes */}
            <rect className={styles.plugShell} x="1.5" y="13.5" width="9" height="13" />
            <line className={styles.plugTongue} x1="4.5" y1="20" x2="10" y2="20" />
            <rect className={styles.plugBody} x="10.5" y="10.5" width="11" height="19" />
            <line className={styles.plugCable} x1="22" y1="20" x2="30" y2="20" />
          </svg>
          <div className={styles.rows} role="radiogroup" aria-label={t.rowsLabel} onKeyDown={onRowsKey}>
            {dev.funcs.map((f) => {
              const on = block === f.key;
              const epLive = f.key === 'dap' && (phase === 'out' || phase === 'in');
              return (
                <button
                  key={f.key} type="button" role="radio" aria-checked={on} tabIndex={on || (!dev.funcs.some((x) => x.key === block) && f.key === 'dap') ? 0 : -1}
                  className={styles.row} onClick={() => setBlock(f.key)} title={`${f.name} · ${f.triple}`}
                >
                  <span className={styles.line1}>
                    <span className={styles.itf}>{itfText(f, t)}</span>
                    <b>{t.func[f.key]}</b>
                  </span>
                  <span className={styles.eps} data-live={epLive ? 'true' : undefined}>
                    {epText(f, t).map((s) => <span key={s}>{s}</span>)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <p className={styles.sum} aria-label={t.sumLabel}>
          <span>{fmt(t.cfgSum, { n: dev.total })}</span>
          {([['cfg', dev.cfgHeader.len, t.cfgHead], ...dev.funcs.map((f) => [f.key, f.len, t.func[f.key]])] as [BlockKey, number, string][]).map(([k, n, lab], i) => (
            <React.Fragment key={k}>
              {i > 0 && <span className={styles.plus}>+</span>}
              <button type="button" className={styles.term} aria-pressed={block === k} title={lab} aria-label={`${lab} ${n} B`} onClick={() => setBlock(k)}>{n}</button>
            </React.Fragment>
          ))}
          <span className={styles.gap} />
          <button type="button" className={styles.term} aria-pressed={block === 'bos'} onClick={() => setBlock('bos')}>BOS {dev.bos.total} B</button>
          <button type="button" className={styles.term} aria-pressed={block === 'dev'} onClick={() => setBlock('dev')}>{t.devDesc} {USB.dev.length} B</button>
        </p>
        <div
          className={styles.hex} role="group" aria-label={t.bytesLabel} tabIndex={0} onKeyDown={onBytesKey} onPointerMove={inspectMove}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setByteSel(null); }}
        >
          {blk.bytes.map((b, i) => {
            const inField = (fieldRange && i >= fieldRange[0] && i < fieldRange[1]) || (litNow && i >= litNow.o && i < litNow.o + litNow.len);
            const di = descIndex(i);
            const first = blk.descs[di] && blk.descs[di].o === i;
            return (
              <span
                key={i} className={styles.byte} data-alt={di % 2 ? 'true' : undefined} data-first={first ? 'true' : undefined}
                data-on={inField ? 'true' : undefined} data-cur={byteSel === i ? 'true' : undefined}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setByteSel(i); }}
                onPointerDown={() => setByteSel(i)}
              >
                {h2(b)}
              </span>
            );
          })}
        </div>
        <p className={styles.readout} aria-live="polite">{byteLine}</p>
      </div>

      {/* ------------------------------------------------------------ SWD capture */}
      <div className={styles.swd}>
        <div className={styles.bar}>
          <span className={styles.path}>{pathEl(t.swdPath)}</span>
          <span className={styles.meta}>{stateText}</span>
        </div>
        <div className={styles.head}>
          <div className={styles.key}>
            <span className={styles.cap}>{t.keyCap}</span>
            <span className={styles.num} aria-live="off" data-partial={value.known < 32 ? 'true' : undefined}>{value.text}</span>
          </div>
          <button type="button" className={styles.btn} onClick={onRead} aria-pressed={busy}>{btnLabel}</button>
        </div>
        <div ref={waveBox} className={styles.waveBox} onPointerMove={inspectMove}>
          <Wave t={t} width={waveW} tc={tc} playing={phase === 'swd'} sel={cycleSel} onSel={setCycleSel} />
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span><i className={styles.swHost} />{t.legendHost}</span>
          <span><i className={styles.swTarget} />{t.legendTarget}</span>
          <span><i className={styles.swZ} />{t.legendZ}</span>
        </div>
        <p className={styles.readout}>{cycleLine}</p>
        <dl className={styles.usb} aria-label={t.usbLabel}>
          <div className={styles.usbRow} data-live={live('out') ? 'true' : undefined}>
            <dt>EP1 OUT</dt>
            <dd><code>{USB.dapReq.map(h2).join(' ')}</code><span>{t.outNote}</span></dd>
          </div>
          <div className={styles.usbRow} data-live={live('in') ? 'true' : undefined}>
            <dt>EP1 IN</dt>
            <dd>
              <code>{inShown ? USB.dapResp.map(h2).join(' ') : USB.dapResp.map(() => '··').join(' ')}</code>
              <span>{t.inNote}</span>
            </dd>
          </div>
        </dl>
        <dl className={styles.fields} aria-label={t.dpidrLabel} data-dim={value.known < 32 ? 'true' : undefined}>
          {dpidrFields(DPIDR).filter((f) => f.name !== 'MIN').map((f) => (
            <div key={f.name} className={styles.fd}>
              <dt>{f.name}<small>[{f.bits}]</small></dt>
              <dd>{f.value}{f.name === 'DESIGNER' ? ` ${t.designer}` : ''}</dd>
            </div>
          ))}
        </dl>
      </div>
      </div>
    </section>
  );
}
