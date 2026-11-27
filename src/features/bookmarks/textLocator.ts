/**
 * Pure text normalisation and index mapping for anchor restoration.
 *
 * Kept free of DOM globals so it can be unit-tested directly under Node.
 */

export interface CharSite<TNode = unknown> {
  node: TNode;
  /** Character index inside the underlying text node's data. */
  offset: number;
}

export interface TextMatch {
  start: number;
  length: number;
}

const ZERO_WIDTH_SINGLE = /[\u200B-\u200D\uFEFF]/;
const ZERO_WIDTH_GLOBAL = /[\u200B-\u200D\uFEFF]/g;

/** Collapse whitespace runs and strip zero-width characters (e.g. heading hash links). */
export function normalizeText(text: string): string {
  return text.replace(ZERO_WIDTH_GLOBAL, '').replace(/\s+/g, ' ').trim();
}

export function leadOf(text: string, maxLen = 40): string {
  return normalizeText(text).slice(0, maxLen);
}

/**
 * Append one text node into `big` and `map`.
 *
 * When `blockBoundary` is true (moved into a different block element such as `<p>` or `<li>`),
 * a single synthetic space separator is emitted if needed so words across blocks do not fuse.
 */
export function appendSegment<TNode>(
  data: string,
  prevChar: string,
  blockBoundary: boolean,
  big: string[],
  map: Array<CharSite<TNode>>,
  node: TNode,
): string {
  let prev = prevChar;
  if (blockBoundary && prev && prev !== ' ') {
    // Point synthetic separator at offset 0 of the incoming node; match trimming prevents
    // ending on a trailing synthetic space, and starting on one is safe for Range.setStart.
    big.push(' ');
    map.push({node, offset: 0});
    prev = ' ';
  }

  for (let i = 0; i < data.length; i++) {
    const ch = data[i];
    if (ZERO_WIDTH_SINGLE.test(ch)) continue;
    if (/\s/.test(ch)) {
      if (prev === ' ') continue;
      big.push(' ');
      map.push({node, offset: i});
      prev = ' ';
    } else {
      big.push(ch);
      map.push({node, offset: i});
      prev = ch;
    }
  }
  return prev;
}

/**
 * Find all occurrences of `leadText` in `big`.
 * Falls back once to `leadText.slice(2)` when exact match misses and `leadText.length > 8`,
 * returning exact match bounds without shifting before the matched slice.
 */
export function findLeadMatches(big: string, leadText: string): TextMatch[] {
  if (!leadText) return [];
  const exact = collectMatches(big, leadText);
  if (exact.length > 0) return exact;
  if (leadText.length > 8) {
    return collectMatches(big, leadText.slice(2));
  }
  return [];
}

function collectMatches(haystack: string, needle: string): TextMatch[] {
  if (!needle) return [];
  const matches: TextMatch[] = [];
  let pos = 0;
  while (pos <= haystack.length - needle.length) {
    const idx = haystack.indexOf(needle, pos);
    if (idx < 0) break;
    matches.push({start: idx, length: needle.length});
    pos = idx + Math.max(1, needle.length);
  }
  return matches;
}

/**
 * Choose the occurrence whose relative position (`start / totalLength`) is closest to
 * `scrollPercent / 100`. Handles repeated headings/commands across a long doc.
 */
export function pickNearestMatch(
  matches: TextMatch[],
  totalLength: number,
  scrollPercent: number,
): TextMatch | null {
  if (matches.length === 0) return null;
  if (matches.length === 1 || totalLength <= 0) return matches[0];
  const targetRatio = Math.min(1, Math.max(0, scrollPercent / 100));
  let best = matches[0];
  let bestDist = Math.abs(best.start / totalLength - targetRatio);
  for (let i = 1; i < matches.length; i++) {
    const dist = Math.abs(matches[i].start / totalLength - targetRatio);
    if (dist < bestDist) {
      best = matches[i];
      bestDist = dist;
    }
  }
  return best;
}
