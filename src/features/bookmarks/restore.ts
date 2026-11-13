import {useEffect} from 'react';
import {useLocation} from '@docusaurus/router';
import {currentScrollPercent} from './docContext';
import {restoreByLeadText} from './noteDom';
import {getBookmark, saveBookmark} from './useBookmarks';
import {pathnameToKey, takeRestoreMark} from './readingKeys';

/**
 * Restore the position recorded by a bookmarks-page click.
 *
 * A note jump carries a text fingerprint: locate and flash it (this is the
 * precise path). A plain bookmark carries only a percentage, re-applied three
 * times because Docusaurus' own route reset and async media fight the first
 * attempt. If a note fingerprint no longer matches, the percentage is the
 * fallback, exactly like the Tutorial code.
 */
export function useBookmarkRestore(): void {
  const {pathname} = useLocation();

  useEffect(() => {
    const key = pathnameToKey(pathname);
    const mark = takeRestoreMark(key);
    if (!mark) return;

    let cancelled = false;
    let noteDone = false;

    const attempt = () => {
      if (cancelled || noteDone) return;
      if (mark.noteLead && restoreByLeadText(mark.noteLead)) {
        noteDone = true;
        return;
      }
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) el.scrollTop = (max * Math.min(100, Math.max(0, mark.scrollPercent))) / 100;
    };

    const raf = requestAnimationFrame(attempt);
    const timers = [setTimeout(attempt, 350), setTimeout(attempt, 1200)];
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [pathname]);
}

/**
 * Keep a bookmarked article's stored position up to date. Only articles that
 * are already bookmarked are tracked, so merely reading leaves no trace.
 */
export function useBookmarkAutoTrack(): void {
  const {pathname} = useLocation();

  useEffect(() => {
    const key = pathnameToKey(pathname);
    let percent = currentScrollPercent();
    let disposed = false;

    const onScroll = () => {
      if (disposed) return;
      if (pathnameToKey(window.location.pathname) !== key) return;
      percent = currentScrollPercent();
    };

    const snapshot = () => {
      // A jump to the top right before leaving must not overwrite useful progress.
      if (percent <= 0) return;
      const prev = getBookmark(key);
      if (!prev) return;
      saveBookmark({path: key, title: prev.title, scrollPercent: percent});
    };

    window.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('pagehide', snapshot);
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', snapshot);
      snapshot();
      disposed = true;
    };
  }, [pathname]);
}
