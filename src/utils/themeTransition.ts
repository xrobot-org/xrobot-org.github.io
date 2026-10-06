/**
 * Animated light/dark switch: fades every color over ~320ms via a temporary
 * `is-theme-transitioning` class on <html> (CSS lives in
 * xrstyle-appearance.css, transition section b).
 *
 * We deliberately do NOT use document.startViewTransition here: its snapshot
 * crossfade freezes the whole page for the duration and stalls rendering for
 * seconds in some environments, while the in-place color transition keeps the
 * page live and measurably smooth (rAF sampling: no dropped frames).
 *
 * With reduced motion or the site-wide animation switch off, the theme is
 * applied instantly. Re-entrant clicks during a fade skip straight to apply()
 * so rapid toggling can never stack animations.
 */
export function animateColorModeSwitch(apply: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    apply();
    return;
  }
  const root = document.documentElement;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const motionOff = root.dataset.motion === 'off';
  if (reducedMotion || motionOff || root.classList.contains('is-theme-transitioning')) {
    apply();
    return;
  }
  root.classList.add('is-theme-transitioning');
  apply();
  window.setTimeout(() => root.classList.remove('is-theme-transitioning'), 360);
}
