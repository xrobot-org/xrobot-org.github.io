import React from 'react';
import {useBookmarkAutoTrack, useBookmarkRestore} from '@site/src/features/bookmarks/restore';
import NoteCapture from './NoteCapture';

/**
 * App-level bookmark behaviour, mounted once by the Root wrapper:
 * - restores the position / passage after a bookmarks-page jump;
 * - silently tracks progress for already-bookmarked articles;
 * - hosts the floating note-capture button.
 */
export default function BookmarkSystem(): React.JSX.Element {
  useBookmarkRestore();
  useBookmarkAutoTrack();

  return <NoteCapture />;
}
