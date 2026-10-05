// WebTerminal host (sim.ts) against the real runtime in static/showcase/webterminal/, under node (24+: sim.ts loads with type
// stripping). What the widget relies on is checked here: the start-up log, echo within one main-loop iteration, ls / led /
// Tab / history / unknown commands, button_click through the logger, the clock stopping while the page does not step it,
// the automatic demo, a fresh instance per reset.
//   node --test src/components/showcase/WebTerminal/sim.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHost, createDemo, normalizeInput, DEMO_KEYS, MAX_STEP_MS } from './sim.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RT = path.join(HERE, '..', '..', '..', '..', 'static', 'showcase', 'webterminal');
globalThis.require = createRequire(import.meta.url);
globalThis.__dirname = RT;
new Function(readFileSync(path.join(RT, 'libxr-rt.js'), 'utf8'))();
const WASM = await WebAssembly.compile(readFileSync(path.join(RT, 'libxr.wasm')));
const FRAME = 1000 / 60;
const dec = new TextDecoder();

async function boot() {
  const R = { out: '', leds: [], errors: [] };
  const ready = new Promise((r) => {
    R.host = createHost(globalThis.LibXRWasm, WASM, {
      output: (b) => { R.out += dec.decode(b); },
      led: (on) => R.leds.push(on),
      error: (m) => R.errors.push(m),
      ready: r,
    }, 1767225600000);
  });
  await ready;
  await new Promise((r) => setTimeout(r, 0));
  R.host.step(FRAME);                     // the page steps the main loop from the first frame after ready
  R.take = () => { const s = R.out; R.out = ''; return s; };
  // a key, then main-loop iterations until the runtime answers (and a few more for the rest of the answer)
  R.send = (s, max = 6) => {
    R.take(); R.host.input(s);
    for (let n = 1; n <= max; n++) { R.host.step(FRAME); if (R.out) { for (let k = 0; k < 3; k++) R.host.step(FRAME); return { frames: n, out: R.take() }; } }
    return { frames: null, out: '' };
  };
  R.line = (str) => { for (const ch of str) R.send(ch); };
  return R;
}

test('start-up log comes from the runtime as bytes, coloured by level', async () => {
  const R = await boot();
  const log = R.take();
  for (const [lvl, col, txt] of [['D', 35, 'This is a example for using libxr in web page'], ['I', 36, 'You can try input in this terminal'],
    ['P', 32, 'Press button to publish a message'], ['W', 33, "Input 'led on' or 'led off' to control led"], ['E', 31, "Press 'Enter' to start"]]) {
    assert.ok(log.includes(`\x1b[${col}m${lvl} [0](main.cpp:`) && log.includes(txt), `${lvl} line`);
  }
  assert.equal(R.host.tx, Buffer.byteLength(log));
  assert.equal(R.errors.length, 0);
});

test('every key is echoed by the runtime in the next main-loop iteration; Enter prints the prompt', async () => {
  const R = await boot(); R.take();
  const e = R.send('\r'); assert.equal(e.frames, 1); assert.equal(e.out, '\r\nramfs:/$ ');
  for (const ch of 'led') { const r = R.send(ch); assert.equal(r.frames, 1, 'key ' + ch); assert.equal(r.out, ch); }
  assert.equal(R.host.rx, 4);
});

test('nothing moves while the page does not step the main loop', async () => {
  const R = await boot(); R.take();
  const t0 = R.host.clockMs;
  R.host.input('\r');
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(R.take(), '', 'no echo without an iteration');
  assert.equal(R.host.clockMs, t0, 'runtime clock stopped');
  R.host.step(5000);
  assert.equal(R.host.clockMs, t0 + MAX_STEP_MS, 'one frame advances the clock by at most MAX_STEP_MS');
  assert.match(R.take(), /ramfs:\/\$ $/);
});

test('ls lists the RamFS root; led on / off drive the LED; an unknown command answers Command not found.', async () => {
  const R = await boot(); R.send('\r');
  R.line('ls'); assert.match(R.send('\r').out, /d bin\r\nd dev\r\nf led\r\nramfs:\/\$ $/);
  R.line('led on'); R.send('\r'); assert.equal(R.host.led, true);
  R.line('led off'); R.send('\r'); assert.equal(R.host.led, false);
  assert.deepEqual(R.leds, [true, false]);
  R.line('blink'); assert.match(R.send('\r').out, /\r\nCommand not found\.\r\nramfs:\/\$ $/);
});

test('Tab completes from the RamFS, arrow up recalls the history', async () => {
  const R = await boot(); R.send('\r');
  R.send('l'); assert.equal(R.send('\t').out, 'ed');
  R.line(' on'); R.send('\r');
  assert.equal(R.send('\x1b[A').out, '\x1b[2K\rramfs:/$ led on');
});

test('the board button calls button_click, which logs with the runtime clock in ms', async () => {
  const R = await boot(); R.take();
  for (let i = 0; i < 180; i++) R.host.step(FRAME);
  assert.ok(R.host.button());
  const out = R.take();
  assert.match(out, /\x1b\[36mI \[(\d+)\]\(main\.cpp:21\) button click/);
  const ms = +/\[(\d+)\]/.exec(out)[1];
  assert.ok(Math.abs(ms - R.host.clockMs) <= 1, `log time ${ms} vs runtime ${R.host.clockMs}`);
});

test('the automatic demo types Enter, ls, led on one key at a time and stops on request', async () => {
  const R = await boot(); R.take();
  const d = createDemo();
  const sent = [];
  while (d.running) { d.advance(FRAME, (k) => { sent.push(k); R.host.input(k); }); R.host.step(FRAME); }
  for (let i = 0; i < 4; i++) R.host.step(FRAME);
  assert.equal(sent.join(''), DEMO_KEYS.map((k) => k[1]).join(''));
  assert.equal(sent.join(''), '\rls\rled on\r');
  const screen = R.take();
  assert.match(screen, /ramfs:\/\$ ls\r\nd bin\r\nd dev\r\nf led\r\n/);
  assert.equal(R.host.led, true);
  const d2 = createDemo(); const got = [];
  d2.advance(1200, (k) => got.push(k)); assert.equal(d2.stop(), ''); d2.advance(10000, (k) => got.push(k));
  assert.deepEqual(got, ['\r']); assert.equal(d2.running, false);
});

test('a demo stopped mid-line returns its unfinished command; DEL keys erase it in the runtime', async () => {
  const R = await boot(); R.take();
  const d = createDemo();
  let screen = '';
  while (!screen.endsWith('ramfs:/$ le')) { d.advance(FRAME, (k) => R.host.input(k)); R.host.step(FRAME); screen += R.take(); }
  const rest = d.stop();
  assert.equal(rest, 'le');
  assert.equal(d.stop(), '', 'a second stop returns nothing');
  const e = R.send('\x7f'.repeat(rest.length));
  assert.equal(e.out, '\b \b\b \b');
  assert.equal(R.send('\r').out, '\r\nramfs:/$ ', 'an empty line: no Command not found.');
});

test('reset is a fresh runtime; a disposed one is silent', async () => {
  const A = await boot(); A.send('\r'); A.line('led on'); A.send('\r'); assert.equal(A.host.led, true);
  A.host.dispose(); A.take();
  A.host.step(FRAME); assert.equal(A.host.input('x'), false); assert.equal(A.take(), '');
  const B = await boot();
  assert.match(B.take(), /Press 'Enter' to start/);
  assert.equal(B.host.led, false);
});

test('pasted line ends become the CR an Enter key sends', () => {
  assert.equal(normalizeInput('ls\r\nled on\nx\r'), 'ls\rled on\rx\r');
});

// ---------------------------------------------------------------- self-playing loop (createAutopilot)
test('autopilot: Enter + ls first, then led on, led off, a button press, every ~15 s, around again', async () => {
  const { createAutopilot, AUTO_PERIOD_MS } = await import('./sim.ts');
  const ap = createAutopilot();
  const typed = [];
  let presses = 0;
  const io = { send: (k) => typed.push(k), button: () => { presses += 1; } };
  for (let t = 0; t < 120000; t += 20) ap.advance(20, false, io);
  const cmds = typed.join('').split('\r').filter((x) => x.length);
  assert.deepEqual(cmds.slice(0, 5), ['ls', 'led on', 'led off', 'ls', 'led on']);
  assert.equal(typed[0], '\r', 'the first thing sent is the Enter the runtime waits for');
  assert.ok(presses >= 1 && presses <= 2, `button presses ${presses}`);
  // 120 s: about 15 s between actions -> 7 or 8 actions
  assert.ok(ap.count >= 6 && ap.count <= 9, `actions ${ap.count}`);
  assert.ok(AUTO_PERIOD_MS === 15000);
});

test('autopilot: paused holds the wait, a command being typed finishes, stop() ends it for good and returns the half line', async () => {
  const { createAutopilot } = await import('./sim.ts');
  const typed = [];
  const io = { send: (k) => typed.push(k), button() {} };
  const ap = createAutopilot();
  for (let t = 0; t < 60000; t += 20) ap.advance(20, true, io);
  assert.equal(ap.count, 0, 'nothing starts while paused');
  assert.equal(typed.length, 0);
  for (let t = 0; t < 1300; t += 20) ap.advance(20, false, io);
  assert.equal(ap.count, 1);
  // typing continues even when a pause arrives mid-command
  for (let t = 0; t < 1500; t += 20) ap.advance(20, true, io);
  assert.ok(typed.length >= 2);
  // stop mid-line
  const ap2 = createAutopilot();
  const t2 = [];
  const io2 = { send: (k) => t2.push(k), button() {} };
  for (let t = 0; t < 3000; t += 20) { ap2.advance(20, false, io2); if (t2.join('').endsWith('l') && ap2.typing) break; }
  const rest = ap2.stop();
  assert.equal(rest, 'l');
  const n = t2.length;
  for (let t = 0; t < 60000; t += 20) ap2.advance(20, false, io2);
  assert.equal(t2.length, n, 'sends nothing after stop');
  assert.equal(ap2.stopped, true);
});

test('autopilot: cancelTyping drops the half-typed command and waits a full period', async () => {
  const { createAutopilot, AUTO_PERIOD_MS } = await import('./sim.ts');
  const typed = [];
  const ap = createAutopilot();
  const io = { send: (k) => typed.push(k), button() {} };
  for (let t = 0; t < 3000 && !(typed.join('').endsWith('l') && ap.typing); t += 20) ap.advance(20, false, io);
  assert.ok(ap.typing);
  ap.cancelTyping();
  assert.equal(ap.typing, false);
  const n = typed.length;
  for (let t = 0; t < AUTO_PERIOD_MS - 100; t += 20) ap.advance(20, false, io);
  assert.equal(typed.length, n);
  for (let t = 0; t < 400; t += 20) ap.advance(20, false, io);
  assert.equal(ap.count, 2);
});
