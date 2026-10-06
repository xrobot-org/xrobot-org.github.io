/**
 * Navbar scroll behavior, no UI of its own: toggles classes on the fixed
 * `.navbar` element per the shared contract with the CSS layer.
 *
 * - `xr-nav-scrolled`: page scrolled past 8 px (compact + glass navbar).
 * - `xr-nav-hidden`: data-navbar-mode="autohide" AND the page scrolled down by
 *   a accumulated amount; removed on any upward scroll or back near the top.
 *   The direction is derived from scrollY deltas, so wheel, keyboard,
 *   scrollbar and touch scrolling all behave the same.
 *
 * data-navbar-mode is written by the appearance panel; a MutationObserver on
 * <html> keeps the classes in sync no matter who writes the attribute.
 */
import React, { useEffect } from 'react';

function getNavbar(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.navbar');
}

const HIDE_ACCUM = 120; // px of downward scroll before the navbar hides
const TOP_LINE = 8; // px before "at the top" applies

export default function NavbarScrollBehavior(): null {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    let lastY = window.scrollY;
    let downAccum = 0;

    const apply = () => {
      raf = 0;
      const navbar = getNavbar();
      if (!navbar) return;
      const y = window.scrollY || root.scrollTop || 0;
      const dy = y - lastY;
      lastY = y;
      navbar.classList.toggle('xr-nav-scrolled', y > TOP_LINE);
      if (root.dataset.navbarMode !== 'autohide') {
        navbar.classList.remove('xr-nav-hidden');
        return;
      }
      if (y <= TOP_LINE) {
        downAccum = 0;
        navbar.classList.remove('xr-nav-hidden');
      } else if (dy < 0) {
        downAccum = 0;
        navbar.classList.remove('xr-nav-hidden');
      } else if (dy > 0) {
        downAccum += dy;
        if (downAccum >= HIDE_ACCUM) {
          navbar.classList.add('xr-nav-hidden');
        }
      }
    };

    const schedule = () => {
      if (!raf) {
        raf = window.requestAnimationFrame(apply);
      }
    };

    // React to data-navbar-mode changes (written by the appearance panel):
    // re-anchor the scroll baseline so switching modes never hides the navbar
    // because of deltas accumulated in the other mode.
    const observer = new MutationObserver(() => {
      lastY = window.scrollY;
      downAccum = 0;
      const navbar = getNavbar();
      if (!navbar) return;
      if (root.dataset.navbarMode !== 'autohide') {
        navbar.classList.remove('xr-nav-hidden');
      }
      navbar.classList.toggle('xr-nav-scrolled', (window.scrollY || 0) > TOP_LINE);
    });
    observer.observe(root, { attributes: true, attributeFilter: ['data-navbar-mode'] });

    apply();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return null;
}
