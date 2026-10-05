/**
 * Showcase: the shell around one capability widget (see README.md in this directory).
 *
 * - Every widget lives in ./<Name>/index.tsx and is found through require.context, so each one
 *   becomes its own lazy chunk and a name without a directory renders `fallback` instead.
 * - Nothing of the widget runs during SSR: the chunk is requested on the client when the frame
 *   comes within LOAD_MARGIN of the viewport, inside BrowserOnly + Suspense.
 * - `active` is true while the frame intersects the viewport and the page is visible; widgets
 *   stop their timers when it turns false (they are not unmounted).
 * - `reducedMotion` follows the page animation switch (see useReducedMotion below), not the OS setting.
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import styles from './showcase.module.css';

export type ShowcaseWidgetProps = {
  /** In the viewport and the page is visible; false: stop animations and timers. */
  active: boolean;
  /** Animation switch off: show an informative still frame, keep interaction. */
  reducedMotion: boolean;
};

type WidgetModule = { default: React.ComponentType<ShowcaseWidgetProps> };
type WidgetContext = {
  keys(): string[];
  (id: string): Promise<WidgetModule>;
};
declare const require: {
  context(directory: string, deep: boolean, filter: RegExp, mode: 'lazy'): WidgetContext;
};

// One lazy chunk per widget directory: ./<Name>/index.tsx (Name starts with a capital letter).
const widgetContext = require.context('./', true, /^\.\/[A-Z][A-Za-z0-9]*\/index\.tsx$/, 'lazy');

function widgetKey(name: string): string {
  return `./${name}/index.tsx`;
}

/** True when src/components/showcase/<name>/index.tsx exists at build time. */
export function hasShowcaseWidget(name: string): boolean {
  return widgetContext.keys().includes(widgetKey(name));
}

const lazyWidgets = new Map<string, React.LazyExoticComponent<React.ComponentType<ShowcaseWidgetProps>>>();

function lazyWidget(name: string) {
  let widget = lazyWidgets.get(name);
  if (!widget) {
    widget = React.lazy(() => widgetContext(widgetKey(name)));
    lazyWidgets.set(name, widget);
  }
  return widget;
}

/** Mount a little before the frame scrolls in, so the chunk is ready when it is seen. */
const LOAD_MARGIN = '400px 0px';

/**
 * Page-level animation switch (the "动画 开 / 关" control in the hero). Animation is on by default,
 * independent of the OS `prefers-reduced-motion` setting; the choice is stored in localStorage and
 * broadcast with the `xr-motion` event so every widget follows it at once.
 */
export const MOTION_KEY = 'xr-motion';
export function readMotionOff(): boolean {
  try {
    return window.localStorage.getItem(MOTION_KEY) === 'off';
  } catch {
    return false;
  }
}
export function setMotionOff(off: boolean): void {
  try {
    window.localStorage.setItem(MOTION_KEY, off ? 'off' : 'on');
  } catch {
    /* storage unavailable: the switch still works for this page view */
  }
  document.documentElement.dataset.motion = off ? 'off' : 'on';
  window.dispatchEvent(new CustomEvent('xr-motion', { detail: off }));
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const update = (e?: Event) => setReduced(e instanceof CustomEvent ? Boolean(e.detail) : readMotionOff());
    update();
    window.addEventListener('xr-motion', update);
    return () => window.removeEventListener('xr-motion', update);
  }, []);
  return reduced;
}

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/** near: within LOAD_MARGIN once (sticky); inView: intersecting the viewport now. */
function useViewport(ref: React.RefObject<HTMLElement>, enabled: boolean): { near: boolean; inView: boolean } {
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      setInView(true);
      return undefined;
    }
    const nearObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          nearObserver.disconnect();
        }
      },
      { rootMargin: LOAD_MARGIN },
    );
    const viewObserver = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      setInView(entry.isIntersecting);
    });
    nearObserver.observe(element);
    viewObserver.observe(element);
    return () => {
      nearObserver.disconnect();
      viewObserver.disconnect();
    };
  }, [ref, enabled]);
  return { near, inView };
}

class WidgetBoundary extends React.Component<
  { name: string; fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // The page stays usable; the fallback replaces the widget.
    console.warn(`[showcase] ${this.props.name} failed to load`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export type ShowcaseHeight = number | { desktop: number; mobile?: number };

export type ShowcaseProps = {
  /** Directory name under src/components/showcase. */
  name: string;
  /** Space reserved before the widget mounts, in px (desktop and, optionally, narrow screens). */
  height: ShowcaseHeight;
  /** Optional "read the docs" link under the widget, for use outside ShowcaseSection (MDX pages). */
  docHref?: string;
  docLabel?: string;
  /** Shown when the widget directory does not exist (yet) or the widget fails to load. */
  fallback?: React.ReactNode;
  /** Accessible name of the region. */
  label?: string;
  className?: string;
};

export default function Showcase({ name, height, docHref, docLabel, fallback, label, className }: ShowcaseProps): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);
  const available = hasShowcaseWidget(name);
  const { near, inView } = useViewport(frameRef, available);
  const pageVisible = usePageVisible();
  const reducedMotion = useReducedMotion();
  const desktop = typeof height === 'number' ? height : height.desktop;
  const mobile = typeof height === 'number' ? height : height.mobile ?? height.desktop;
  // While loading: an empty frame of the reserved height, so nothing moves when the widget appears.
  const loading = <div className={styles.placeholder} aria-hidden="true" />;
  const failed = fallback ?? loading;
  const active = inView && pageVisible;

  return (
    <figure
      className={[styles.frame, className].filter(Boolean).join(' ')}
      aria-label={label}
      data-showcase={name}
      data-active={available ? String(active) : undefined}
    >
      <div
        ref={frameRef}
        className={styles.stage}
        style={
          available
            ? ({ '--showcase-height': `${desktop}px`, '--showcase-height-mobile': `${mobile}px` } as React.CSSProperties)
            : undefined
        }
      >
        {!available ? (
          failed
        ) : near ? (
          <BrowserOnly fallback={loading}>
            {() => {
              const Widget = lazyWidget(name);
              return (
                <WidgetBoundary name={name} fallback={failed}>
                  <Suspense fallback={loading}>
                    <Widget active={active} reducedMotion={reducedMotion} />
                  </Suspense>
                </WidgetBoundary>
              );
            }}
          </BrowserOnly>
        ) : (
          loading
        )}
      </div>
      {docHref ? (
        <figcaption className={styles.caption}>
          <Link className="xr-link" to={docHref}>
            {docLabel ?? translate({ id: 'showcase.shell.readDocs', message: '阅读文档' })}
          </Link>
        </figcaption>
      ) : null}
    </figure>
  );
}
