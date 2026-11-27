import {isSafeDocPath, normalizePath} from './readingKeys.ts';
import type {Bookmark, BookmarksBackup, ImportResult} from './types.ts';

/**
 * Browser-local bookmark store (`localStorage`).
 *
 * All functions accept an optional `StorageLike` parameter so core persistence
 * and import hardening can be tested directly under Node.
 */

export const BOOKMARKS_KEY = 'xrobot:bookmarks:v1';
export const BOOKMARKS_EVENT = 'xrobot:bookmarks:change';

export const MAX_TITLE_LEN = 200;
export const MAX_ANCHOR_LEN = 120;
export const MAX_BOOKMARKS = 500;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function emitChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BOOKMARKS_EVENT));
  }
}

function emptyDict(): Record<string, Bookmark> {
  return Object.create(null) as Record<string, Bookmark>;
}

function readStore(storage: StorageLike | null = defaultStorage()): Record<string, Bookmark> {
  const dict = emptyDict();
  if (!storage) return dict;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(BOOKMARKS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return dict;
    for (const key of Object.keys(parsed)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      const item = coerceBookmark((parsed as Record<string, unknown>)[key]);
      if (item && !FORBIDDEN_KEYS.has(item.path)) {
        dict[item.path] = item;
      }
    }
    return dict;
  } catch {
    return dict;
  }
}

function writeStore(
  store: Record<string, Bookmark>,
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(BOOKMARKS_KEY, JSON.stringify(store));
    emitChange();
    return true;
  } catch {
    // Private mode / quota exceeded: reading never blocks on storage failure.
    return false;
  }
}

function trimToCap(store: Record<string, Bookmark>): Record<string, Bookmark> {
  const entries = Object.values(store);
  if (entries.length <= MAX_BOOKMARKS) return store;
  entries.sort((a, b) => b.updatedAt - a.updatedAt);
  const next = emptyDict();
  for (const item of entries.slice(0, MAX_BOOKMARKS)) {
    next[item.path] = item;
  }
  return next;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Validate and clamp an untrusted bookmark record. Returns null if unsafe or malformed. */
export function coerceBookmark(raw: unknown): Bookmark | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const b = raw as Partial<Bookmark>;
  if (typeof b.path !== 'string' || !isSafeDocPath(b.path)) return null;
  if (typeof b.title !== 'string') return null;

  const path = normalizePath(b.path);
  if (FORBIDDEN_KEYS.has(path)) return null;

  const rawPercent = finiteNumber(b.scrollPercent, 0);
  const scrollPercent = Math.min(100, Math.max(0, Math.round(rawPercent)));
  const anchorText =
    typeof b.anchorText === 'string' && b.anchorText.trim()
      ? b.anchorText.trim().slice(0, MAX_ANCHOR_LEN)
      : undefined;

  return {
    path,
    title: b.title.trim().slice(0, MAX_TITLE_LEN) || path,
    scrollPercent,
    ...(anchorText ? {anchorText} : {}),
    createdAt: finiteNumber(b.createdAt, 0),
    updatedAt: finiteNumber(b.updatedAt, 0),
  };
}

/** All valid bookmarks, ordered by most recently updated first. */
export function loadBookmarks(storage: StorageLike | null = defaultStorage()): Bookmark[] {
  return Object.values(readStore(storage)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getBookmark(
  path: string,
  storage: StorageLike | null = defaultStorage(),
): Bookmark | null {
  if (!isSafeDocPath(path)) return null;
  const key = normalizePath(path);
  return readStore(storage)[key] ?? null;
}

/** Create or update a bookmark, preserving its initial `createdAt`. */
export function saveBookmark(
  input: {
    path: string;
    title: string;
    scrollPercent: number;
    anchorText?: string;
  },
  storage: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): Bookmark | null {
  if (!isSafeDocPath(input.path)) return null;
  const store = readStore(storage);
  const key = normalizePath(input.path);
  const prev = store[key];
  const rawPercent = finiteNumber(input.scrollPercent, 0);
  const anchorText =
    typeof input.anchorText === 'string' && input.anchorText.trim()
      ? input.anchorText.trim().slice(0, MAX_ANCHOR_LEN)
      : undefined;

  const next: Bookmark = {
    path: key,
    title: input.title.trim().slice(0, MAX_TITLE_LEN) || key,
    scrollPercent: Math.min(100, Math.max(0, Math.round(rawPercent))),
    ...(anchorText ? {anchorText} : {}),
    createdAt: prev ? prev.createdAt : now,
    updatedAt: now,
  };
  store[key] = next;
  writeStore(trimToCap(store), storage);
  return next;
}

export function removeBookmark(
  path: string,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!isSafeDocPath(path)) return;
  const store = readStore(storage);
  const key = normalizePath(path);
  if (!(key in store)) return;
  delete store[key];
  writeStore(store, storage);
}

export function exportBookmarks(storage: StorageLike | null = defaultStorage()): string {
  const backup: BookmarksBackup = {
    app: 'xrobot-bookmarks',
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: loadBookmarks(storage),
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Import a JSON backup, keeping the newer `updatedAt` when both sides have the same path.
 * Accepts `xrobot-bookmarks` and legacy `site-bookmarks` payloads.
 */
export function importBookmarks(
  raw: string,
  storage: StorageLike | null = defaultStorage(),
): ImportResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const data = parsed as Partial<BookmarksBackup>;
  if (
    (data.app !== 'xrobot-bookmarks' && data.app !== 'site-bookmarks') ||
    !Array.isArray(data.bookmarks)
  ) {
    return null;
  }

  const store = readStore(storage);
  let merged = 0;
  let skipped = 0;
  for (const rawEntry of data.bookmarks) {
    const incoming = coerceBookmark(rawEntry);
    if (!incoming) {
      skipped++;
      continue;
    }
    const local = store[incoming.path];
    if (!local || incoming.updatedAt >= local.updatedAt) {
      store[incoming.path] = incoming;
      merged++;
    }
  }
  writeStore(trimToCap(store), storage);
  return {bookmarks: merged, skipped};
}
