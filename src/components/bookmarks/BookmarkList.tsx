import React, {useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {leadOf} from '@site/src/features/bookmarks/noteDom';
import {markRestore} from '@site/src/features/bookmarks/readingKeys';
import {useBookmarkStrings} from '@site/src/features/bookmarks/strings';
import type {Bookmark, Note} from '@site/src/features/bookmarks/types';
import {
  BOOKMARKS_EVENT,
  exportBookmarks,
  importBookmarks,
  loadBookmarks,
  removeBookmark,
} from '@site/src/features/bookmarks/useBookmarks';
import {NOTES_EVENT, loadNotes, removeNote} from '@site/src/features/bookmarks/useNotes';
import styles from './bookmarks.module.css';

/**
 * Bookmarks page body: articles with a star and/or notes, grouped by article.
 * Group headers resume reading at the stored percentage; note rows jump to the
 * exact passage (text fingerprint with percentage fallback).
 *
 * The shelf only lives in this browser, so JSON export/import is the way to
 * move it to another device.
 */

interface Group {
  path: string;
  title: string;
  bookmark: Bookmark | null;
  notes: Note[];
  sortAt: number;
}

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookmarkList(): React.JSX.Element {
  const t = useBookmarkStrings();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = () => {
    setBookmarks(loadBookmarks());
    setNotes(loadNotes());
  };

  useEffect(() => {
    sync();
    const onStorage = () => sync();
    window.addEventListener(BOOKMARKS_EVENT, onStorage);
    window.addEventListener(NOTES_EVENT, onStorage);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, onStorage);
      window.removeEventListener(NOTES_EVENT, onStorage);
      window.removeEventListener('storage', onStorage);
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, []);

  /** One group per article that has a bookmark, a note, or both. */
  const groups = useMemo<Group[]>(() => {
    const byPath = new Map<string, Group>();
    for (const bookmark of bookmarks) {
      byPath.set(bookmark.path, {
        path: bookmark.path,
        title: bookmark.title,
        bookmark,
        notes: [],
        sortAt: bookmark.updatedAt,
      });
    }
    for (const note of notes) {
      const group = byPath.get(note.path) ?? {
        path: note.path,
        title: note.title || note.path,
        bookmark: null,
        notes: [],
        sortAt: 0,
      };
      group.notes.push(note);
      if (note.createdAt > group.sortAt) group.sortAt = note.createdAt;
      if (!group.bookmark) group.title = note.title || group.title;
      byPath.set(note.path, group);
    }
    // Babel's Docusaurus preset compiles `[...map.values()]` loosely to
    // `[].concat(iterator)`, so use Array.from for iterables.
    return Array.from(byPath.values()).sort((a, b) => b.sortAt - a.sortAt);
  }, [bookmarks, notes]);

  const flash = (text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 8000);
  };

  const onJumpGroup = (group: Group) => {
    if (group.bookmark) markRestore(group.path, group.bookmark.scrollPercent);
  };

  const onJumpNote = (note: Note) => {
    markRestore(note.path, note.scrollPercent, leadOf(note.quote));
  };

  const onRemoveBookmark = (group: Group) => {
    if (!group.bookmark) return;
    removeBookmark(group.path);
    sync();
    flash(t.unstarDone(group.title));
  };

  const onRemoveNote = (note: Note) => {
    removeNote(note.id);
    sync();
  };

  const exportBackup = () => {
    try {
      const blob = new Blob([exportBookmarks()], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bookmarks-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      flash(t.exportStarted);
    } catch {
      flash(t.exportFailed);
    }
  };

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = importBookmarks(await file.text());
      if (!result) {
        flash(t.importFailedFormat);
        return;
      }
      sync();
      flash(t.importDone(result.bookmarks, result.notes));
    } catch {
      flash(t.importFailedRead);
    }
  };

  return (
    <div className={styles.list}>
      {groups.length === 0 ? (
        <p className={styles.empty}>{t.pageEmpty}</p>
      ) : (
        <ul className={styles.groups}>
          {groups.map((group) => (
            <li key={group.path} className={styles.group}>
              <div className={styles.groupHead}>
                <Link
                  className={styles.groupTitle}
                  to={group.path}
                  onClick={() => onJumpGroup(group)}>
                  <span className={styles.groupStar} aria-hidden="true">
                    {group.bookmark ? '★' : '✎'}
                  </span>
                  <span className={styles.groupName}>{group.title}</span>
                  {group.bookmark && formatTime(group.bookmark.updatedAt) ? (
                    <span className={styles.groupTime}>
                      {t.readAt(formatTime(group.bookmark.updatedAt))}
                    </span>
                  ) : null}
                </Link>
                {group.bookmark ? (
                  <button
                    type="button"
                    className={styles.unstar}
                    aria-label={t.unstarAria(group.title)}
                    title={t.unstarTitle}
                    onClick={() => onRemoveBookmark(group)}>
                    {t.unstar}
                  </button>
                ) : null}
              </div>

              {group.notes.length > 0 ? (
                <ul className={styles.bmNotes}>
                  {group.notes.map((note) => (
                    <li key={note.id} className={styles.bmNote}>
                      <Link
                        className={styles.bmNoteQuote}
                        to={group.path}
                        title={t.noteJumpTitle}
                        onClick={() => onJumpNote(note)}>
                        「{note.quote.length > 90 ? `${note.quote.slice(0, 90)}…` : note.quote}」
                      </Link>
                      <button
                        type="button"
                        className={styles.bmNoteRemove}
                        aria-label={t.noteRemove}
                        onClick={() => onRemoveNote(note)}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className={styles.backup}>
        <span className={styles.backupHint}>
          {t.backupHint(bookmarks.length, notes.length)}
        </span>
        <span className={styles.backupActions}>
          <button type="button" className={styles.textLink} onClick={exportBackup}>
            {t.exportBackup}
          </button>
          <button
            type="button"
            className={styles.textLink}
            onClick={() => fileInput.current?.click()}>
            {t.importBackup}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className={styles.fileInput}
            onChange={onImportFile}
          />
        </span>
        {message ? (
          <span className={styles.backupNote} role="status">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
