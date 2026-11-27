import React, {type ReactNode} from 'react';
import OriginalRoot from '@theme-original/Root';
import ReadingProgress from '@site/src/components/reading/ReadingProgress';
import {useBookmarkAutoTrack, useBookmarkRestore} from '@site/src/features/bookmarks/useBookmarks';

function BookmarkEffects(): null {
  useBookmarkRestore();
  useBookmarkAutoTrack();
  return null;
}

/**
 * App-level wrapper (wrapped `@theme/Root`, which Docusaurus core provides as
 * a fallback theme component — hence the hand-written `@theme-original/Root`
 * import, matching the swizzle wrap template).
 *
 * Hosts the reading progress bar / circle, the back-to-top button, and
 * client-side bookmark restore / progress tracking.
 */
export default function Root({children}: {children: ReactNode}): ReactNode {
  return (
    <OriginalRoot>
      {children}
      <ReadingProgress />
      <BookmarkEffects />
    </OriginalRoot>
  );
}
