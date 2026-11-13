import type {RestoreMark} from './types';

/**
 * Path helpers shared by bookmarks and notes.
 *
 * A stored key is always a clean, leading-slash path without query, hash,
 * `.html` suffix or trailing slash. Docusaurus runs with `trailingSlash: false`
 * and `baseUrl: '/'`, so `location.pathname` already matches that shape; the
 * normalisation still protects against hand-edited URLs and old backups.
 */

export function stripHtmlExt(path: string): string {
  return path.endsWith('.html') ? path.slice(0, -5) : path;
}

/** Normalise any article path into the canonical localStorage key. */
export function normalizePath(path: string): string {
  let p = stripHtmlExt(path.split('#')[0].split('?')[0]);
  if (!p) return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** `location.pathname` → storage key (see `normalizePath`). */
export function pathnameToKey(pathname: string): string {
  return normalizePath(pathname);
}

// ── one-shot restore mark ──────────────────────────────────────────────────
// The bookmarks page writes it right before navigating; the target doc page
// consumes it once. sessionStorage keeps it scoped to this tab.

const RESTORE_KEY = 'bookmarks:restore';
/** Marks older than this are leftovers from an abandoned navigation. */
const RESTORE_TTL_MS = 60 * 60 * 1000;

export function markRestore(path: string, scrollPercent: number, noteLead?: string): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      RESTORE_KEY,
      JSON.stringify({
        path: normalizePath(path),
        scrollPercent,
        noteLead,
        ts: Date.now(),
      } satisfies RestoreMark),
    );
  } catch {
    // Private mode / quota: restoring is a bonus, navigation still works.
  }
}

/** Consume the mark if it targets `path` and is still fresh; otherwise drop it. */
export function takeRestoreMark(path: string): RestoreMark | null {
  if (typeof sessionStorage === 'undefined') return null;
  let mark: RestoreMark | null = null;
  try {
    mark = JSON.parse(sessionStorage.getItem(RESTORE_KEY) ?? 'null') as RestoreMark | null;
    sessionStorage.removeItem(RESTORE_KEY);
  } catch {
    try {
      sessionStorage.removeItem(RESTORE_KEY);
    } catch {
      // Both reads and writes failed; nothing else to do.
    }
    return null;
  }
  if (!mark || normalizePath(mark.path) !== normalizePath(path)) return null;
  if (typeof mark.ts !== 'number' || Date.now() - mark.ts > RESTORE_TTL_MS) return null;
  return {...mark, path: normalizePath(mark.path)};
}
