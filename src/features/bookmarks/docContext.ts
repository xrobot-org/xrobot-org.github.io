import {MAX_ANCHOR_LEN} from './store.ts';
import {
  appendSegment,
  findLeadMatches,
  leadOf,
  normalizeText,
  pickNearestMatch,
  type CharSite,
} from './textLocator.ts';

/**
 * Browser DOM helpers for doc bookmarking and CSS Custom Highlight API restoration.
 * Everything here guards against SSR where `window` / `document` are absent.
 */

export const DOC_ROOT_SELECTOR = '.theme-doc-markdown';
const HIGHLIGHT_NAME = 'xr-bookmark-flash';
const FLASH_MS = 2400;
const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, pre, div';

export function getDocRoot(): Element | null {
  if (typeof document === 'undefined') return null;
  return (
    document.querySelector(DOC_ROOT_SELECTOR) ??
    document.querySelector('article .markdown') ??
    null
  );
}

export function getDocTitle(): string {
  if (typeof document === 'undefined') return '';
  const heading = getDocRoot()?.querySelector('h1') ?? document.querySelector('article h1');
  const text = heading?.textContent?.trim();
  if (text) return text;
  return document.title.split(/[|｜]/)[0].trim();
}

export function currentScrollPercent(): number {
  if (typeof document === 'undefined') return 0;
  const el = document.documentElement;
  const max = el.scrollHeight - el.clientHeight;
  return max > 0 ? Math.min(100, Math.max(0, Math.round((el.scrollTop / max) * 100))) : 0;
}

/**
 * Capture a short excerpt from the first readable heading/paragraph/list item
 * near the upper viewport, excluding code blocks. Used for precise resume jumps.
 */
export function captureVisibleAnchor(): string | undefined {
  if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
  const root = getDocRoot();
  if (!root) return undefined;

  const minTop = 68;
  const maxTop = window.innerHeight * 0.65;
  const candidates = root.querySelectorAll('h2, h3, h4, p, li, td');
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];
    if (el.closest('pre')) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) continue;
    if (rect.bottom <= minTop || rect.top >= maxTop) continue;
    const text = normalizeText(el.textContent ?? '');
    if (text.length >= 6) {
      return text.slice(0, MAX_ANCHOR_LEN);
    }
  }
  return undefined;
}

function buildTextIndex(root: Element): {big: string; map: Array<CharSite<Text>>} {
  const big: string[] = [];
  const map: Array<CharSite<Text>> = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('button, .hash-link, script, style, [aria-hidden="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let prev = '';
  let lastBlock: Element | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    const block = parent ? parent.closest(BLOCK_SELECTOR) : null;
    const boundary = lastBlock !== null && block !== lastBlock;
    prev = appendSegment(node.data, prev, boundary, big, map, node);
    lastBlock = block;
  }
  return {big: big.join(''), map};
}

/** Locate `anchorText` inside `root` closest to `scrollPercent`. */
export function locateAnchorRange(
  root: Element,
  anchorText: string,
  scrollPercent: number,
): Range | null {
  if (typeof document === 'undefined' || !document.createRange) return null;
  const lead = leadOf(anchorText);
  if (!lead) return null;

  const {big, map} = buildTextIndex(root);
  const matches = findLeadMatches(big, lead);
  const hit = pickNearestMatch(matches, big.length, scrollPercent);
  if (!hit || map.length === 0) return null;

  const endIdx = Math.min(hit.start + hit.length - 1, map.length - 1);
  const start = map[hit.start];
  const stop = map[endIdx];
  if (!start || !stop) return null;

  try {
    const range = document.createRange();
    const startOffset = Math.min(start.offset, start.node.data.length);
    const stopOffset = Math.min(stop.offset + 1, stop.node.data.length);
    range.setStart(start.node, startOffset);
    range.setEnd(stop.node, stopOffset);
    return range;
  } catch {
    return null;
  }
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;

function prefersInstantScroll(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.motion === 'off';
}

function attachUserCancel(onCancel: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const events: Array<keyof WindowEventMap> = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  for (const ev of events) {
    window.addEventListener(ev, onCancel, {passive: true, once: true});
  }
  return () => {
    for (const ev of events) {
      window.removeEventListener(ev, onCancel);
    }
  };
}

/**
 * Scroll `range` into the centre of the viewport and flash it with the CSS Custom
 * Highlight API (falling back silently to scroll-only where unsupported).
 * Returns a cancel function; also auto-cancels pending retries on user input.
 */
export function flashAndScrollRange(range: Range): () => void {
  const container = range.startContainer;
  const anchor =
    container.nodeType === Node.TEXT_NODE
      ? container.parentElement
      : (container as Element);
  if (!anchor) return () => {};

  let cancelled = false;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let detachInput = () => {};

  const stopRetries = () => {
    cancelled = true;
    for (const id of timers) clearTimeout(id);
    timers.length = 0;
    detachInput();
  };

  detachInput = attachUserCancel(stopRetries);

  const scroll = (smooth: boolean) => {
    if (cancelled) return;
    anchor.scrollIntoView({
      block: 'center',
      behavior: smooth && !prefersInstantScroll() ? 'smooth' : 'auto',
    });
  };

  try {
    scroll(false);
    timers.push(setTimeout(() => scroll(false), 300));
    timers.push(setTimeout(() => scroll(false), 1000));
  } catch {
    stopRetries();
    return () => {};
  }

  type HighlightCtor = new (range: Range) => unknown;
  const css = (globalThis as {CSS?: {highlights?: Map<string, unknown>}}).CSS;
  const HighlightCtor = (globalThis as {Highlight?: HighlightCtor}).Highlight;
  if (css?.highlights && HighlightCtor) {
    try {
      css.highlights.set(HIGHLIGHT_NAME, new HighlightCtor(range));
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        css.highlights?.delete(HIGHLIGHT_NAME);
        flashTimer = null;
      }, FLASH_MS);
    } catch {
      // Progressive enhancement only; scroll positioning already succeeded.
    }
  }

  return () => {
    stopRetries();
    if (flashTimer) {
      clearTimeout(flashTimer);
      flashTimer = null;
    }
    css?.highlights?.delete(HIGHLIGHT_NAME);
  };
}

/** Scroll to `percent` with cancellable retries as async images/Mermaid diagrams settle. */
export function scrollToPercentCancellable(percent: number): () => void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return () => {};
  let cancelled = false;
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let raf = 0;
  let detachInput = () => {};

  const stop = () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    for (const id of timers) clearTimeout(id);
    timers.length = 0;
    detachInput();
  };

  detachInput = attachUserCancel(stop);

  const attempt = () => {
    if (cancelled) return;
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (max > 0) el.scrollTop = (max * clamped) / 100;
  };

  raf = requestAnimationFrame(attempt);
  timers.push(setTimeout(attempt, 300), setTimeout(attempt, 1000));
  return stop;
}
