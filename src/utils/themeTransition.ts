/**
 * Animated light/dark switch helper (ported from the Aemeath reference theme,
 * setting-utils.ts applyThemeToDocument): wraps the actual theme change so the
 * whole page fades instead of snapping.
 *
 * - With View Transitions support (and motion enabled): add the helper classes,
 *   run `apply()` inside document.startViewTransition. `apply()` triggers React
 *   state changes; once Docusaurus writes `data-theme` back to <html> we wait
 *   two animation frames and resolve (200 ms timeout as a safety net).
 * - Without support (or reduced motion / motion switch off): degrade to the
 *   `is-theme-transitioning` class only, which the CSS layer turns into a
 *   360 ms color fade; removed after the fade.
 *
 * `is-theme-transitioning` / `use-view-transition` are consumed by the CSS layer
 * (see the shared contract in src/css/xrstyle-*.css).
 */
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function animateColorModeSwitch(apply: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    apply();
    return;
  }
  const root = document.documentElement;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const motionOff = root.dataset.motion === 'off';
  const doc = document as ViewTransitionDocument;

  if (reducedMotion || motionOff || typeof doc.startViewTransition !== 'function') {
    root.classList.add('is-theme-transitioning');
    apply();
    window.setTimeout(() => root.classList.remove('is-theme-transitioning'), 360);
    return;
  }

  root.classList.add('is-theme-transitioning', 'use-view-transition');
  const transition = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          observer.disconnect();
          // Two frames: make sure the new theme colors are painted before the
          // view transition snapshots settle.
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
        };
        // `apply()` re-renders React; Docusaurus then writes data-theme on <html>.
        const observer = new MutationObserver(finish);
        observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
        // Safety net in case data-theme never changes (e.g. same value).
        window.setTimeout(finish, 200);
        apply();
      }),
  );
  void transition.finished.finally(() => {
    root.classList.remove('is-theme-transitioning', 'use-view-transition');
  });
}
