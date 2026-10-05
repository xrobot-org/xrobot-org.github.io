/* WebTerminal: the LibXR web demo running in the page. A terminal (xterm) whose every key goes unchanged into the runtime's
   receive_input; echo, completion, history, the prompt and "Command not found." are the runtime's own output. Beside it a
   small board with the demo's LED (set_led from `led on` / `led off`) and Button (button_click), plus a reset that starts a
   fresh runtime instance.
   - The runtime (static/showcase/webterminal/, about 126 KB of WebAssembly) and xterm load the first time `active` is true.
   - The page drives the main loop: one iteration per animation frame while `active`; otherwise the loop and the runtime
     clock stop (sim.ts).
   - Self-playing (sim.ts createAutopilot, not with reducedMotion): while nobody has used the terminal, one command is typed
     about every 15 s of runtime time, one key at a time (`ls`, `led on`, `led off`, a press of the board button, around
     again). The first user key, click or focus in the terminal ends it for good. A hover, press or key on the board
     only holds it for 8 s of quiet (autoplay.ts).
   - The wheel and touch scrolling stay with the page; Esc gives the keyboard back.
   xterm (@xterm/xterm, @xterm/addon-fit, with its stylesheet) is a dependency loaded by dynamic import on first activation,
   since it only runs in the browser. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { createAutopilot, createHost, normalizeInput, MAX_STEP_MS } from './sim';
import type { Autopilot, Host, RuntimeFactory } from './sim';
import { useIdleGate } from '../useIdleGate';
import styles from './styles.module.css';

type ShowcaseProps = { active: boolean; reducedMotion: boolean };
type Phase = 'idle' | 'loading' | 'ready' | 'error';

const BANNER = '\x1b[1;36m[ New Terminal Initialized ]\x1b[0m\r\n'; // the demo page's own banner (inject.js)
const NARROW_PX = 560;
const FONT_FALLBACK = 'ui-monospace, "Cascadia Mono", Consolas, monospace';

// ---------------------------------------------------------------- loaders, shared by every instance on the page
const loads = new Map<string, Promise<unknown>>();
function once<T>(key: string, make: () => Promise<T>): Promise<T> {
  let p = loads.get(key) as Promise<T> | undefined;
  if (!p) {
    p = make();
    loads.set(key, p);
    p.catch(() => loads.delete(key));
  }
  return p;
}
const loadScript = (src: string) => once(src, () => new Promise<void>((resolve, reject) => {
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.onload = () => resolve();
  s.onerror = () => reject(new Error('load ' + src));
  document.head.appendChild(s);
}));
const loadXterm = () => once('xterm', () => Promise.all([
  import('@xterm/xterm'),
  import('@xterm/addon-fit'),
  import('@xterm/xterm/css/xterm.css'),
]).then(([xterm, fit]) => ({ Terminal: xterm.Terminal, FitAddon: fit.FitAddon })));
const loadWasm = (url: string) => once(url, () => fetch(url)
  .then((r) => { if (!r.ok) throw new Error(`libxr.wasm ${r.status}`); return r.arrayBuffer(); })
  .then((b) => WebAssembly.compile(b)));

let userTookOver = false; // the user has used a terminal on this page: the self-playing does not start again

// xterm colours from XRobot Style tokens: paper-sunken / ink; the log levels' ANSI colours map onto the four data channels
// (red, the ERROR level, stays ink: status colours belong to Status, and the level letter E is printed anyway)
function termTheme(el: Element): Record<string, string> {
  const cs = getComputedStyle(el);
  const v = (n: string) => cs.getPropertyValue('--' + n).trim();
  const ink = v('ink'), muted = v('ink-muted'), bg = v('paper-sunken');
  const t: Record<string, string> = {
    background: bg, foreground: ink, cursor: ink, cursorAccent: bg,
    selectionBackground: ink, selectionForeground: v('on-ink'), selectionInactiveBackground: v('line-strong'),
    black: muted, red: ink, green: v('ch3'), yellow: v('ch0'), blue: muted, magenta: v('ch2'), cyan: v('ch1'), white: ink,
    brightBlack: muted, brightRed: ink, brightGreen: v('ch3'), brightYellow: v('ch0'), brightBlue: muted, brightMagenta: v('ch2'),
    brightCyan: v('ch1'), brightWhite: ink,
  };
  for (const k of Object.keys(t)) if (!t[k]) delete t[k];
  return t;
}

type Refs = {
  term: any; fit: any; host: Host | null; pilot: Autopilot | null; wasm: WebAssembly.Module | null; gen: number;
  touched: boolean; clockKey: number; rx: number; tx: number; dead: boolean;
};

export default function WebTerminal({ active, reducedMotion }: ShowcaseProps): JSX.Element {
  const base = useBaseUrl('/showcase/webterminal/');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const xhostRef = useRef<HTMLDivElement>(null);
  const R = useRef<Refs>({ term: null, fit: null, host: null, pilot: null, wasm: null, gen: 0, touched: false, clockKey: -1, rx: -1, tx: -1, dead: false }).current;
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [led, setLed] = useState(false);
  const [io, setIo] = useState({ rx: 0, tx: 0 });
  const [clockMs, setClockMs] = useState(0);
  const [focus, setFocus] = useState(false);          // the terminal has the keyboard
  const [panelFocus, setPanelFocus] = useState(false); // the panel (the terminal's tab stop) has it
  const [demoOn, setDemoOn] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const { idle, props: idleEvents } = useIdleGate();
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  // the first key, click or focus the user gives the terminal ends the self-playing for good; a command it left half typed is
  // erased with DEL keys sent to the runtime like any other key, so the user starts on an empty prompt
  const stopDemo = useCallback(() => {
    R.touched = true;
    userTookOver = true;
    if (!R.pilot) return;
    const rest = R.pilot.stop();
    R.pilot = null;
    if (rest && R.host) R.host.input(''.repeat(rest.length));
    setDemoOn(false);
  }, [R]);

  // a fresh runtime instance: own memory, main() runs again and prints its start-up log
  const boot = useCallback(() => {
    const gen = ++R.gen;
    if (R.host) R.host.dispose();
    R.clockKey = -1;
    setLed(false);
    R.host = createHost((window as any).LibXRWasm as RuntimeFactory, R.wasm as WebAssembly.Module, {
      output: (b) => { if (R.gen === gen && R.term) R.term.write(b); },
      led: (on) => { if (R.gen === gen) setLed(on); },
      ready: () => { if (R.gen === gen && !R.dead) setPhase('ready'); },
      error: (m) => { if (R.gen !== gen || R.dead) return; setError(m); setPhase('error'); },
    });
  }, [R]);

  // keyboard: the panel is the tab stop (Enter goes in), the xterm textarea is not; Esc comes back out to the panel, so Tab
  // then moves on to the board instead of back into the terminal
  const release = useCallback(() => {
    if (R.term) R.term.blur();
    const p = panelRef.current;
    if (p) { p.dataset.ring = 'true'; p.focus(); }   // the ring shows where the keyboard went, whatever :focus-visible guesses
  }, [R]);

  // ---------------------------------------------------------------- load on first activation
  useEffect(() => {
    if (!active || phase !== 'idle') return;
    setPhase('loading');
    Promise.all([
      loadXterm(),
      loadScript(base + 'libxr-rt.js'),
      loadWasm(base + 'libxr.wasm'),
    ]).then(([xterm, , wasm]) => {
      const W = window as any;
      if (R.dead || !xhostRef.current || !rootRef.current) return;
      if (!W.LibXRWasm) throw new Error('LibXRWasm missing');
      R.wasm = wasm as WebAssembly.Module;
      const cs = getComputedStyle(rootRef.current);
      const narrowNow = rootRef.current.clientWidth < NARROW_PX;
      const term = new xterm.Terminal({
        convertEol: true, cursorBlink: false, scrollback: 0, lineHeight: 1.2,
        fontSize: narrowNow ? 12 : 14, fontFamily: cs.getPropertyValue('--font-mono').trim() || FONT_FALLBACK,
        theme: termTheme(rootRef.current),
      });
      const fit = new xterm.FitAddon();
      term.loadAddon(fit);
      term.open(xhostRef.current);
      try { fit.fit(); } catch (e) { /* zero-size container: the resize observer fits later */ }
      term.attachCustomWheelEventHandler(() => false);   // the wheel scrolls the page (and never recalls history)
      term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
        if (e.key !== 'Escape') return true;
        if (e.type === 'keydown') release();
        return false;
      });
      term.onData((d: string) => { stopDemo(); if (R.host) R.host.input(normalizeInput(d)); });
      if (term.textarea) {
        term.textarea.tabIndex = -1;
        term.textarea.addEventListener('focus', () => { setFocus(true); stopDemo(); });
        term.textarea.addEventListener('blur', () => setFocus(false));
      }
      term.write(BANNER);
      R.term = term;
      R.fit = fit;
      boot();
    }).catch((e: Error) => {
      if (R.dead) return;
      setError(e.message || String(e));
      setPhase('error');
      console.warn('WebTerminal:', e);
    });
  }, [active, phase, base, R, boot, release, stopDemo]);

  // ---------------------------------------------------------------- main loop: one iteration per frame while active
  useEffect(() => {
    if (!active || phase !== 'ready') return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(Math.max(now - last, 0), MAX_STEP_MS);
      last = now;
      const h = R.host;
      if (h) {
        if (R.pilot) R.pilot.advance(dt, idle.paused(now), { send: (k) => h.input(k), button: () => h.button() });
        h.step(dt);
        const key = Math.floor(h.clockMs / (reducedRef.current ? 1000 : 100));
        if (key !== R.clockKey) { R.clockKey = key; setClockMs(h.clockMs); }
        if (h.rx !== R.rx || h.tx !== R.tx) { R.rx = h.rx; R.tx = h.tx; setIo({ rx: h.rx, tx: h.tx }); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, phase, R, idle]);

  // ---------------------------------------------------------------- self-playing: starts when the runtime is ready
  useEffect(() => {
    if (phase !== 'ready' || !active || reducedMotion || userTookOver || R.touched || R.pilot) return;
    R.pilot = createAutopilot();
    setDemoOn(true);
  }, [phase, active, reducedMotion, R]);
  // reduced motion switched on later: the loop ends, a half-typed command is erased; the terminal stays usable
  useEffect(() => {
    if (!reducedMotion || !R.pilot) return;
    const rest = R.pilot.stop();
    R.pilot = null;
    if (rest && R.host) R.host.input(''.repeat(rest.length));
    setDemoOn(false);
  }, [reducedMotion, R]);

  // ---------------------------------------------------------------- theme, size
  useEffect(() => {
    if (phase === 'idle') return undefined;
    const apply = () => { if (R.term && rootRef.current) R.term.options.theme = termTheme(rootRef.current); };
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    apply();
    return () => mo.disconnect();
  }, [phase, R]);

  useEffect(() => {
    const root = rootRef.current, xhost = xhostRef.current;
    if (!root || !xhost || typeof ResizeObserver === 'undefined') return undefined;
    let raf = 0;
    const refit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const n = root.clientWidth < NARROW_PX;
        setNarrow(n);
        if (R.term) {
          const fs = n ? 12 : 14;
          if (R.term.options.fontSize !== fs) R.term.options.fontSize = fs;
          try { R.fit.fit(); } catch (e) { /* not laid out yet */ }
        }
      });
    };
    const ro = new ResizeObserver(refit);
    ro.observe(root);
    ro.observe(xhost);
    refit();
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [R, phase]);

  useEffect(() => () => {
    R.dead = true;
    R.gen++;
    if (R.host) R.host.dispose();
    if (R.term) R.term.dispose();
    R.host = null;
    R.term = null;
  }, [R]);

  // ---------------------------------------------------------------- board
  const onButton = () => { if (R.host) R.host.button(); };
  const onReset = () => {
    if (R.pilot) R.pilot.cancelTyping();      // the runtime starts over: a command in the middle of typing is dropped
    if (!R.term || !R.wasm) return;           // still loading: the runtime starts on its own
    R.term.reset();
    R.term.write(BANNER);
    if (phase === 'error') { setError(''); setPhase('loading'); }
    boot();
  };
  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.target === e.currentTarget && e.key === 'Enter' && R.term) { e.preventDefault(); R.term.focus(); }
  };
  const onPanelFocus = (e: React.FocusEvent) => setPanelFocus(e.target === e.currentTarget);
  const onScreenDown = (e: React.MouseEvent) => {   // the padding around the xterm element focuses it too
    stopDemo();
    if (R.term && !(e.target as Element).closest('.xterm')) { e.preventDefault(); R.term.focus(); }
  };

  // ---------------------------------------------------------------- text
  const secs = reducedMotion ? String(Math.floor(clockMs / 1000)) : (clockMs / 1000).toFixed(1);
  const state =
    phase === 'idle' ? translate({ id: 'showcase.webterminal.state.idle', message: '未加载' })
    : phase === 'loading' ? translate({ id: 'showcase.webterminal.state.loading', message: '加载中' })
    : phase === 'error' ? translate({ id: 'showcase.webterminal.state.error', message: '加载失败' })
    : active ? translate({ id: 'showcase.webterminal.state.running', message: '运行时间 {s} s' }, { s: secs })
    : translate({ id: 'showcase.webterminal.state.paused', message: '已暂停 · {s} s' }, { s: secs });
  const hint =
    demoOn ? translate({ id: 'showcase.webterminal.hint.demo', message: '自动演示：每隔一段时间输入一条命令；在终端中按键或点击即停止' })
    : focus ? translate({ id: 'showcase.webterminal.hint.focus', message: '键盘输入直接送入运行时；Esc 退出终端' })
    : panelFocus && phase === 'ready' ? translate({ id: 'showcase.webterminal.hint.enter', message: '按 Enter 进入终端输入' })
    : translate({ id: 'showcase.webterminal.hint.idle', message: '点击终端后输入命令，例如 led on；Esc 退出终端' });
  const pathTerm = translate({ id: 'showcase.webterminal.path', message: 'LIBXR / WASM / TERMINAL' });
  const pathBoard = translate({ id: 'showcase.webterminal.board.path', message: 'LIBXR / WASM / BOARD' });
  const path = (p: string) => p.split('/').map((s, i) => (
    <React.Fragment key={i}>{i > 0 && <i className={styles.sep}>/</i>}{s.trim()}</React.Fragment>
  ));

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-narrow={narrow ? 'true' : 'false'}
      role="group"
      aria-label={translate({ id: 'showcase.webterminal.label', message: 'LibXR 网页终端' })}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        tabIndex={0}
        aria-label={translate({ id: 'showcase.webterminal.panel.label', message: 'LibXR 终端：Enter 进入输入，Esc 退出' })}
        onKeyDown={onPanelKey}
        onFocus={onPanelFocus}
        onBlur={(e) => { setPanelFocus(false); delete e.currentTarget.dataset.ring; }}
      >
        <div className={styles.bar}>
          <span className={styles.path}>{path(pathTerm)}</span>
          <span
            className={styles.state}
            title={translate({ id: 'showcase.webterminal.state.title', message: '运行时时钟：日志方括号中的毫秒数来自这一时钟' })}
          >
            {state}
          </span>
        </div>
        <div className={styles.screen} onMouseDown={onScreenDown}>
          <div ref={xhostRef} className={styles.xhost} />
          {phase !== 'ready' && (
            <div className={styles.overlay}>
              {phase === 'error' ? (
                <>
                  <p>{translate({ id: 'showcase.webterminal.screen.error', message: 'LibXR 运行时没有加载成功：{message}' }, { message: error })}</p>
                  <p>{translate({ id: 'showcase.webterminal.screen.retry', message: '刷新页面后重试。' })}</p>
                </>
              ) : (
                <p>
                  {phase === 'idle'
                    ? translate({ id: 'showcase.webterminal.screen.idle', message: '进入视口后加载 LibXR 运行时（libxr.wasm，126 KB）' })
                    : translate({ id: 'showcase.webterminal.screen.loading', message: '正在加载 LibXR 运行时（libxr.wasm，126 KB）' })}
                </p>
              )}
            </div>
          )}
        </div>
        <div className={styles.hint}>{hint}</div>
      </div>

      <div className={styles.board} {...idleEvents} role="group" aria-label={translate({ id: 'showcase.webterminal.board.label', message: '板上的 LED 和按键' })}>
        <span className={styles.path}>{path(pathBoard)}</span>
        <div className={styles.part}>
          <div className={styles.ledRow}>
            <span className={styles.led} data-on={led ? 'true' : 'false'} aria-hidden="true" />
            <span className={styles.name}>{translate({ id: 'showcase.webterminal.led.name', message: 'LED' })}</span>
            <span className={styles.ledState} aria-live="polite">
              {led
                ? translate({ id: 'showcase.webterminal.led.on', message: '亮' })
                : translate({ id: 'showcase.webterminal.led.off', message: '灭' })}
            </span>
          </div>
          <span className={styles.note}>{translate({ id: 'showcase.webterminal.led.note', message: '终端命令 led on / led off' })}</span>
        </div>
        <div className={styles.part}>
          <button type="button" className={styles.btn} onClick={onButton}>
            {translate({ id: 'showcase.webterminal.button.label', message: '按键' })}
          </button>
          <span className={styles.note}>{translate({ id: 'showcase.webterminal.button.note', message: '调用 button_click()，运行时打印一行日志' })}</span>
        </div>
        <div className={styles.part}>
          <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onReset}>
            {translate({ id: 'showcase.webterminal.reset.label', message: '复位' })}
          </button>
          <span className={styles.note}>{translate({ id: 'showcase.webterminal.reset.note', message: '重新实例化运行时，再次执行 main()' })}</span>
        </div>
        <div className={styles.meta}>
          <span>{translate({ id: 'showcase.webterminal.io', message: '收 {rx} B · 发 {tx} B' }, { rx: io.rx, tx: io.tx })}</span>
          <span>{translate({ id: 'showcase.webterminal.size', message: 'libxr.wasm · 126 KB' })}</span>
        </div>
      </div>
    </div>
  );
}
