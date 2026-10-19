import React from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {bookmarksHref} from '@site/src/features/bookmarks/docContext';
import {useBookmarkStrings} from '@site/src/features/bookmarks/strings';

/**
 * Locale-aware navbar link to the bookmarks page, registered as the custom
 * NavbarItem type `custom-bookmarks-link`. Renders a mobile-menu `<li>` when
 * Docusaurus asks for the mobile variant.
 */
type NavItemProps = {
  mobile?: boolean;
  onClick?: () => void;
};

export default function BookmarksNavLink({
  mobile = false,
  onClick,
}: NavItemProps): React.JSX.Element {
  const {pathname} = useLocation();
  const t = useBookmarkStrings();
  const href = bookmarksHref(pathname);
  const active = pathname === href;

  if (mobile) {
    return (
      <li className="menu__list-item">
        <Link
          className={`menu__link ${active ? 'menu__link--active' : ''}`}
          to={href}
          aria-current={active ? 'page' : undefined}
          onClick={onClick}>
          {t.navBookmarks}
        </Link>
      </li>
    );
  }

  return (
    <Link
      className={`navbar__item navbar__link ${active ? 'navbar__link--active' : ''}`}
      to={href}
      aria-current={active ? 'page' : undefined}>
      {t.navBookmarks}
    </Link>
  );
}
