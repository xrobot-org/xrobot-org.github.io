import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESTORE_KEY,
  RESTORE_TTL_MS,
  isDocPath,
  isSafeDocPath,
  markRestore,
  normalizePath,
  takeRestoreMark,
} from '../src/features/bookmarks/readingKeys.ts';
import {
  appendSegment,
  findLeadMatches,
  leadOf,
  normalizeText,
  pickNearestMatch,
} from '../src/features/bookmarks/textLocator.ts';
import {
  BOOKMARKS_KEY,
  coerceBookmark,
  exportBookmarks,
  getBookmark,
  importBookmarks,
  loadBookmarks,
  removeBookmark,
  saveBookmark,
} from '../src/features/bookmarks/store.ts';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

test('normalizePath and isSafeDocPath reject external, scheme, and non-doc paths', () => {
  assert.equal(normalizePath('docs/intro.html?a=1#top'), '/docs/intro');
  assert.equal(normalizePath('/en/docs/start/'), '/en/docs/start');

  assert.equal(isDocPath('/docs/intro'), true);
  assert.equal(isDocPath('/en/docs/intro'), true);
  assert.equal(isDocPath('/bookmarks'), false);

  assert.equal(isSafeDocPath('/docs/intro'), true);
  assert.equal(isSafeDocPath('/en/docs/guide/setup'), true);
  assert.equal(isSafeDocPath('docs/intro'), true);

  assert.equal(isSafeDocPath('//evil.com/docs/intro'), false);
  assert.equal(isSafeDocPath('///evil.com/docs/intro'), false);
  assert.equal(isSafeDocPath('https://evil.com/docs/intro'), false);
  assert.equal(isSafeDocPath('javascript:alert(1)'), false);
  assert.equal(isSafeDocPath('/\\evil.com/docs/intro'), false);
  assert.equal(isSafeDocPath('/bookmarks'), false);
  assert.equal(isSafeDocPath(''), false);
});

test('markRestore / takeRestoreMark consume once, enforce TTL, and reject unsafe paths', () => {
  const session = createMemoryStorage();
  markRestore('//evil.com/docs/intro', 50, 'bad', session);
  assert.equal(session.getItem(RESTORE_KEY), null);

  markRestore('/docs/intro', 42, 'Hello world', session);
  assert.equal(takeRestoreMark('/docs/other', session), null);
  assert.equal(session.getItem(RESTORE_KEY), null);

  markRestore('/docs/intro', 42, 'Hello world', session);
  const hit = takeRestoreMark('/docs/intro', session);
  assert.ok(hit);
  assert.equal(hit.path, '/docs/intro');
  assert.equal(hit.scrollPercent, 42);
  assert.equal(hit.anchorText, 'Hello world');
  assert.equal(takeRestoreMark('/docs/intro', session), null);

  markRestore('/docs/intro', 10, 'Stale', session);
  assert.equal(takeRestoreMark('/docs/intro', session, Date.now() + RESTORE_TTL_MS + 1000), null);
});

test('textLocator handles block boundaries, zero-width chars, fallback, and nearest match', () => {
  assert.equal(normalizeText('a\u200B  b\n\tc'), 'a b c');
  assert.equal(leadOf('  first   paragraph  ', 10), 'first para');

  const big = [];
  const map = [];
  let prev = '';
  prev = appendSegment('First paragraph', prev, false, big, map, {id: 1});
  prev = appendSegment('Second\u200B paragraph', prev, true, big, map, {id: 2});
  const full = big.join('');
  assert.equal(full, 'First paragraph Second paragraph');

  const matches = findLeadMatches(full, 'First paragraph Second paragraph');
  assert.deepEqual(matches, [{start: 0, length: full.length}]);

  // Fallback skips 2 chars without stepping before index 2 of the match.
  const fallback = findLeadMatches('Alpha Beta Gamma Delta', '**Beta Gamma Delta');
  assert.deepEqual(fallback, [{start: 6, length: 16}]);

  // Duplicate phrase selection picks occurrence closest to stored scroll percentage.
  const repeated = findLeadMatches('Install tools ... Install tools ... Install tools', 'Install tools');
  assert.equal(repeated.length, 3);
  assert.equal(pickNearestMatch(repeated, 60, 85)?.start, repeated[2].start);
  assert.equal(pickNearestMatch(repeated, 60, 10)?.start, repeated[0].start);
});

test('store resists prototype pollution, NaN values, array corruption, and filters invalid imports', () => {
  const local = createMemoryStorage();

  // Corrupted array JSON in storage must safely degrade to empty.
  local.setItem(BOOKMARKS_KEY, '[1, 2, 3]');
  assert.deepEqual(loadBookmarks(local), []);

  // NaN clamping and anchor/title caps.
  const clamped = coerceBookmark({
    path: '/docs/intro',
    title: 'Intro',
    scrollPercent: Number.NaN,
    createdAt: Number.NaN,
    updatedAt: 100,
  });
  assert.ok(clamped);
  assert.equal(clamped.scrollPercent, 0);
  assert.equal(clamped.createdAt, 0);

  saveBookmark(
    {path: '/docs/intro', title: 'Intro', scrollPercent: 55, anchorText: 'Overview paragraph'},
    local,
    1000,
  );
  assert.equal(getBookmark('/docs/intro', local)?.scrollPercent, 55);

  const payload = JSON.stringify({
    app: 'xrobot-bookmarks',
    version: 1,
    exportedAt: '2026-11-27T00:00:00.000Z',
    bookmarks: [
      {path: '__proto__', title: 'pollute', scrollPercent: 50, updatedAt: 9999},
      {path: '//evil.com/docs/x', title: 'redirect', scrollPercent: 20, updatedAt: 9999},
      {path: '/docs/intro', title: 'Newer Intro', scrollPercent: 75, updatedAt: 2000},
      {path: '/en/docs/setup', title: 'Setup', scrollPercent: 30, updatedAt: 1500},
    ],
  });
  // JSON.parse would keep "__proto__" only as raw object data; check constructor too:
  const protoPayload = payload.replace('"__proto__"', '"constructor"');
  const result = importBookmarks(protoPayload, local);
  assert.deepEqual(result, {bookmarks: 2, skipped: 2});
  assert.equal(({}).pollute, undefined);

  const all = loadBookmarks(local);
  assert.equal(all.length, 2);
  assert.equal(all[0].path, '/docs/intro');
  assert.equal(all[0].scrollPercent, 75);

  const exported = JSON.parse(exportBookmarks(local));
  assert.equal(exported.app, 'xrobot-bookmarks');
  assert.equal(exported.bookmarks.length, 2);

  removeBookmark('/docs/intro', local);
  assert.equal(getBookmark('/docs/intro', local), null);
});
