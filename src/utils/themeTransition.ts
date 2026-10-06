/**
 * Animated light/dark switch: fades every color over ~320ms via a temporary
 * `is-theme-transitioning` class on <html> (CSS lives in
 * xrstyle-reading.css, section b).
 *
 * We deliberately do NOT use document.startViewTransition here: its snapshot
 * crossfade freezes the whole page for the duration and stalls rendering for
 * seconds in some environments, while the in-place color transition keeps the
 * page live and measurably smooth (rAF sampling: no dropped frames).
 *
 * With the page animation switch off, the theme is
 * applied instantly. Re-entrant clicks during a fade skip straight to apply()
 * so rapid toggling can never stack animations.
 */
export function animateColorModeSwitch(apply: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    apply();
    return;
  }
  const root = document.documentElement;
  const motionOff = root.dataset.motion === 'off';
  if (motionOff || root.classList.contains('is-theme-transitioning')) {
    apply();
    return;
  }
  root.classList.add('is-theme-transitioning');
  apply();
  window.setTimeout(() => root.classList.remove('is-theme-transitioning'), 360);
}
