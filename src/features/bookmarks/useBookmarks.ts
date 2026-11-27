import {useCallback, useEffect, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import {
  captureVisibleAnchor,
  currentScrollPercent,
  flashAndScrollRange,
  getDocRoot,
  getDocTitle,
  locateAnchorRange,
  scrollToPercentCancellable,
} from './docContext.ts';
import {isDocPath, pathnameToKey, takeRestoreMark} from './readingKeys.ts';
import {
  BOOKMARKS_EVENT,
  BOOKMARKS_KEY,
  getBookmark,
  removeBookmark,
  saveBookmark,
} from './store.ts';
import type {Bookmark} from './types.ts';

/**
 * React bindings for doc-page bookmarking, post-jump restoration, and
 * auto-tracking reading progress on already-bookmarked articles.
 */

let restoring = false;

export function useBookmarkState(pathname: string): {
  bookmark: Bookmark | null;
  toggle: () => void;
} {
  const key = pathnameToKey(pathname);
  const [bookmark, setBookmark] = useState<Bookmark | null>(null);

  const sync = useCallback(() => {
    setBookmark(getBookmark(key));
  }, [key]);

  useEffect(() => {
    sync();
    const onLocal = () => sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === BOOKMARKS_KEY) sync();
    };
    window.addEventListener(BOOKMARKS_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
    };
  }, [sync]);

  const toggle = useCallback(() => {
    if (!isDocPath(key)) return;
    const existing = getBookmark(key);
    if (existing) {
      removeBookmark(key);
    } else {
      saveBookmark({
        path: key,
        title: getDocTitle() || key,
        scrollPercent: currentScrollPercent(),
        anchorText: captureVisibleAnchor(),
      });
    }
    setBookmark(getBookmark(key));
  }, [key]);

  // Never flash the previous page's state during a route transition before effect runs.
  return {bookmark: bookmark?.path === key ? bookmark : null, toggle};
}

/** Consume any pending one-shot restore mark on navigation and jump/highlight the target. */
export function useBookmarkRestore(): void {
  const {pathname} = useLocation();

  useEffect(() => {
    const key = pathnameToKey(pathname);
    if (!isDocPath(key)) return;
    const mark = takeRestoreMark(key);
    if (!mark) return;

    restoring = true;
    let cancelled = false;
    let cancelScroll: (() => void) | null = null;
    let anchorDone = false;

    const clearRestoring = setTimeout(() => {
      restoring = false;
    }, 1250);

    const attempt = () => {
      if (cancelled || anchorDone) return;
      if (mark.anchorText) {
        const root = getDocRoot();
        if (root) {
          const range = locateAnchorRange(root, mark.anchorText, mark.scrollPercent);
          if (range) {
            anchorDone = true;
            cancelScroll?.();
            cancelScroll = flashAndScrollRange(range);
            return;
          }
        }
      }
      if (!cancelScroll) {
        cancelScroll = scrollToPercentCancellable(mark.scrollPercent);
      }
    };

    const raf = requestAnimationFrame(attempt);
    const timers = [setTimeout(attempt, 320), setTimeout(attempt, 1050)];

    return () => {
      cancelled = true;
      restoring = false;
      clearTimeout(clearRestoring);
      cancelAnimationFrame(raf);
      for (const id of timers) clearTimeout(id);
      cancelScroll?.();
    };
  }, [pathname]);
}

/**
 * Silently keep an already-bookmarked article's scroll progress and anchor up to date.
 * Only tracks after the route settles and an explicit scroll occurs (`dirty === true`),
 * preventing route-transition scroll values from leaking onto the next article.
 */
export function useBookmarkAutoTrack(): void {
  const {pathname} = useLocation();

  useEffect(() => {
    const key = pathnameToKey(pathname);
    if (!isDocPath(key)) return;

    let disposed = false;
    let armed = false;
    let dirty = false;
    let percent = currentScrollPercent();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      if (!dirty) return;
      dirty = false;
      const prev = getBookmark(key);
      if (!prev) return;
      saveBookmark({
        path: key,
        title: getDocTitle() || prev.title,
        scrollPercent: percent,
        anchorText: captureVisibleAnchor() ?? prev.anchorText,
      });
    };

    const armRaf = requestAnimationFrame(() => {
      if (!disposed) armed = true;
    });

    const onScroll = () => {
      if (disposed || !armed || restoring) return;
      if (pathnameToKey(window.location.pathname) !== key) return;
      percent = currentScrollPercent();
      dirty = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(flush, 500);
    };

    const onPageHide = () => flush();

    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('pagehide', onPageHide);

    return () => {
      disposed = true;
      cancelAnimationFrame(armRaf);
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      flush();
    };
  }, [pathname]);
}
