import React from 'react';
import Layout from '@theme/Layout';
import {useLocation} from '@docusaurus/router';
import BookmarkList from '@site/src/components/bookmarks/BookmarkList';
import {PathLabel} from '@site/src/components/xr';
import {isEnglishPath} from '@site/src/features/bookmarks/docContext';
import {useBookmarkStrings} from '@site/src/features/bookmarks/strings';
import styles from './bookmarks.module.css';

/** `@theme/Layout` is typed as a bare component alias; mirror the props we use. */
const PageLayout = Layout as unknown as React.ComponentType<{
  title?: string;
  description?: string;
  children: React.ReactNode;
}>;

/**
 * `/bookmarks` (and `/en/bookmarks`): the local shelf of bookmarked articles
 * and captured notes. Everything is client-side localStorage.
 */
export default function BookmarksPage(): React.JSX.Element {
  const {pathname} = useLocation();
  const t = useBookmarkStrings();

  return (
    <PageLayout title={t.pageTitle} description={t.pageDescription}>
      <main className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <PathLabel path={isEnglishPath(pathname) ? 'XROBOT / BOOKMARKS' : 'XROBOT / 书签'} />
            <h1 className={styles.title}>{t.pageTitle}</h1>
            <p className={styles.lead}>{t.pageIntro}</p>
          </header>
          <BookmarkList />
        </div>
      </main>
    </PageLayout>
  );
}
