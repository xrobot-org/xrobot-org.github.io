import ComponentTypes from '@theme-original/NavbarItem/ComponentTypes';
import BookmarkButton from '@site/src/components/bookmarks/BookmarkButton';
import BookmarksNavLink from '@site/src/components/bookmarks/BookmarksNavLink';

/**
 * Custom navbar item types used by docusaurus.config.js:
 *   type: 'custom-bookmark'         → article star toggle
 *   type: 'custom-bookmarks-link'   → locale-aware link to /bookmarks
 */
export default {
  ...ComponentTypes,
  'custom-bookmark': BookmarkButton,
  'custom-bookmarks-link': BookmarksNavLink,
};
