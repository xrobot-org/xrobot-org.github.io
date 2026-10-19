import React from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import TOCItems from '@theme/TOCItems';
import ArticleNotes from '@site/src/components/bookmarks/ArticleNotes';

/**
 * Desktop right-hand TOC, with the current article's notes appended inside the
 * same sticky column (we replace the stock `DocItem/TOC/Desktop` component).
 */
export default function DocItemTOCDesktop(): React.JSX.Element {
  const {toc, frontMatter} = useDoc();

  return (
    <div className="xr-doc-toc theme-doc-toc-desktop thin-scrollbar">
      {toc.length > 0 ? (
        <TOCItems
          toc={toc}
          minHeadingLevel={frontMatter.toc_min_heading_level}
          maxHeadingLevel={frontMatter.toc_max_heading_level}
          linkClassName="table-of-contents__link toc-highlight"
          linkActiveClassName="table-of-contents__link--active"
        />
      ) : null}
      <ArticleNotes />
    </div>
  );
}
