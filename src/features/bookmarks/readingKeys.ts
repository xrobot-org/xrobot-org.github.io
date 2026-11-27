import type {RestoreMark} from './types';

/**
 * Path validation, normalisation, and one-shot session restore marks shared by
 * the bookmark store and restore pipeline.
 */

export const RESTORE_KEY = 'xrobot:bookmarks:restore';
/** Marks older than 1 hour are discarded as leftovers from an abandoned navigation. */
export const RESTORE_TTL_MS = 60 * 60 * 1000;

export function stripHtmlExt(path: string): string {
  return path.endsWith('.html') ? path.slice(0, -5) : path;
}

/** Normalise any article path into a clean leading-slash key without query/hash/trailing slash. */
export function normalizePath(path: string): string {
  let p = stripHtmlExt(path.split('#')[0].split('?')[0].trim());
  if (!p) return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** Docs live at `/docs/...` (default locale) and `/<locale>/docs/...`. */
export function isDocPath(pathname: string): boolean {
  return /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?docs(?:\/|$)/.test(pathname);
}

/**
 * Validate that a bookmark path points to an internal doc route.
 * Rejects protocol-relative URLs (`//evil.com`), URI schemes (`javascript:`),
 * backslashes, and non-doc paths.
 */
export function isSafeDocPath(path: string): boolean {
  const trimmed = path.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.includes('\\')) return false;
  const schemeProbe = trimmed.split('#')[0].split('?')[0];
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(schemeProbe)) return false;
  const normalized = normalizePath(trimmed);
  if (normalized.startsWith('//')) return false;
  return isDocPath(normalized);
}

export function pathnameToKey(pathname: string): string {
  return normalizePath(pathname);
}

export function isEnglishPath(pathname: string): boolean {
  return pathname === '/en' || pathname.startsWith('/en/');
}

export function bookmarksHref(pathname: string): string {
  return isEnglishPath(pathname) ? '/en/bookmarks' : '/bookmarks';
}

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultSessionStorage(): SessionStorageLike | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function markRestore(
  path: string,
  scrollPercent: number,
  anchorText?: string,
  storage: SessionStorageLike | null = defaultSessionStorage(),
): void {
  if (!storage || !isSafeDocPath(path)) return;
  const clamped = Number.isFinite(scrollPercent) ? Math.min(100, Math.max(0, scrollPercent)) : 0;
  try {
    const payload: RestoreMark = {
      path: normalizePath(path),
      scrollPercent: clamped,
      ...(anchorText ? {anchorText} : {}),
      ts: Date.now(),
    };
    storage.setItem(RESTORE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota: navigation still works without restoring scroll.
  }
}

/** Consume the one-shot mark if it targets `path` and is fresh; otherwise discard it. */
export function takeRestoreMark(
  path: string,
  storage: SessionStorageLike | null = defaultSessionStorage(),
  now: number = Date.now(),
): RestoreMark | null {
  if (!storage) return null;
  let mark: RestoreMark | null = null;
  try {
    mark = JSON.parse(storage.getItem(RESTORE_KEY) ?? 'null') as RestoreMark | null;
    storage.removeItem(RESTORE_KEY);
  } catch {
    try {
      storage.removeItem(RESTORE_KEY);
    } catch {
      // Ignore storage cleanup failures.
    }
    return null;
  }
  if (!mark || typeof mark.path !== 'string' || !isSafeDocPath(mark.path)) return null;
  if (normalizePath(mark.path) !== normalizePath(path)) return null;
  if (typeof mark.ts !== 'number' || !Number.isFinite(mark.ts) || now - mark.ts > RESTORE_TTL_MS) {
    return null;
  }
  const scrollPercent =
    typeof mark.scrollPercent === 'number' && Number.isFinite(mark.scrollPercent)
      ? Math.min(100, Math.max(0, mark.scrollPercent))
      : 0;
  return {
    path: normalizePath(mark.path),
    scrollPercent,
    anchorText: typeof mark.anchorText === 'string' && mark.anchorText ? mark.anchorText : undefined,
    ts: mark.ts,
  };
}
