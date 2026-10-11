import React, {type ReactNode} from 'react';
import ColorModeToggle from '@theme-original/ColorModeToggle';
import type ColorModeToggleType from '@theme/ColorModeToggle';
import type {WrapperProps} from '@docusaurus/types';
import {useColorMode} from '@docusaurus/theme-common';
import {translate} from '@docusaurus/Translate';
import {animateColorModeSwitch} from '@site/src/utils/themeTransition';
import styles from './index.module.css';

type Props = WrapperProps<typeof ColorModeToggleType>;

// The original toggle is kept imported as a fallback: rendering
// <ColorModeToggle {...props} /> instead of the JSX below restores the
// stock Docusaurus button.

export default function ColorModeToggleWrapper(_props: Props): ReactNode {
  const {colorMode, setColorMode} = useColorMode();
  const isDark = colorMode === 'dark';

  const toggle = () => {
    const next = isDark ? 'light' : 'dark';
    animateColorModeSwitch(() => setColorMode(next));
  };

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={translate({
        id: 'appearance.colorModeToggle',
        message: '切换深浅色模式',
        description: 'The aria-label of the light/dark mode toggle button',
      })}>
      <span className={`${styles.icon} ${styles.iconSun}`} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7" />
        </svg>
      </span>
      <span className={`${styles.icon} ${styles.iconMoon}`} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M20 13.2A8.2 8.2 0 0 1 10.8 4a8.2 8.2 0 1 0 9.2 9.2Z" />
        </svg>
      </span>
    </button>
  );
}
