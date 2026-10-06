import React, {type ReactNode} from 'react';
import NavbarItem from '@theme-original/NavbarItem';
import type NavbarItemType from '@theme/NavbarItem';
import type {WrapperProps} from '@docusaurus/types';
import {useNavbarMobileSidebar} from '@docusaurus/theme-common/internal';
import {translate} from '@docusaurus/Translate';
import {APPEARANCE_PANEL_TOGGLE} from '@site/src/components/appearance/AppearancePanelHost';
import styles from './index.module.css';

type Props = WrapperProps<typeof NavbarItemType>;

/**
 * Adds one custom navbar item type: `{type: 'custom-xr-appearance'}` renders
 * the palette button that toggles the AppearancePanel. Every other item is
 * passed through to the original NavbarItem untouched.
 *
 * The button only dispatches the toggle event; the panel itself is hosted at
 * the app root (AppearancePanelHost in Root) so it cannot be unmounted with
 * this item — the mobile sidebar unmounts its items when it closes.
 */
export default function NavbarItemWrapper(props: Props): ReactNode {
  const mobileSidebar = useNavbarMobileSidebar();

  if ((props.type as string) === 'custom-xr-appearance') {
    return (
      <button
        type="button"
        className={styles.toggle}
        aria-haspopup="dialog"
        aria-label={translate({
          id: 'appearance.panelToggle',
          message: '外观设置',
          description: 'The aria-label of the appearance settings (palette) navbar button',
        })}
        onClick={() => {
          if (mobileSidebar.shown) {
            mobileSidebar.toggle();
          }
          window.dispatchEvent(new CustomEvent(APPEARANCE_PANEL_TOGGLE));
        }}>
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18h1.7a2.3 2.3 0 0 0 0-4.6H12a1.6 1.6 0 0 1 0-3.2h6.1A2.9 2.9 0 0 0 21 10.3C21 6.3 16.97 3 12 3Z" />
          <circle cx="7.4" cy="10.6" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="11.4" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="16.2" cy="9.6" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </button>
    );
  }

  return <NavbarItem {...props} />;
}
