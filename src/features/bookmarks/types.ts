/**
 * Shared data shapes for local article bookmarks.
 *
 * Bookmarks live only in browser storage (`localStorage`), keyed by the clean
 * article path.
 */

/** An article-level bookmark remembering reading progress and a visible anchor. */
export interface Bookmark {
  /** Clean article path, e.g. `/docs/intro` or `/en/docs/intro`. */
  path: string;
  /** Article title at bookmark or last-update time. */
  title: string;
  /** Last read scroll percentage in `[0, 100]`. */
  scrollPercent: number;
  /** Short visible-paragraph excerpt captured near the top of the viewport. */
  anchorText?: string;
  createdAt: number;
  updatedAt: number;
}

/** Backup file exported from `/bookmarks` or `/en/bookmarks`. */
export interface BookmarksBackup {
  app: 'xrobot-bookmarks' | 'site-bookmarks';
  version: number;
  exportedAt: string;
  bookmarks: Bookmark[];
}

export interface ImportResult {
  /** Number of bookmarks merged into this browser. */
  bookmarks: number;
  /** Number of malformed or unsafe entries skipped during import. */
  skipped: number;
}

/** One-shot restore instruction written before navigating from `/bookmarks`. */
export interface RestoreMark {
  path: string;
  scrollPercent: number;
  anchorText?: string;
  ts: number;
}
