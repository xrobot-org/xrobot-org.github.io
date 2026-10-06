/**
 * Appearance preferences shared by the appearance panel, the navbar scroll
 * behavior and the FOUC-prevention head script (static/appearance-init.js,
 * which mirrors this logic in plain ES5 — keep the two in sync).
 *
 * localStorage keys and html data attributes follow the shared contract with
 * the CSS layer (src/css/xrstyle-*.css); the CSS side reads the attributes,
 * JS only writes them.
 *
 * Nothing here touches window/document at module top level: every function is
 * called from effects or event handlers in the browser only.
 */

export const ACCENT_HUE_KEY = 'xr-accent-hue';
export const FONT_MODE_KEY = 'xr-font-mode';
export const CARD_DECOR_KEY = 'xr-card-decor';
export const NAVBAR_MODE_KEY = 'xr-navbar-mode';
export const BG_MODE_KEY = 'xr-bg-mode';

export type AccentMode = 'mono' | 'hue';
export type FontMode = 'default' | 'wenkai';
export type CardDecor = 'ink' | 'soft';
export type NavbarMode = 'always' | 'autohide';
export type BgMode = 'plain' | 'grid' | 'dots';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting still applies for this page view */
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------------------------------------------------------------- accent */

/**
 * Stored hue, or null when the mono (ink) accent is active — the key only
 * exists while hue mode is on.
 */
export function readAccentHue(): number | null {
  const raw = readStorage(ACCENT_HUE_KEY);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(360, Math.max(0, parsed));
}

/**
 * Write the accent state: pass a hue (0-360) for hue mode, null to go back to
 * the mono accent (removes the storage key and sets data-accent="mono").
 */
export function writeAccentHue(hue: number | null): void {
  if (hue === null) {
    removeStorage(ACCENT_HUE_KEY);
  } else {
    writeStorage(ACCENT_HUE_KEY, String(hue));
  }
  const root = document.documentElement;
  root.dataset.accent = hue === null ? 'mono' : 'hue';
  if (hue !== null) {
    root.style.setProperty('--xr-hue', String(hue));
  }
}

/** Current accent mode: hue when the storage key exists, mono otherwise. */
export function readAccentMode(): AccentMode {
  return readStorage(ACCENT_HUE_KEY) !== null ? 'hue' : 'mono';
}

/** Last hue shown by the panel slider while in mono mode (not persisted). */
export const DEFAULT_SLIDER_HUE = 250;

/* ------------------------------------------------------------- font mode */

export function readFontMode(): FontMode {
  return readStorage(FONT_MODE_KEY) === 'wenkai' ? 'wenkai' : 'default';
}

export function writeFontMode(mode: FontMode): void {
  writeStorage(FONT_MODE_KEY, mode);
  document.documentElement.dataset.fontMode = mode;
  if (mode === 'wenkai') {
    ensureWenkaiStylesheet();
  }
}

/**
 * Inject the LXGW WenKai Screen @font-face stylesheet on a live switch (the
 * head script only covers full page loads). Safe to call repeatedly.
 */
export function ensureWenkaiStylesheet(): void {
  if (document.querySelector('link[data-xr-font="wenkai"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/fonts/lxgw/lxgwwenkaiscreen.css';
  link.dataset.xrFont = 'wenkai';
  document.head.appendChild(link);
}

/* ------------------------------------------------------------ card decor */

export function readCardDecor(): CardDecor {
  return readStorage(CARD_DECOR_KEY) === 'soft' ? 'soft' : 'ink';
}

export function writeCardDecor(decor: CardDecor): void {
  writeStorage(CARD_DECOR_KEY, decor);
  document.documentElement.dataset.cardDecor = decor;
}

/* ----------------------------------------------------------- navbar mode */

export function readNavbarMode(): NavbarMode {
  return readStorage(NAVBAR_MODE_KEY) === 'autohide' ? 'autohide' : 'always';
}

export function writeNavbarMode(mode: NavbarMode): void {
  writeStorage(NAVBAR_MODE_KEY, mode);
  document.documentElement.dataset.navbarMode = mode;
}

/* --------------------------------------------------------------- bg mode */

export function readBgMode(): BgMode {
  const raw = readStorage(BG_MODE_KEY);
  return raw === 'grid' || raw === 'dots' ? raw : 'plain';
}

export function writeBgMode(mode: BgMode): void {
  writeStorage(BG_MODE_KEY, mode);
  document.documentElement.dataset.bgMode = mode;
}
