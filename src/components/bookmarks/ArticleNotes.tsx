import React from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {bookmarksHref, getDocRoot, isDocPath, isEnglishPath, scrollToPercent} from '@site/src/features/bookmarks/docContext';
import {flashRange, leadOf, locateLead} from '@site/src/features/bookmarks/noteDom';
import {pathnameToKey} from '@site/src/features/bookmarks/readingKeys';
import {useBookmarkStrings} from '@site/src/features/bookmarks/strings';
import {useNotesForPath, removeNote} from '@site/src/features/bookmarks/useNotes';
import type {Note} from '@site/src/features/bookmarks/types';
import styles from './bookmarks.module.css';

/**
 * "Notes on this page" panel, rendered under the desktop right-hand TOC.
 *
 * Empty state explains how to capture a note; the heading's "All ↗" link goes
 * to the global bookmarks page. Clicking a note locates the quoted passage in
 * the article and flashes it, falling back to the stored scroll percentage.
 */

function shortTime(ts: number, english: boolean): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (d.toDateString() === now.toDateString()) {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (d.getFullYear() === now.getFullYear()) {
    return english
      ? d.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})
      : `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  return `${String(d.getFullYear()).slice(2)}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function ArticleNotes(): React.JSX.Element | null {
  const {pathname} = useLocation();
  const t = useBookmarkStrings();
  const notes = useNotesForPath(pathname);
  const key = pathnameToKey(pathname);
  const english = isEnglishPath(pathname);

  if (!isDocPath(pathname)) return null;

  const visible = notes.filter((n) => n.path === key);

  const jump = (note: Note) => {
    const root = getDocRoot();
    if (root) {
      const range = locateLead(root, leadOf(note.quote));
      if (range && flashRange(range)) return;
    }
    scrollToPercent(note.scrollPercent);
  };

  const onRemove = (note: Note) => {
    removeNote(note.id);
  };

  return (
    <section className={styles.notes} aria-label={t.notesTitle}>
      <div className={styles.notesHeading}>
        <span className={styles.notesTitle}>
          <span aria-hidden="true">✎</span> {t.notesTitle}
        </span>
        {visible.length > 0 ? <span className={styles.notesCount}>{visible.length}</span> : null}
        <Link
          className={styles.notesAll}
          to={bookmarksHref(pathname)}
          title={t.notesAllTitle}>
          {t.notesAll}
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className={styles.notesHint}>
          <p className={styles.notesHintTitle}>{t.notesEmptyTitle}</p>
          <p className={styles.notesHintBody}>{t.notesEmptyHint}</p>
        </div>
      ) : (
        <ul className={styles.notesList}>
          {visible.map((note) => (
            <li key={note.id} className={styles.notesItem}>
              <button
                type="button"
                className={styles.notesMain}
                title={t.noteJumpTitle}
                onClick={() => jump(note)}>
                <span className={styles.notesQuote}>
                  {note.quote.length > 46 ? `${note.quote.slice(0, 46)}…` : note.quote}
                </span>
                {shortTime(note.createdAt, english) ? (
                  <span className={styles.notesTime}>{shortTime(note.createdAt, english)}</span>
                ) : null}
              </button>
              <button
                type="button"
                className={styles.notesRemove}
                aria-label={t.noteRemove}
                onClick={() => onRemove(note)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
