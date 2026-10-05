/* WebTerminal runtime host. No DOM: runs in the browser and under node (sim.test.mjs).

   The runtime is the LibXR web demo that xrobot.work serves (libxr_web_demo main.cpp: Terminal<32, 512, 10, 16> on a RamFS
   with an `led` command, the terminal as a 10 ms timer task, a main loop that only calls RefreshTimerInIdle), repackaged into static/showcase/webterminal/libxr-rt.js + libxr.wasm:
     - window.LibXRWasm(Module, H) is a factory: every call is a fresh runtime (own memory, own main()).
     - H.raf(fn) receives the main loop (emscripten_set_main_loop(loop, 0, 1)); the page runs one iteration per frame.
     - H.now() / H.date() are the runtime's clock, so the clock stops while the page pauses the main loop.
     - turn_led_on / turn_led_off reach Module.set_led(true / false); output arrives byte by byte through Module.put_char.
   Keys go in unchanged through receive_input; echo, completion, history and "Command not found." come back from the runtime. */

export type MainLoopFn = (t: number) => void;
export type RuntimeClock = { raf: (fn: MainLoopFn) => void; now: () => number; date: () => number };
export type RuntimeFactory = (Module: Record<string, any>, H: RuntimeClock) => unknown;

export type HostEvents = {
  output?: (bytes: Uint8Array) => void;
  led?: (on: boolean) => void;
  ready?: () => void;
  error?: (message: string) => void;
};

export type Host = {
  readonly ready: boolean;
  readonly failed: string | null;
  readonly led: boolean;
  readonly rx: number;
  readonly tx: number;
  readonly frames: number;
  readonly clockMs: number;
  step: (ms: number) => void;
  input: (data: string) => boolean;
  button: () => boolean;
  dispose: () => void;
};

/** a page frame never advances the runtime clock by more than this (a stalled tab does not replay seconds of timer ticks) */
export const MAX_STEP_MS = 100;

const utf8Length = (s: string): number => {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; }
    else n += 3;
  }
  return n;
};

/** paste and IME text: CR LF and LF become the CR an Enter key sends */
export const normalizeInput = (data: string): string => data.replace(/\r\n?|\n/g, '\r');

export function createHost(factory: RuntimeFactory, wasm: WebAssembly.Module, ev: HostEvents = {}, epochMs = Date.now()): Host {
  let alive = true;
  let ready = false;
  let failed: string | null = null;
  let queue: MainLoopFn[] = [];
  let clock = 0;
  let out: number[] = [];
  let flushQueued = false;
  const st = { led: false, rx: 0, tx: 0, frames: 0 };

  const fail = (e: unknown) => {
    if (!alive || failed) return;
    failed = e instanceof Error ? e.message : String(e);
    ev.error?.(failed);
  };
  const flush = () => {
    flushQueued = false;
    if (!alive || out.length === 0) return;
    const bytes = Uint8Array.from(out);
    out = [];
    st.tx += bytes.length;
    ev.output?.(bytes);
  };
  // put_char gets one byte per call (String.fromCharCode of a byte); the bytes are UTF-8 and go to the terminal as such
  const put = (s: string) => {
    if (!alive) return;
    for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
    if (!flushQueued) { flushQueued = true; queueMicrotask(flush); }
  };

  const M: Record<string, any> = {
    put_char: put,
    put_chars: put,
    set_led(on: boolean) { if (!alive) return; st.led = !!on; ev.led?.(st.led); },
    print() {},
    printErr() {},
    instantiateWasm(imports: WebAssembly.Imports, done: (inst: WebAssembly.Instance, mod: WebAssembly.Module) => void) {
      WebAssembly.instantiate(wasm, imports).then((inst) => { if (alive) done(inst, wasm); }, fail);
      return {};
    },
    onRuntimeInitialized() { if (!alive) return; ready = true; queueMicrotask(() => { if (alive && !failed) ev.ready?.(); }); },
    onAbort(what: unknown) { fail(what); },
  };
  const H: RuntimeClock = {
    raf: (fn) => { if (alive) queue.push(fn); },
    now: () => 1000 + clock,
    date: () => epochMs + clock,
  };
  try { factory(M, H); } catch (e) { fail(e); }

  const usable = () => alive && ready && !failed && !!M.calledRun;
  return {
    get ready() { return usable(); },
    get failed() { return failed; },
    get led() { return st.led; },
    get rx() { return st.rx; },
    get tx() { return st.tx; },
    get frames() { return st.frames; },
    get clockMs() { return clock; },
    // one main-loop iteration: RefreshTimerInIdle catches the timer list up to the runtime clock and runs the terminal task
    // when its 10 ms are due
    step(ms: number) {
      if (!usable()) return;
      clock += Math.min(Math.max(ms, 0), MAX_STEP_MS);
      const fns = queue;
      queue = [];
      for (const fn of fns) {
        try { fn(clock); } catch (e) { if (e !== 'unwind') fail(e); }
      }
      st.frames++;
      flush();
    },
    input(data: string) {
      if (!usable() || !data) return false;
      M.ccall('receive_input', null, ['string'], [data]);
      st.rx += utf8Length(data);
      flush();
      return true;
    },
    button() {
      if (!usable()) return false;
      M.ccall('button_click', null, [], []);
      flush();
      return true;
    },
    dispose() { alive = false; queue = []; out = []; },
  };
}

/* The automatic demo: Enter (the runtime asks for it), `ls`, `led on`, one key at a time through receive_input.
   Each entry is [ms to wait before the key, key]. Time only runs while the page steps it, so the demo pauses with the main loop. */
export const DEMO_KEYS: ReadonlyArray<readonly [number, string]> = [
  [1200, '\r'],
  [900, 'l'], [130, 's'], [260, '\r'],
  [1100, 'l'], [130, 'e'], [130, 'd'], [130, ' '], [130, 'o'], [130, 'n'], [260, '\r'],
];

/** stop() returns what the demo typed on the current line and did not send Enter for, so the caller can erase it (DEL keys
    through receive_input) and the user starts on a clean prompt */
export type Demo = { advance: (ms: number, send: (key: string) => void) => void; stop: () => string; readonly running: boolean };

export function createDemo(keys: ReadonlyArray<readonly [number, string]> = DEMO_KEYS): Demo {
  let i = 0;
  let wait = 0;
  let stopped = false;
  let line = '';
  return {
    advance(ms, send) {
      if (stopped) return;
      wait += ms;
      while (i < keys.length && wait >= keys[i][0]) {
        const k = keys[i][1];
        wait -= keys[i][0];
        send(k);
        line = k === '\r' ? '' : line + k;
        i++;
      }
    },
    stop() {
      if (stopped) return '';
      stopped = true;
      return line;
    },
    get running() { return !stopped && i < keys.length; },
  };
}

/* The self-playing loop that replaces the one-shot demo: while nobody has used the terminal, the page types one command about
   every AUTO_PERIOD_MS of runtime time, in turn `ls`, `led on`, `led off`, and a press of the board button. The first one
   starts with the Enter the runtime asks for. Time is the page's stepped time, so it pauses with the main loop. `paused`
   (a hand on a board control) holds the wait; a command already being typed finishes. The user's first key or click in the
   terminal ends it for good (stop()). */
export const AUTO_FIRST_MS = 1200;
export const AUTO_PERIOD_MS = 15000;
export type AutoAction = { type: 'command'; text: string } | { type: 'button' };
export const AUTO_ACTIONS: ReadonlyArray<AutoAction> = [
  { type: 'command', text: 'ls' },
  { type: 'command', text: 'led on' },
  { type: 'command', text: 'led off' },
  { type: 'button' },
];

/** keys for one command, a human pace: [ms to wait before the key, key] */
export function commandKeys(text: string, lead = 900): Array<readonly [number, string]> {
  const keys: Array<readonly [number, string]> = [];
  [...text].forEach((ch, i) => keys.push([i === 0 ? lead : 130, ch]));
  keys.push([260, '\r']);
  return keys;
}

export type AutoIO = { send: (key: string) => void; button: () => void };
export type Autopilot = {
  advance: (ms: number, paused: boolean, io: AutoIO) => void;
  /** ends the loop for good; returns what is typed on the current line without Enter (for the caller to erase) */
  stop: () => string;
  /** drops a command being typed (the runtime was reset) and waits a full period before the next one */
  cancelTyping: () => void;
  readonly stopped: boolean;
  readonly typing: boolean;
  /** actions done so far */
  readonly count: number;
};

export function createAutopilot(
  actions: ReadonlyArray<AutoAction> = AUTO_ACTIONS, firstMs: number = AUTO_FIRST_MS, periodMs: number = AUTO_PERIOD_MS,
): Autopilot {
  let n = 0;
  let wait = 0;
  let nextAt = firstMs;
  let keys: Array<readonly [number, string]> = [];
  let ki = 0;
  let kwait = 0;
  let line = '';
  let stopped = false;
  return {
    advance(ms, paused, io) {
      if (stopped) return;
      if (ki < keys.length) {
        kwait += ms;
        while (ki < keys.length && kwait >= keys[ki][0]) {
          const k = keys[ki][1];
          kwait -= keys[ki][0];
          io.send(k);
          line = k === '\r' ? '' : line + k;
          ki++;
        }
        if (ki >= keys.length) { keys = []; ki = 0; kwait = 0; wait = 0; nextAt = periodMs; }
        return;
      }
      if (paused) return;
      wait += ms;
      if (wait < nextAt) return;
      const a = actions[n % actions.length];
      const first = n === 0;
      n++;
      if (a.type === 'button') { io.button(); wait = 0; nextAt = periodMs; return; }
      keys = commandKeys(a.text, first ? 900 : 700);
      if (first) keys.unshift([0, '\r']);   // the runtime waits for Enter before it shows a prompt
      ki = 0; kwait = 0;
    },
    stop() {
      if (stopped) return '';
      stopped = true;
      return line;
    },
    cancelTyping() { keys = []; ki = 0; kwait = 0; line = ''; wait = 0; nextAt = periodMs; },
    get stopped() { return stopped; },
    get typing() { return !stopped && ki < keys.length; },
    get count() { return n; },
  };
}
