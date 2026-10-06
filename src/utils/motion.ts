/**
 * Page-level animation switch, shared by every UI that reads or writes it.
 *
 * Used by the "动画 开 / 关" control in the home page hero and by the showcase widgets;
 * static/motion-init.js applies the stored value before first paint.
 *
 * Animation is on by default, independent of the OS `prefers-reduced-motion` setting;
 * the choice is stored in localStorage and broadcast with the `xr-motion` event so every
 * widget follows it at once. CSS keys off `html[data-motion]`.
 */
import { useEffect, useState } from 'react';

export const MOTION_KEY = 'xr-motion';

export function readMotionOff(): boolean {
  try {
    return window.localStorage.getItem(MOTION_KEY) === 'off';
  } catch {
    return false;
  }
}

export function setMotionOff(off: boolean): void {
  try {
    window.localStorage.setItem(MOTION_KEY, off ? 'off' : 'on');
  } catch {
    /* storage unavailable: the switch still works for this page view */
  }
  document.documentElement.dataset.motion = off ? 'off' : 'on';
  window.dispatchEvent(new CustomEvent('xr-motion', { detail: off }));
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const update = (e?: Event) => setReduced(e instanceof CustomEvent ? Boolean(e.detail) : readMotionOff());
    // another tab changed the switch: follow it here too
    const onStorage = (e: StorageEvent) => {
      if (e.key !== MOTION_KEY) return;
      const off = e.newValue === 'off';
      document.documentElement.dataset.motion = off ? 'off' : 'on';
      setReduced(off);
    };
    update();
    window.addEventListener('xr-motion', update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('xr-motion', update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return reduced;
}
