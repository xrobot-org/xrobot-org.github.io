import React, { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import CodeBlock from '@theme-original/CodeBlock';
import type CodeBlockType from '@theme/CodeBlock';
import type { WrapperProps } from '@docusaurus/types';
import { translate } from '@docusaurus/Translate';

type Props = WrapperProps<typeof CodeBlockType>;

/**
 * Long-code folding, ported from the rainzt.cn reference (the
 * expressive-code-collapsible plugin): blocks with more than 15 lines start
 * collapsed to 8 preview lines with a fade-out gradient and a pill toggle at
 * the bottom center; expanding returns the toggle to normal flow below the
 * block, collapsing again scrolls the block back into view when needed.
 *
 * The line count comes from the `children` string, so the collapsed state is
 * decided on the server render — no full-height flash before hydration. The
 * preview height is measured once on mount (real line-height + pre padding)
 * and written to a CSS variable, with a line-height-based CSS fallback.
 */

const LINE_THRESHOLD = 15;
const PREVIEW_LINES = 8;

function instantMotion(): boolean {
  if (typeof document === 'undefined') return true;
  return (
    document.documentElement.dataset.motion === 'off' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

export default function CodeBlockWrapper(props: Props): ReactNode {
  const text = typeof props.children === 'string' ? props.children : String(props.children ?? '');
  const lineCount = text.length === 0 ? 0 : text.replace(/\n+$/, '').split('\n').length;
  const foldable = lineCount > LINE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(foldable);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentId = useId();

  useEffect(() => {
    if (!foldable) return undefined;
    const el = wrapperRef.current;
    if (!el) return undefined;
    const measure = () => {
      const line = el.querySelector<HTMLElement>('.token-line');
      const pre = el.querySelector<HTMLElement>('pre');
      if (!line || !pre) return;
      const styles = getComputedStyle(line);
      const lineHeight = Number.parseFloat(styles.lineHeight) || line.offsetHeight || 21.6;
      const preStyles = getComputedStyle(pre);
      const padding =
        (Number.parseFloat(preStyles.paddingTop) || 0) + (Number.parseFloat(preStyles.paddingBottom) || 0);
      el.style.setProperty('--xr-fold-preview-height', `${Math.round(PREVIEW_LINES * lineHeight + padding)}px`);
    };
    measure();
    // Web fonts can change the metrics after the first paint.
    document.fonts?.ready.then(measure).catch(() => {});
    return undefined;
  }, [foldable]);

  if (!foldable) {
    return <CodeBlock {...props} />;
  }

  const expandText = translate({
    id: 'appearance.codeFold.expand',
    message: '展开',
    description: 'Button label to expand a collapsed long code block',
  });
  const collapseText = translate({
    id: 'appearance.codeFold.collapse',
    message: '收起',
    description: 'Button label to collapse a long code block again',
  });
  const expandedMsg = translate({
    id: 'appearance.codeFold.expanded',
    message: '代码块已展开',
    description: 'Screen-reader announcement after a code block is expanded',
  });
  const collapsedMsg = translate({
    id: 'appearance.codeFold.collapsed',
    message: '代码块已折叠',
    description: 'Screen-reader announcement after a code block is collapsed',
  });

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next && !instantMotion()) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      // Collapsing again: bring the block header back into view if it
      // scrolled above the viewport while expanded.
      if (rect && rect.top < 0) {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`xr-code-fold${collapsed ? ' xr-code-fold--collapsed' : ''}`}
      data-collapsed={collapsed || undefined}
    >
      <CodeBlock {...props} />
      <span className="xr-fold-status" role="status" aria-live="polite">
        {collapsed ? collapsedMsg : expandedMsg}
      </span>
      <button
        type="button"
        className="xr-fold-toggle"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={toggle}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6l-6-6z" />
        </svg>
        {collapsed ? expandText : collapseText}
      </button>
      <span id={contentId} hidden>
        {text}
      </span>
    </div>
  );
}
