import {useCallback, useEffect, useState} from 'react';
import {currentScrollPercent, getDocRoot} from './docContext';import {normalizePath, pathnameToKey} from './readingKeys';
import {normalizeQuote} from './noteText';
import type {Note} from './types';

/**
 * "Notes" localStorage store: a passage selected in an article is saved with a
 * text fingerprint and the scroll percentage at capture time. Notes are
 * browser-local; they travel between devices only through the bookmark backup
 * file (version 2).
 */

const NOTES_KEY = 'notes:v1';
export const NOTES_EVENT = 'notes:change';

/** Stored quote length limit. */
const QUOTE_MAX = 240;

function readStore(): Record<string, unknown> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(value: Record<string, unknown>): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(value));
    window.dispatchEvent(new Event(NOTES_EVENT));
    return true;
  } catch {
    // Private mode / quota: never block reading because a note cannot be saved.
    return false;
  }
}

function coerceNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<Note>;
  if (typeof n.id !== 'string' || !n.id || typeof n.path !== 'string' || !n.path) return null;
  if (typeof n.quote !== 'string' || !n.quote) return null;
  return {
    id: n.id,
    path: normalizePath(n.path),
    title: typeof n.title === 'string' ? n.title : '',
    quote: n.quote,
    scrollPercent:
      typeof n.scrollPercent === 'number'
        ? Math.min(100, Math.max(0, n.scrollPercent))
        : 0,
    createdAt: typeof n.createdAt === 'number' ? n.createdAt : 0,
    updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : 0,
  };
}

/** All notes, newest first. */
export function loadNotes(): Note[] {
  return Object.values(readStore())
    .map(coerceNote)
    .filter((n): n is Note => n !== null)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function removeNote(id: string): void {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

// ── capture: selection → Note ──────────────────────────────────────────────

/** Whether the selection is inside the article body (code blocks and tables included). */
function selectionInDoc(sel: Selection): boolean {
  if (sel.rangeCount === 0) return false;
  const root = getDocRoot();
  if (!root) return false;
  const container = sel.getRangeAt(0).commonAncestorContainer;
  const el =
    container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : (container as Element);
  return !!el && root.contains(el);
}

/**
 * Capture the current selection as a note.
 * Returns null when the selection is empty, outside the article, or too short.
 */
export function captureNoteFromSelection(title: string): Note | null {
  if (typeof window === 'undefined') return null;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !selectionInDoc(sel)) return null;

  const quote = normalizeQuote(sel.toString()).slice(0, QUOTE_MAX);
  if (quote.length < 4) return null;

  const path = pathnameToKey(location.pathname);
  const now = Date.now();
  const note: Note = {
    id: `${path}#${now}${Math.random().toString(36).slice(2, 6)}`,
    path,
    title,
    quote,
    scrollPercent: currentScrollPercent(),
    createdAt: now,
    updatedAt: now,
  };
  const store = readStore();
  store[note.id] = note;
  writeStore(store);
  return note;
}

// ── backup segment ─────────────────────────────────────────────────────────

/** Merge a `notes` array from a backup; same id → newer `updatedAt` wins. */
export function importNotes(rawNotes: unknown[] | undefined): number {
  if (!Array.isArray(rawNotes)) return 0;
  const store = readStore();
  let count = 0;
  for (const raw of rawNotes) {
    const incoming = coerceNote(raw);
    if (!incoming) continue;
    const local = coerceNote(store[incoming.id]);
    if (!local || incoming.updatedAt >= local.updatedAt) {
      store[incoming.id] = incoming;
      count++;
    }
  }
  writeStore(store);
  return count;
}

// ── React binding ──────────────────────────────────────────────────────────

/**
 * Notes for the current article, refreshed on every save/delete and on
 * cross-tab storage updates. `pathname` is the dependency that changes when
 * Docusaurus navigates between docs.
 */
export function useNotesForPath(pathname: string): Note[] {
  const [notes, setNotes] = useState<Note[]>([]);
  const sync = useCallback(() => {
    const key = pathnameToKey(pathname);
    setNotes(loadNotes().filter((n) => n.path === key));
  }, [pathname]);

  useEffect(() => {
    sync();
    const onStorage = () => sync();
    window.addEventListener(NOTES_EVENT, onStorage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(NOTES_EVENT, onStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, [sync]);

  return notes;
}
