import {appendNodeText, findLeadIndex, normalizeQuote, type CharSite} from './noteText';
import {getDocRoot} from './docContext';

/**
 * DOM locating and highlighting for notes (no storage dependency).
 *
 * The first 40 normalised characters of the quote act as a fingerprint. After
 * navigation we rebuild a normalised-text ↔ text-node-offset map for the
 * article body, `indexOf` the fingerprint, turn the hit into a Range, scroll it
 * into view and flash it with the CSS Custom Highlight API (graceful fallback:
 * scroll only).
 */

/** Fingerprint length: long enough to be unique, short enough to survive edits. */
const LEAD_LEN = 40;
const FLASH_MS = 2600;
const HIGHLIGHT_NAME = 'note-flash';

export function leadOf(quote: string): string {
  return normalizeQuote(quote).slice(0, LEAD_LEN);
}

interface TextIndex {
  big: string;
  map: CharSite[];
}

function buildIndex(root: Element): TextIndex {
  const big: string[] = [];
  const map: CharSite[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      // Skip UI chrome Docusaurus puts inside the prose: heading hash links,
      // copy buttons, hidden helper text. They are never part of a selection.
      if (parent.closest('button, .hash-link, script, style, [aria-hidden="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let prev = '';
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    prev = appendNodeText(node.data, prev, big, map, node);
  }
  return {big: big.join(''), map};
}

/** Locate `leadText` inside `root`; the returned Range spans the fingerprint. */
export function locateLead(root: Element, leadText: string): Range | null {
  if (!leadText || typeof document === 'undefined' || !document.createRange) return null;
  const {big, map} = buildIndex(root);
  const idx = findLeadIndex(big, leadText);
  if (idx < 0) return null;
  const end = Math.min(idx + leadText.length - 1, map.length - 1);
  const start = map[idx];
  const stop = map[end];
  if (!start || !stop) return null;
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(stop.node, stop.offset + 1);
  return range;
}

let flashTimer: ReturnType<typeof setTimeout> | null = null;

/** Scroll a Range into the middle of the viewport and flash it. */
export function flashRange(range: Range): boolean {
  const anchor =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? range.startContainer.parentElement
      : (range.startContainer as Element);
  if (!anchor) return false;

  // Three attempts race Docusaurus' own route scroll reset and async media.
  const scroll = () => anchor.scrollIntoView({block: 'center'});
  try {
    scroll();
    setTimeout(scroll, 300);
    setTimeout(scroll, 1200);
  } catch {
    return false;
  }

  type HighlightCtor = new (range: Range) => unknown;
  const css = (globalThis as {CSS?: {highlights?: Map<string, unknown>}}).CSS;
  const HighlightCtor = (globalThis as {Highlight?: HighlightCtor}).Highlight;
  if (css?.highlights && HighlightCtor) {
    try {
      css.highlights.set(HIGHLIGHT_NAME, new HighlightCtor(range));
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => css.highlights?.delete(HIGHLIGHT_NAME), FLASH_MS);
    } catch {
      // Highlighting is progressive enhancement; locating still succeeded.
    }
  }
  return true;
}

/** Restore a note: locate fingerprint + scroll + flash. False = use percent fallback. */
export function restoreByLeadText(quote: string): boolean {
  if (typeof document === 'undefined') return false;
  const root = getDocRoot();
  if (!root) return false;
  const range = locateLead(root, leadOf(quote));
  if (!range) return false;
  return flashRange(range);
}
