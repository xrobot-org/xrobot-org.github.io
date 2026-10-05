// Unit tests for SameCode/sim.ts. Run: node src/components/showcase/SameCode/sim.test.ts (Node 22.6+).
import assert from 'node:assert/strict';
import {
  BOARDS,
  BLINK_CYCLE_MS,
  CONFIG_CODE,
  MODULE_CODE,
  REGISTERED_NAME,
  BOARD_RECT,
  STAGE_H,
  STAGE_W,
  TAG,
  bindingPoints,
  fit,
  laneTicks,
  ledLevel,
  nextBoard,
  plainText,
  splitMarks,
  tracePoints,
} from './sim.ts';
import { BOARD_ART } from './art.ts';

// BlinkLED: flag_ starts false and the timer toggles it every blink_cycle ms.
assert.equal(ledLevel(0), false);
assert.equal(ledLevel(BLINK_CYCLE_MS - 1), false);
assert.equal(ledLevel(BLINK_CYCLE_MS), true);
assert.equal(ledLevel(2 * BLINK_CYCLE_MS), false);
assert.equal(ledLevel(3 * BLINK_CYCLE_MS + 10), true);

// The trace ends at the current level and has two points per edge.
for (const t of [3000, 3125, 3374, 5000.5]) {
  const points = tracePoints(t, 3000, 3, 21).split(' ').map((p) => p.split(',').map(Number));
  const last = points[points.length - 1];
  assert.equal(last[0], 3000);
  assert.equal(last[1], ledLevel(t) ? 3 : 21);
  assert.equal(points[0][0], 0);
  assert.ok(points.length >= 2 + 2 * 11 && points.length <= 2 + 2 * 12, `edges in 3 s at t=${t}: ${points.length}`);
  for (let i = 1; i < points.length; i++) assert.ok(points[i][0] >= points[i - 1][0], 'x is monotonic');
}

// Marks: the registered name in the configuration and in every entry source.
assert.deepEqual(
  splitMarks(CONFIG_CODE).filter((r) => r.mark === 'name').map((r) => r.text),
  [REGISTERED_NAME],
);
assert.ok(!MODULE_CODE.includes('⟦'), 'the Module names no device');
assert.match(plainText(CONFIG_CODE), /- led: LED\n {4}- blink_cycle: 250$/);

const ids = new Set<string>();
for (const board of BOARDS) {
  ids.add(board.id);
  const text = plainText(board.entry);
  assert.ok(text.includes(`XR_REGISTER(${REGISTERED_NAME}, LibXR::GPIO);`), `${board.id}: registers LED as LibXR::GPIO`);
  assert.equal(splitMarks(board.entry).filter((r) => r.mark === 'name').length, 2, `${board.id}: object and registration`);
  assert.equal(splitMarks(board.entry).filter((r) => r.mark === 'pin').length, 1, `${board.id}: one pin argument run`);
  const art = BOARD_ART[board.id];
  assert.ok(art, `${board.id}: drawing anchors`);
  assert.equal(board.art, `/showcase/samecode/${board.id}.svg`);
  const box = fit(art.viewBox, BOARD_RECT);
  const inStage = ([x, y]: number[]) => x >= 0 && x <= STAGE_W && y >= 0 && y <= STAGE_H;
  for (const p of [art.led, art.pin, ...art.route]) assert.ok(inStage(box.map(p)), `${board.id}: ${p} inside the stage`);
  assert.ok(box.x >= BOARD_RECT.x - 1e-9 && box.x + box.w <= BOARD_RECT.x + BOARD_RECT.w + 1e-9, `${board.id}: fits across`);
  assert.ok(box.y >= BOARD_RECT.y - 1e-9 && box.y + box.h <= BOARD_RECT.y + BOARD_RECT.h + 1e-9, `${board.id}: fits down`);
  const bind = bindingPoints(box.map(art.pin));
  assert.deepEqual(bind[0], box.map(art.pin), `${board.id}: binding starts at the pin`);
  assert.equal(bind[2][0], TAG.x, `${board.id}: binding ends at the tag`);
  assert.ok(bind[0][0] < TAG.x, `${board.id}: pin left of the tag`);
  const r0 = art.route[0];
  assert.ok(Math.hypot(r0[0] - art.pin[0], r0[1] - art.pin[1]) < 4, `${board.id}: the LED net starts at the pin`);
  const r1 = art.route[art.route.length - 1];
  assert.ok(Math.hypot(r1[0] - art.led[0], r1[1] - art.led[1]) < 12, `${board.id}: the LED net ends at the LED`);
}
assert.equal(ids.size, 4);
assert.equal(nextBoard('linux'), 'stm32');
assert.equal(nextBoard('stm32', -1), 'linux');

// Scheduling lane: a run mark on every LED edge, thinner wake marks between them.
const lane = laneTicks(3000, 3000, 25, 20, 14, 2);
assert.equal((lane.match(/V2/g) || []).length, 13, 'runs at 0, 250, ..., 3000 ms');
assert.equal((lane.match(/V14/g) || []).length, 121 - 13, 'wake marks every 25 ms');

console.log('SameCode sim: all tests passed');
