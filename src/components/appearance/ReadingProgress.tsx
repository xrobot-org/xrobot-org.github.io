/**
 * Reading progress indicator, rendered on every page by the Root wrapper.
 *
 * - Top bar (.xr-progress-track / .xr-progress-bar): always rendered; styles
 *   come from the CSS layer (shared class-name contract).
 * - Circle (.xr-progress-circle): only rendered under /docs.
 *
 * Scroll handling is rAF-throttled; DOM writes go to the elements found by
 * class name so the markup below must stay exactly in sync with the CSS
 * contract. SSR-safe: no window/document access during render.
 */
import React from 'react';
import { useLocation } from '@docusaurus/router';
import { translate } from '@docusaurus/Translate';

const ariaTemplate = translate({
  id: 'appearance.scrollProgress.aria',
  message: '页面滚动进度 {n}%',
  description: 'The aria-label of the reading progress circle; {n} is the percentage',
});

function updateProgress(): void {
  const root = document.documentElement;
  const scrollTop = window.scrollY || root.scrollTop || 0;
  const max = root.scrollHeight - window.innerHeight;
  const progress = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;
  const percent = Math.round(progress * 100);

  const bar = document.querySelector<HTMLElement>('.xr-progress-bar');
  if (bar) {
    bar.style.transform = `scaleX(${progress})`;
  }
  const circleValue = document.querySelector<SVGCircleElement>('.xr-progress-circle__value');
  if (circleValue) {
    circleValue.style.strokeDashoffset = String(100 - progress * 100);
  }
  const label = document.querySelector<HTMLElement>('.xr-progress-circle__label');
  if (label) {
    label.textContent = `${percent}%`;
  }
  const circle = document.querySelector<HTMLElement>('.xr-progress-circle');
  if (circle) {
    circle.setAttribute('aria-label', ariaTemplate.replace('{n}', String(percent)));
  }
}

export default function ReadingProgress(): JSX.Element {
  const { pathname } = useLocation();
  const showCircle = pathname.startsWith('/docs');

  React.useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (!raf) {
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          updateProgress();
        });
      }
    };
    updateProgress();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [pathname, showCircle]);

  return (
    <>
      <div className="xr-progress-track" aria-hidden="true">
        <div className="xr-progress-bar" />
      </div>
      {showCircle ? (
        <div className="xr-progress-circle" role="img" aria-label={ariaTemplate.replace('{n}', '0')}>
          <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
            <circle className="xr-progress-circle__track" cx="24" cy="24" r="19" pathLength="100" />
            <circle className="xr-progress-circle__value" cx="24" cy="24" r="19" pathLength="100" />
          </svg>
          <span className="xr-progress-circle__label">0%</span>
        </div>
      ) : null}
    </>
  );
}
