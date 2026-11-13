import {useCallback, useEffect, useState} from 'react';
import {normalizePath, pathnameToKey} from './readingKeys';
import {importNotes, loadNotes} from './useNotes';
import type {Bookmark, BookmarksBackup, ImportResult} from './types';

/**
 * "Bookmarks" localStorage store: one star per article, remembering the read
 * position. No account and no cloud — export/import JSON is the only way to
 * move a shelf between browsers.
 */

const BOOKMARKS_KEY = 'bookmarks:v1';
export const BOOKMARKS_EVENT = 'bookmarks:change';

function readStore(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(value: Record<string, unknown>): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(value));
    window.dispatchEvent(new Event(BOOKMARKS_EVENT));
    return true;
  } catch {
    // Private mode / quota: bookmarks are optional, reading is not.
    return false;
  }
}

function coerceBookmark(raw: unknown): Bookmark | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<Bookmark>;
  if (typeof b.path !== 'string' || !b.path || typeof b.title !== 'string') return null;
  const percent = typeof b.scrollPercent === 'number' ? b.scrollPercent : 0;
  return {
    path: normalizePath(b.path),
    title: b.title,
    scrollPercent: Math.min(100, Math.max(0, percent)),
    createdAt: typeof b.createdAt === 'number' ? b.createdAt : 0,
    updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : 0,
  };
}

/** All bookmarks, most recently read first. */
export function loadBookmarks(): Bookmark[] {
  return Object.values(readStore())
    .map(coerceBookmark)
    .filter((b): b is Bookmark => b !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getBookmark(path: string): Bookmark | null {
  return coerceBookmark(readStore()[normalizePath(path)]);
}

/** Bookmark an article; an existing entry keeps its `createdAt`. */
export function saveBookmark(input: {
  path: string;
  title: string;
  scrollPercent: number;
}): Bookmark | null {
  if (!input.path) return null;
  const store = readStore();
  const key = normalizePath(input.path);
  const prev = coerceBookmark(store[key]);
  const now = Date.now();
  const next: Bookmark = {
    path: key,
    title: input.title,
    scrollPercent: Math.min(100, Math.max(0, input.scrollPercent)),
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  store[key] = next;
  writeStore(store);
  return next;
}

export function removeBookmark(path: string): void {
  const store = readStore();
  delete store[normalizePath(path)];
  writeStore(store);
}

// ── backup ─────────────────────────────────────────────────────────────────

/** Backup v2 carries notes; import remains compatible with v1 files. */
export function exportBookmarks(): string {
  const backup: BookmarksBackup = {
    app: 'site-bookmarks',
    version: 2,
    exportedAt: new Date().toISOString(),
    bookmarks: loadBookmarks(),
    notes: loadNotes(),
  };
  return JSON.stringify(backup);
}

/** Merge a backup: bookmark path + newer `updatedAt` wins; notes merge by id. */
export function importBookmarks(raw: string): ImportResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const data = parsed && typeof parsed === 'object' ? (parsed as Partial<BookmarksBackup>) : null;
  if (!data || data.app !== 'site-bookmarks' || !Array.isArray(data.bookmarks)) return null;

  const store = readStore();
  let bookmarkCount = 0;
  for (const rawBookmark of data.bookmarks) {
    const incoming = coerceBookmark(rawBookmark);
    if (!incoming) continue;
    const local = coerceBookmark(store[incoming.path]);
    if (!local || incoming.updatedAt >= local.updatedAt) {
      store[incoming.path] = incoming;
      bookmarkCount++;
    }
  }
  writeStore(store);
  const noteCount = importNotes(data.notes);
  return {bookmarks: bookmarkCount, notes: noteCount};
}

// ── React binding ──────────────────────────────────────────────────────────

/** Current article's bookmark plus a toggle action. */
export function useBookmarkState(pathname: string): {
  bookmark: Bookmark | null;
  toggle: (title: string, scrollPercent: number) => void;
} {
  const key = pathnameToKey(pathname);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);

  const sync = useCallback(() => setBookmark(getBookmark(key)), [key]);

  useEffect(() => {
    sync();
    const onStorage = () => sync();
    window.addEventListener(BOOKMARKS_EVENT, onStorage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, onStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, [sync]);

  const toggle = useCallback(
    (title: string, scrollPercent: number) => {
      const existing = getBookmark(key);
      if (existing) removeBookmark(key);
      else saveBookmark({path: key, title, scrollPercent});
      setBookmark(getBookmark(key));
    },
    [key],
  );

  // During a route transition the effect has not synced yet; never expose the
  // previous article's bookmark as if it belonged to the new one.
  return {bookmark: bookmark?.path === key ? bookmark : null, toggle};
}
