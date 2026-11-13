/**
 * Small DOM helpers shared by the bookmark button, note capture and restore
 * pipeline. Everything here is browser-only and guarded for SSR.
 */

export const DOC_ROOT_SELECTOR = '.theme-doc-markdown';

/** Docs live at `/docs/...` (zh) and `/en/docs/...` (localised). */
export function isDocPath(pathname: string): boolean {
  return /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?docs(?:\/|$)/.test(pathname);
}

/** `/en/docs/a` is on the English locale; `/docs/a` is the default one. */
export function isEnglishPath(pathname: string): boolean {
  return pathname === '/en' || pathname.startsWith('/en/');
}

/** Locale-aware bookmarks page href. */
export function bookmarksHref(pathname: string): string {
  return isEnglishPath(pathname) ? '/en/bookmarks' : '/bookmarks';
}

/** The article body of the current doc page, or null outside a doc. */
export function getDocRoot(): Element | null {
  if (typeof document === 'undefined') return null;
  return (
    document.querySelector(DOC_ROOT_SELECTOR) ??
    document.querySelector('article .markdown') ??
    null
  );
}

/**
 * Article title for storage. Prefer the rendered `<h1>` so front-matter titles
 * without a Markdown heading (Docusaurus synthesises one) work too; fall back
 * to the document title with the site suffix removed.
 */
export function getDocTitle(): string {
  if (typeof document === 'undefined') return '';
  const heading = getDocRoot()?.querySelector('h1') ?? document.querySelector('article h1');
  const text = heading?.textContent?.trim();
  if (text) return text;
  return document.title.split(/[|｜]/)[0].trim();
}

/** Current scroll position as a 0-100 percentage. */
export function currentScrollPercent(): number {
  if (typeof document === 'undefined') return 0;
  const el = document.documentElement;
  const max = el.scrollHeight - el.clientHeight;
  return max > 0 ? Math.min(100, Math.max(0, Math.round((el.scrollTop / max) * 100))) : 0;
}

/**
 * Scroll to a percentage, re-applying three times. Images, Mermaid diagrams
 * and lazily rendered content keep growing after the first paint, so a single
 * attempt lands in the wrong place.
 */
export function scrollToPercent(percent: number): void {
  const attempt = () => {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    if (max > 0) el.scrollTop = (max * Math.min(100, Math.max(0, percent))) / 100;
  };
  requestAnimationFrame(attempt);
  setTimeout(attempt, 300);
  setTimeout(attempt, 1200);
}
