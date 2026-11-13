/**
 * Text normalisation and index mapping for note anchors (pure logic).
 *
 * A selection's text is what the reader sees, but the DOM splits it across
 * inline elements (`code`, `strong`, `a`) and whitespace from the Markdown
 * source. To turn "first 40 chars of the quote" back into a DOM Range after a
 * navigation, we build a per-character map from a normalised string to the
 * original text-node offsets.
 *
 * Normalisation rules (must be identical on capture and lookup):
 *   - runs of whitespace collapse to one space, including at text-node edges;
 *   - zero-width characters (Docusaurus heading hash links inject them) are
 *     dropped so they cannot break a fingerprint.
 */

export interface CharSite {
  node: Text;
  /** Index of this normalised character inside `node.data`. */
  offset: number;
}

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/;

/** Fold one text node into `big` / `map`; `prevChar` handles cross-node whitespace. */
export function appendNodeText(
  data: string,
  prevChar: string,
  big: string[],
  map: CharSite[],
  node: Text,
): string {
  let prev = prevChar;
  for (let i = 0; i < data.length; i++) {
    const ch = data[i];
    if (ZERO_WIDTH.test(ch)) continue;
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

/** Normalise selection / quote text with the same rules as `appendNodeText`. */
export function normalizeQuote(text: string): string {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Find `leadText` in `big`. The exact match wins; for robust matching against
 * small punctuation differences (list markers, spacing before punctuation),
 * fall back to searching the tail after skipping two leading characters.
 */
export function findLeadIndex(big: string, leadText: string): number {
  const idx = big.indexOf(leadText);
  if (idx >= 0) return idx;
  if (leadText.length > 8) {
    const tail = leadText.slice(2);
    const t = big.indexOf(tail);
    if (t >= 0) return t - 2 >= 0 ? t - 2 : t;
  }
  return -1;
}
