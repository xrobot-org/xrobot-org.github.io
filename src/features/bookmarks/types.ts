/**
 * Shared data shapes for the local bookmark / note feature.
 *
 * Everything lives in localStorage, keyed by the clean article path, so the
 * shapes are intentionally small and versioned by the storage key names.
 */

/** A passage-level note captured from a text selection. */
export interface Note {
  /** Unique id: path + creation time + random suffix; used as React key and for deletion. */
  id: string;
  /** Clean article path, e.g. `/docs/intro` or `/en/docs/intro`. */
  path: string;
  /** Article title at capture time. */
  title: string;
  /** Quoted source text (whitespace-normalised, truncated to 240 chars). */
  quote: string;
  /** Scroll percentage at capture time: fallback when text matching fails. */
  scrollPercent: number;
  createdAt: number;
  updatedAt: number;
}

/** An article-level bookmark (one star per article). */
export interface Bookmark {
  /** Clean article path, e.g. `/docs/intro`. */
  path: string;
  /** Article title at bookmark time. */
  title: string;
  /** Last read scroll percentage 0-100; auto-tracked while bookmarked. */
  scrollPercent: number;
  createdAt: number;
  updatedAt: number;
}

/** Backup file written by the export button; v2 carries notes as well. */
export interface BookmarksBackup {
  app: 'site-bookmarks';
  version: 1 | 2;
  exportedAt: string;
  bookmarks: Bookmark[];
  notes?: Note[];
}

export interface ImportResult {
  /** Number of bookmarks merged into this browser. */
  bookmarks: number;
  /** Number of notes merged into this browser (0 for a v1 backup). */
  notes: number;
}

/** One-shot restore instruction written by the bookmarks page before navigation. */
export interface RestoreMark {
  path: string;
  scrollPercent: number;
  /** Note lead fingerprint (first 40 chars); absent for bookmark jumps. */
  noteLead?: string;
  /** Epoch ms, used to discard stale marks. */
  ts?: number;
}
