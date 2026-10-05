/**
 * ShowcaseSection: one capability on the home page. Copy (label, title, two or three sentences,
 * tags, documentation links) next to a Showcase widget; the columns alternate or stack, and
 * collapse to one column on narrow screens.
 */
import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { translate } from '@docusaurus/Translate';
import { PathLabel, Tag, inlineCode } from '@site/src/components/xr';
import Showcase, { type ShowcaseHeight } from './Showcase';
import styles from './showcase.module.css';

export type DocLink = { href: string; label: string };

export type ShowcaseSectionProps = {
  id: string;
  /** PathLabel above the title, e.g. "LIBXR / UART / READPORT". */
  path: string;
  title: string;
  /** Paragraphs; backticks mark inline code. */
  body: string[];
  tags?: string[];
  docs: DocLink[];
  layout?: 'left' | 'right' | 'stack';
  widget: { name: string; height: ShowcaseHeight; label?: string };
  /** Shown until the widget loads, and in its place while it does not exist yet. */
  fallback?: React.ReactNode;
};

export default function ShowcaseSection({
  id,
  path,
  title,
  body,
  tags,
  docs,
  layout = 'left',
  widget,
  fallback,
}: ShowcaseSectionProps): JSX.Element {
  const headingId = `${id}-title`;
  return (
    <section id={id} className={styles.section} aria-labelledby={headingId}>
      <div className={[styles.inner, layout === 'right' && styles.right, layout === 'stack' && styles.stack].filter(Boolean).join(' ')}>
        <div className={styles.copy}>
          <PathLabel path={path} />
          <h2 id={headingId} className={styles.title}>
            {title}
          </h2>
          <div className={styles.body}>
            {body.map((paragraph, i) => (
              <p key={i}>{inlineCode(paragraph)}</p>
            ))}
          </div>
          {tags && tags.length ? (
            <div className={styles.tags}>
              {tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          ) : null}
          <nav className={styles.docs} aria-label={translate({ id: 'showcase.section.docsAria', message: '相关文档' }) + ' · ' + title}>
            <span className={`xr-path ${styles.docsLabel}`}>{translate({ id: 'showcase.section.readDocs', message: '阅读文档' })}</span>
            <ul className={styles.docsList}>
              {docs.map((doc) => (
                <li key={doc.href}>
                  <Link className="xr-link" to={doc.href}>
                    {doc.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className={styles.stageColumn}>
          <Showcase name={widget.name} height={widget.height} label={widget.label ?? title} fallback={fallback} />
        </div>
      </div>
    </section>
  );
}

/**
 * StaticFigure: a single-colour SVG from static/showcase/img drawn in `ink` through a CSS mask,
 * so it follows the light and dark themes. Optional caption and extra content (e.g. a command list).
 */
export function StaticFigure({
  src,
  alt,
  ratio,
  caption,
  children,
}: {
  src: string;
  alt: string;
  /** width / height of the SVG viewBox. */
  ratio: number;
  caption?: string;
  children?: React.ReactNode;
}): JSX.Element {
  const url = useBaseUrl(src);
  return (
    <div className={styles.figure}>
      <div
        role="img"
        aria-label={alt}
        className={styles.figureArt}
        style={{ '--figure-src': `url("${url}")`, aspectRatio: String(ratio) } as React.CSSProperties}
      />
      {children ? <div className={styles.figureExtra}>{children}</div> : null}
      {caption ? <p className={styles.figureCaption}>{inlineCode(caption)}</p> : null}
    </div>
  );
}
