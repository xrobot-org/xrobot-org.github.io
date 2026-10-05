// node --experimental-strip-types src/components/showcase/RobotModules/sim.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROBOTS, SHARED, EXCERPTS, rows, instanceLines, planeRotation, tourAt, tourStart, robotTourMs, TOUR_LEAD_MS, TOUR_STEP_MS } from './sim.ts';

const index = ['BlinkLED', 'BMI088', 'ICM42688', 'ICM20948', 'MadgwickAHRS', 'IST8310', 'BuzzerAlarm', 'TestModule', 'CanfdIMU', 'CanIMU',
  'SharedTopicClient', 'SharedTopic', 'ST7735', 'W25QXX', 'QMI8658', 'BMI270', 'QMC5883L', 'QMC5883P', 'SPL06', 'AK8975', 'R9DS', 'ANOFlow',
  'SX1281', 'MLX90640', 'INA228', 'LC307', 'STP23L', 'GreySensor', 'DurationStatistics', 'LSM6DSV16X'];
for (const r of ROBOTS) {
  for (const i of r.instances) assert.ok(index.includes(i.module), `${i.module} is in the official index`);
  const rs = rows(r);
  assert.deepEqual(rs.slice(0, 3).map((x) => x.module), SHARED, `${r.id}: shared modules keep the first rows`);
  const svg = readFileSync(new URL(`../../../../static${r.art}`, import.meta.url), 'utf8');
  for (const i of r.instances) assert.ok(svg.includes(`data-p="${i.slot}"`), `${r.id}: drawing has part ${i.slot}`);
}
for (const m of Object.keys(EXCERPTS)) assert.equal(instanceLines(m)[0], `- module: xrobot-org/${m}`);
// rotation by 0 is the identity, a full turn returns, the centre stays (iso horizontal plane and a vertical plane)
const C = Math.cos(Math.PI / 6);
for (const [u, w] of [[[C, -0.5], [C, 0.5]], [[C, -0.5], [0, -1]]]) {
  assert.deepEqual(planeRotation([10, 20], u, w, 0).map((v) => +v.toFixed(9) + 0), [1, 0, 0, 1, 0, 0]);
  const m = planeRotation([10, 20], u, w, 1.1);
  assert.ok(Math.abs(m[0] * 10 + m[2] * 20 + m[4] - 10) < 1e-9 && Math.abs(m[1] * 10 + m[3] * 20 + m[5] - 20) < 1e-9);
  // the plane's own unit vector u turns into cos u + sin w
  const x = m[0] * u[0] + m[2] * u[1], y = m[1] * u[0] + m[3] * u[1];
  assert.ok(Math.abs(x - (Math.cos(1.1) * u[0] + Math.sin(1.1) * w[0])) < 1e-9 && Math.abs(y - (Math.cos(1.1) * u[1] + Math.sin(1.1) * w[1])) < 1e-9);
}
// autoplay: about 6 s per robot, lead-in without a row, rows in order, then the next robot
for (const r of ROBOTS) {
  const t0 = tourStart(r.id);
  assert.ok(Math.abs(robotTourMs(r) - 6000) < 500, `${r.id}: ~6 s`);
  assert.deepEqual(tourAt(t0 + 10), { robot: r.id, row: -1 });
  assert.deepEqual(tourAt(t0 + TOUR_LEAD_MS + 2.5 * TOUR_STEP_MS), { robot: r.id, row: 2 });
}
const total = ROBOTS.reduce((s, r) => s + robotTourMs(r), 0);
assert.deepEqual(tourAt(total + 1), tourAt(1));
console.log('RobotModules sim: ok');

// arm teach motion: starts and ends at the rest pose of the static drawing, keys reached exactly, smooth in between
{
  const { armPoseAt, armCycleMs } = await import('./sim.ts');
  const rig = readFileSync(new URL('./armRig.js', import.meta.url), 'utf8');
  const keys = JSON.parse(/export const ARM_KEYS = (\[.*\]);/.exec(rig)[1]);
  const rest = JSON.parse(/export const ARM_REST = (\{.*\});/.exec(rig)[1]);
  const cyc = armCycleMs(keys);
  assert.ok(cyc >= 6000 && cyc <= 8000, `cycle ${cyc} ms`);
  for (const ms of [0, cyc, 2 * cyc]) assert.deepEqual(armPoseAt(keys, ms).q.map((v) => +v.toFixed(6)), rest.q);
  for (const k of keys.slice(0, -1)) assert.deepEqual(armPoseAt(keys, k[0] * 1000).q.map((v) => +v.toFixed(6)), k.slice(1, 5));
  let maxStep = 0;
  for (let ms = 0; ms < cyc; ms += 33) {
    const a = armPoseAt(keys, ms).q, b = armPoseAt(keys, ms + 33).q;
    maxStep = Math.max(maxStep, ...a.map((v, i) => Math.abs(b[i] - v)));
  }
  assert.ok(maxStep < 2.5, `max joint step per 33 ms frame ${maxStep.toFixed(2)} deg`);
}
