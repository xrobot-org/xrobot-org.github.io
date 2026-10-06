import React, {type ReactNode} from 'react';
import OriginalRoot from '@theme-original/Root';
import ReadingProgress from '@site/src/components/appearance/ReadingProgress';
import NavbarScrollBehavior from '@site/src/components/appearance/NavbarScrollBehavior';
import AppearancePanelHost from '@site/src/components/appearance/AppearancePanelHost';

/**
 * App-level wrapper (wrapped `@theme/Root`, which Docusaurus core provides as
 * a fallback theme component — hence the hand-written `@theme-original/Root`
 * import, matching the swizzle wrap template).
 *
 * Hosts the global UI pieces that must live outside the per-route layout:
 * the reading progress bar/circle, the navbar scroll behavior effect and the
 * root-hosted appearance panel (so it survives mobile-sidebar unmounts).
 */
export default function Root({children}: {children: ReactNode}): ReactNode {
  return (
    <OriginalRoot>
      {children}
      <ReadingProgress />
      <NavbarScrollBehavior />
      <AppearancePanelHost />
    </OriginalRoot>
  );
}
