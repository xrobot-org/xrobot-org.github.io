import React from 'react';
import {useLocation} from '@docusaurus/router';
import {
  currentScrollPercent,
  getDocTitle,
  isDocPath,
} from '@site/src/features/bookmarks/docContext';
import {useBookmarkStrings} from '@site/src/features/bookmarks/strings';
import {useBookmarkState} from '@site/src/features/bookmarks/useBookmarks';
import styles from './bookmarks.module.css';

/**
 * Navbar bookmark toggle, registered as the custom NavbarItem type
 * `custom-bookmark`. On desktop it is a compact pill in the navbar; in the
 * mobile menu Docusaurus expects the item to render its own `<li>` wrapper.
 */
type NavItemProps = {
  mobile?: boolean;
  onClick?: () => void;
};

export default function BookmarkButton({mobile = false, onClick}: NavItemProps): React.JSX.Element | null {
  const {pathname} = useLocation();
  const t = useBookmarkStrings();
  const {bookmark, toggle} = useBookmarkState(pathname);

  if (!isDocPath(pathname)) return null;

  const active = bookmark !== null;
  const title = active
    ? t.bookmarkAddedTitle(Math.round(bookmark.scrollPercent))
    : t.bookmarkAddTitle;

  const onToggle = () => {
    toggle(getDocTitle(), currentScrollPercent());
    onClick?.();
  };

  const content = (
    <>
      <span className={styles.navMark} aria-hidden="true">
        {active ? '★' : '☆'}
      </span>
      <span>{active ? t.bookmarkAdded : t.bookmarkAdd}</span>
    </>
  );

  if (mobile) {
    return (
      <li className="menu__list-item">
        <button
          type="button"
          className={`menu__link ${styles.mobileNavToggle} ${
            active ? styles.mobileNavToggleActive : ''
          }`}
          aria-pressed={active}
          title={title}
          onClick={onToggle}>
          {content}
        </button>
      </li>
    );
  }

  return (
    <button
      type="button"
      className={`${styles.navToggle} ${active ? styles.navToggleActive : ''}`}
      aria-pressed={active}
      title={title}
      onClick={onToggle}>
      {content}
    </button>
  );
}
