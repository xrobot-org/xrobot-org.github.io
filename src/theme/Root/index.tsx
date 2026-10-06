import React, {type ReactNode} from 'react';
import OriginalRoot from '@theme-original/Root';
import ReadingProgress from '@site/src/components/reading/ReadingProgress';

/**
 * App-level wrapper (wrapped `@theme/Root`, which Docusaurus core provides as
 * a fallback theme component — hence the hand-written `@theme-original/Root`
 * import, matching the swizzle wrap template).
 *
 * Hosts the reading progress bar / circle and the back-to-top button, which
 * live outside the per-route layout.
 */
export default function Root({children}: {children: ReactNode}): ReactNode {
  return (
    <OriginalRoot>
      {children}
      <ReadingProgress />
    </OriginalRoot>
  );
}
