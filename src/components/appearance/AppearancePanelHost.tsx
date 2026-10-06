/**
 * Owns the AppearancePanel lifetime at the app root (mounted by Root), so the
 * panel never lives inside a NavbarItem that can unmount — the mobile sidebar
 * unmounts its items when it closes, which used to kill the panel with it.
 *
 * The navbar palette button only dispatches `xr-toggle-appearance-panel`;
 * outside pointerdown and Escape close it here. As an aria-modal dialog the
 * panel also receives keyboard focus when opened (focus returns to the
 * previously focused element on close) and Tab is kept cycling inside it.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppearancePanel from '@site/src/components/appearance/AppearancePanel';

export const APPEARANCE_PANEL_TOGGLE = 'xr-toggle-appearance-panel';

export default function AppearancePanelHost(): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onToggle = () => setOpen((value) => !value);
    window.addEventListener(APPEARANCE_PANEL_TOGGLE, onToggle);
    return () => window.removeEventListener(APPEARANCE_PANEL_TOGGLE, onToggle);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const container = containerRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    // Move focus into the panel so keyboard users do not have to tab through
    // the whole page to reach it.
    container?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement;
      if (event.shiftKey && (current === first || !container.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !container.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      // Let the palette button's own click fall through to the toggle handler
      // (otherwise pointerdown closes the panel and click re-opens it).
      if (event.target instanceof Element && event.target.closest('[aria-haspopup="dialog"]')) {
        return;
      }
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      // Hand focus back to the trigger when the panel goes away.
      previousFocus?.focus();
    };
  }, [open]);

  return (
    <div ref={containerRef} tabIndex={-1} style={{ outline: 'none' }}>
      {open ? <AppearancePanel onClose={close} /> : null}
    </div>
  );
}
