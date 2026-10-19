import React, {useEffect, useRef, useState} from 'react';
import {useLocation} from '@docusaurus/router';
import {getDocRoot, getDocTitle, isDocPath} from '@site/src/features/bookmarks/docContext';
import {useBookmarkStrings} from '@site/src/features/bookmarks/strings';
import {captureNoteFromSelection} from '@site/src/features/bookmarks/useNotes';
import styles from './bookmarks.module.css';

/**
 * Floating "Save as note" button above a text selection in a doc article.
 *
 * `selectionchange` drives visibility; scrolling hides it because the cached
 * rect goes stale. The button prevents mousedown so the selection survives the
 * click (otherwise the selection is cleared before capture).
 */

type Popup = {
  x: number;
  y: number;
  kind: 'ready' | 'saved' | 'rejected';
};

export default function NoteCapture(): React.JSX.Element | null {
  const {pathname} = useLocation();
  const t = useBookmarkStrings();
  const [popup, setPopup] = useState<Popup | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDoc = isDocPath(pathname);

  const update = (next: Popup | null) => {
    popupRef.current = next;
    setPopup(next);
  };

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    update(null);
  };

  // Route changes always dismiss a stale popup.
  useEffect(() => {
    reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!isDoc) return;

    const onSelectionChange = () => {
      const current = popupRef.current;
      if (current && current.kind !== 'ready') return; // keep the result state visible

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        update(null);
        return;
      }
      const root = getDocRoot();
      if (!root) {
        update(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const el =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as Element);
      if (!el || !root.contains(el)) {
        update(null);
        return;
      }
      if (sel.toString().replace(/\s+/g, ' ').trim().length < 4) {
        update(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        update(null);
        return;
      }
      update({
        x: rect.left + rect.width / 2,
        y: Math.max(rect.top, 44),
        kind: 'ready',
      });
    };

    const hide = () => {
      const current = popupRef.current;
      if (!current || current.kind === 'ready') update(null);
    };

    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', hide, {passive: true});
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', hide);
      window.removeEventListener('resize', hide);
    };
  }, [isDoc]);

  if (!isDoc || !popup) return null;

  const onSave = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const note = captureNoteFromSelection(getDocTitle());
    update({
      ...popup,
      kind: note ? 'saved' : 'rejected',
    });
    if (note) {
      // Drop the browser selection so the highlight does not linger.
      window.getSelection()?.removeAllRanges();
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => update(null), 900);
  };

  return (
    <div
      className={styles.capture}
      style={{left: popup.x, top: popup.y}}
      onMouseDown={(event) => event.preventDefault()}>
      {popup.kind === 'ready' ? (
        <button
          type="button"
          className={styles.captureBtn}
          title={t.captureTitle}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onSave}>
          {t.captureButton}
        </button>
      ) : (
        <span
          className={`${styles.captureDone} ${
            popup.kind === 'rejected' ? styles.captureRejected : ''
          }`}
          role="status">
          {popup.kind === 'saved' ? t.captureSaved : t.captureRejected}
        </span>
      )}
    </div>
  );
}
