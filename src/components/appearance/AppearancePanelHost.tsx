/**
 * Owns the AppearancePanel lifetime at the app root (mounted by Root), so the
 * panel never lives inside a NavbarItem that can unmount — the mobile sidebar
 * unmounts its items when it closes, which used to kill the panel with it.
 *
 * The navbar palette button only dispatches `xr-toggle-appearance-panel`;
 * outside pointerdown and Escape close it here.
 */
import React, { useCallback, useEffect, useState } from 'react';
import AppearancePanel from '@site/src/components/appearance/AppearancePanel';

export const APPEARANCE_PANEL_TOGGLE = 'xr-toggle-appearance-panel';

export default function AppearancePanelHost(): JSX.Element {
  const [open, setOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onToggle = () => setOpen((value) => !value);
    window.addEventListener(APPEARANCE_PANEL_TOGGLE, onToggle);
    return () => window.removeEventListener(APPEARANCE_PANEL_TOGGLE, onToggle);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      // Let the palette button's own click fall through to the toggle handler
      // (otherwise pointerdown closes the panel and click re-opens it).
      if (event.target instanceof Element && event.target.closest('[aria-haspopup="dialog"]')) {
        return;
      }
      const container = containerRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef}>
      {open ? <AppearancePanel onClose={close} /> : null}
    </div>
  );
}
