/**
 * XRobot Style components for the docs site: React ports of proj/components/bundle.js.
 * Styles are global (src/css/xrstyle-components.css) so widgets and MDX pages share them.
 */
import React from 'react';
import Link from '@docusaurus/Link';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Renders `code` spans written with backticks inside a translated string. */
export function inlineCode(text: string): React.ReactNode[] {
  return text
    .split(/(`[^`]+`)/g)
    .map((part, i) => (part.length > 1 && part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
}

/* ---- Logo: the licensed wordmark (paths unchanged) or the mark, drawn in currentColor ---- */
const FRAME =
  'm243.119 157-.001 12.887 12.799 12.859h21.387v-1.396l5.5-5.526h34.391l5.5 5.526v1.396h21.387l12.798-12.859v-12.888h4.5v10.16h20.705l10.81 10.856 60.64.001 14.826 14.895v23.81h1.388l5.501 5.52v24.186l-5.5 5.527h-1.391v17.406l-14.815 14.89H378.13l-11.283-11.341H315.15v2.17l-3.58 5.818h-22.61l-3.58-5.818-.001-2.17h-52.522l-11.282 11.341h-75.413l-14.816-14.89-.001-17.407h-1.095l-5.5-5.526v-24.185l5.501-5.521h1.387v-23.81l14.826-14.895 60.64-.001 10.81-10.855h20.704V157h4.5Zm137.096 14.659H361.38v.087l-15.428 15.5h-23.257v1.396l-5.5 5.526h-34.39l-5.5-5.526-.001-1.396h-23.257l-15.428-15.5-.001-.087h-18.834l-10.81 10.857-60.64-.001-12.196 12.253v21.952h1.391l5.502 5.522v24.185l-5.5 5.527h-1.686V267.5l12.186 12.248h71.674l11.282-11.339h54.392l.001-.04 3.58-5.818h22.61l3.58 5.819v.038l53.568.001L380 279.75h71.672l12.187-12.249v-15.548h-1.39l-5.5-5.526v-24.185l5.502-5.521h1.39v-21.953l-12.197-12.253-60.638.001-10.811-10.857Zm-71.16 95.393h-17.581l-1.595 2.593v4.159l1.595 2.593h17.581l1.595-2.591v-4.163l-1.595-2.591Zm-158.223-1.996 5.517 5.542h60.176v2.25h-61.111l-6.176-6.204 1.594-1.588Zm301.962 0 1.595 1.588-6.176 6.204H387.1v-2.25h60.175l5.518-5.542ZM135.66 221.22h-3.541l-2.869 2.88v20.47l2.87 2.883h3.54l2.87-2.884V224.1l-2.87-2.88Zm332.22 0h-3.541l-2.87 2.88v20.469l2.87 2.884h3.54l2.871-2.884v-20.468l-2.87-2.881Zm-332.865 7.873v10.345h-2.25v-10.345h2.25Zm332.22 0v10.345h-2.25v-10.345h2.25ZM232.71 184.92v2.25h-11.248l-7.213 7.248h-57.39v-2.25h56.453l7.216-7.248h12.182Zm146.76 0 7.214 7.248h56.455v2.25h-57.39l-7.215-7.248h-11.247v-2.25h12.183Zm-64.146-4.598h-30.651l-2.87 2.883v3.579l2.87 2.883h30.651l2.87-2.883v-3.579l-2.87-2.883Zm-5.095 3.548v2.25H289.63v-2.25h20.6Z';
const NAME =
  'M231.6 245 L223.3 252.5 L211 238.3 L198.7 252.4 L190.3 244.9 L203.5 229.7 L190.3 214.5 L198.7 207 L211 221.2 L223.3 207.1 L231.6 214.6 L218.4 229.8 L231.6 245 M273.1 247.4 L263.4 253 L252.8 234.8 L246.8 234.8 L246.8 252.1 L235.5 252.1 L235.5 215.2 L243 207.7 L272.3 207.7 L272.3 227.4 L265.4 234.2 L273.1 247.4 M246.8 216.2 L246.8 226.3 L261 226.3 L261 216.2 L246.8 216.2 M299.3 252.1 L277.7 252.1 L277.7 233.4 L285.2 225.9 L306.7 225.9 L306.7 244.7 L299.3 252.1 M289 234.4 L289 243.6 L295.5 243.6 L295.5 234.4 L289 234.4 M333.4 252.1 L311.9 252.1 L311.9 207.7 L323.2 207.7 L323.2 225.9 L340.9 225.9 L340.9 244.7 L333.4 252.1 M323.2 234.4 L323.2 243.6 L329.7 243.6 L329.7 234.4 L323.2 234.4 M367.3 252.1 L345.8 252.1 L345.8 233.4 L353.2 225.9 L374.7 225.9 L374.7 244.7 L367.3 252.1 M357 234.4 L357 243.6 L363.5 243.6 L363.5 234.4 L357 234.4 M385.1 234.4 L379.6 234.4 L379.6 225.9 L385.1 225.9 L385.1 215.3 L396.4 215.3 L396.4 225.9 L406.8 225.9 L406.8 234.4 L396.4 234.4 L396.4 243.6 L405.9 243.6 L405.9 249 L406.9 249.8 L406.9 252.1 L385.1 252.1 L385.1 234.4 Z';
const MARK =
  'M14.00,14.00 L50.00,14.00 L60.00,24.00 L60.00,50.00 L50.00,60.00 L14.00,60.00 L4.00,50.00 L4.00,24.00ZM17.51,20.00 L46.49,20.00 L54.00,27.51 L54.00,46.49 L46.49,54.00 L17.51,54.00 L10.00,46.49 L10.00,27.51ZM18.00,4.00 L24.00,4.00 L24.00,14.01 L18.00,14.01ZM40.00,4.00 L46.00,4.00 L46.00,14.01 L40.00,14.01Z';
const MARKX = 'M24.12,24.88 L44.12,44.88 L39.88,49.12 L19.88,29.12ZM19.88,44.88 L39.88,24.88 L44.12,29.12 L24.12,49.12Z';

export function Logo({
  variant = 'wordmark',
  height,
  title = 'XRobot',
  className,
}: {
  variant?: 'wordmark' | 'mark';
  height?: number;
  title?: string;
  className?: string;
}): JSX.Element {
  const h = height ?? (variant === 'mark' ? 32 : 28);
  if (variant === 'mark') {
    return (
      <svg role="img" aria-label={title} className={cx('xr-logo', className)} viewBox="0 0 64 64" width={h} height={h} fill="currentColor">
        <path fillRule="evenodd" d={MARK} />
        <path d={MARKX} />
      </svg>
    );
  }
  return (
    <svg
      role="img"
      aria-label={title}
      className={cx('xr-logo', className)}
      viewBox="125 157 350 127"
      width={Math.round((h * 350) / 127)}
      height={h}
      fill="currentColor"
    >
      <path d={FRAME} />
      <path d={NAME} />
    </svg>
  );
}

/* ---- Button: primary (one per view) | secondary | ghost. href renders a link. ---- */
type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost';
  href?: string;
  className?: string;
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent) => void;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>;

export function Button({ variant = 'secondary', href, className, children, onClick, ...rest }: ButtonProps): JSX.Element {
  const cls = cx('xr-btn', `xr-btn-${variant}`, className);
  if (href) {
    return (
      <Link className={cls} to={href} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} {...rest}>
      {children}
    </button>
  );
}

/* ---- Tag: a short mono token such as in_isr, STM32, same-or-dev ---- */
export function Tag({ variant = 'outline', children, className }: { variant?: 'outline' | 'solid'; children: React.ReactNode; className?: string }): JSX.Element {
  return <span className={cx('xr-tag', variant === 'solid' && 'xr-tag-solid', className)}>{children}</span>;
}

/* ---- PathLabel: an explicit location above a title: LIBXR / UART / IN_ISR ---- */
export function PathLabel({ path, className }: { path: string | string[]; className?: string }): JSX.Element {
  const parts = Array.isArray(path) ? path : path.split('/');
  const nodes: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    if (i) {
      nodes.push(
        <span key={`s${i}`} className="xr-path-sep" aria-hidden="true">
          /
        </span>,
      );
    }
    nodes.push(<span key={`p${i}`}>{p.trim()}</span>);
  });
  return <span className={cx('xr-path', className)}>{nodes}</span>;
}

/* ---- Card: one bounded thing (a Module, a guide, a route), chamfered top-right ---- */
export function Card({
  label,
  title,
  href,
  children,
  footer,
  className,
  headingLevel = 3,
}: {
  label?: string | string[];
  title?: React.ReactNode;
  href?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headingLevel?: 2 | 3 | 4;
}): JSX.Element {
  const H = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <article className={cx('xr-card', className)}>
      {label ? <PathLabel path={label} /> : null}
      {title ? <H className="xr-card-title">{href ? <Link to={href}>{title}</Link> : title}</H> : null}
      {children ? <div className="xr-card-body">{children}</div> : null}
      {footer ? <div className="xr-card-footer">{footer}</div> : null}
    </article>
  );
}

/* ---- CodeBlock: C/C++ with the built-in highlighter (zero dependencies) ---- */
const KEYWORDS = new Set(
  (
    'alignas alignof auto bool break case catch char class const constexpr consteval constinit continue ' +
    'decltype default delete do double else enum explicit extern false float for friend goto if inline int ' +
    'long mutable namespace new noexcept nullptr operator private protected public register return short ' +
    'signed sizeof static static_assert static_cast struct switch template this throw true try typedef ' +
    'typename union unsigned using virtual void volatile while uint8_t uint16_t uint32_t uint64_t int8_t ' +
    'int16_t int32_t int64_t size_t'
  ).split(' '),
);
const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)|(\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?)(?:[uUlLfF]*)\b)|([A-Za-z_][A-Za-z0-9_]*)/gm;

export function highlightCpp(code: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const re = new RegExp(TOKEN.source, TOKEN.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) out.push(code.slice(last, m.index));
    let cls: string | null = null;
    if (m[1]) cls = 'com';
    else if (m[2]) cls = 'str';
    else if (m[3]) cls = 'pp';
    else if (m[4]) cls = 'num';
    else if (m[5]) {
      if (KEYWORDS.has(m[5])) cls = 'kw';
      else if (/^[A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*$/.test(m[5]) && !/^\s*\(/.test(code.slice(m.index + m[0].length))) cls = 'type';
    }
    out.push(
      cls ? (
        <span key={key++} className={`xr-tk-${cls}`}>
          {m[0]}
        </span>
      ) : (
        m[0]
      ),
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({
  code,
  title,
  aside,
  lang = 'cpp',
  className,
}: {
  code: string;
  title?: React.ReactNode;
  aside?: React.ReactNode;
  lang?: 'cpp' | 'text';
  className?: string;
}): JSX.Element {
  const text = code.replace(/\n$/, '');
  return (
    <figure className={cx('xr-code', className)}>
      {title || aside ? (
        <figcaption className="xr-code-title">
          <span>{title}</span>
          {aside ? <span>{aside}</span> : null}
        </figcaption>
      ) : null}
      <pre className="xr-code-pre">
        <code>{lang === 'text' ? text : highlightCpp(text)}</code>
      </pre>
    </figure>
  );
}
