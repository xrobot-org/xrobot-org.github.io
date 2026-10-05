// node --test src/components/showcase/autoplay.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserIdle, idleProps, RESUME_MS, HOVER_POLL_MS } from './autoplay.ts';

test('not paused until touched; resumes RESUME_MS after the last touch', () => {
  let now = 1000;
  const u = new UserIdle(RESUME_MS, () => now);
  assert.equal(u.paused(), false);
  u.touch();
  assert.equal(u.paused(), true);
  now += RESUME_MS - 1;
  assert.equal(u.paused(), true);
  assert.equal(u.waitMs(), 1);
  now += 1;
  assert.equal(u.paused(), false);
  assert.equal(u.waitMs(), 0);
});

test('a resting pointer keeps it paused; the quiet time starts at leave', () => {
  let now = 0;
  const u = new UserIdle(RESUME_MS, () => now);
  u.enter();
  now += 60000;
  assert.equal(u.paused(), true);
  assert.equal(u.waitMs(), HOVER_POLL_MS);
  u.leave();
  now += RESUME_MS - 1;
  assert.equal(u.paused(), true);
  now += 1;
  assert.equal(u.paused(), false);
});

test('leave without enter never goes negative; idleProps drive the gate', () => {
  let now = 0;
  const u = new UserIdle(RESUME_MS, () => now);
  u.leave();
  now += RESUME_MS;
  assert.equal(u.paused(), false);
  const p = idleProps(u);
  p.onKeyDown();
  assert.equal(u.paused(), true);
  now += RESUME_MS;
  p.onPointerEnter();
  now += 99999;
  assert.equal(u.paused(), true);
  p.onPointerLeave();
  now += RESUME_MS;
  assert.equal(u.paused(), false);
});
