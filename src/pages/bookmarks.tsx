import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {translate} from '@docusaurus/Translate';
import {PathLabel} from '@site/src/components/xr';
import {isEnglishPath, markRestore} from '@site/src/features/bookmarks/readingKeys';
import {
  BOOKMARKS_EVENT,
  BOOKMARKS_KEY,
  exportBookmarks,
  importBookmarks,
  loadBookmarks,
  removeBookmark,
} from '@site/src/features/bookmarks/store';
import type {Bookmark} from '@site/src/features/bookmarks/types';
import styles from './bookmarks.module.css';

function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BookmarksPage(): JSX.Element {
  const {pathname} = useLocation();
  const inEnglishLocale = isEnglishPath(pathname);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revokeTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const sync = () => setBookmarks(loadBookmarks());

  useEffect(() => {
    sync();
    const onLocal = () => sync();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === BOOKMARKS_KEY) sync();
    };
    window.addEventListener(BOOKMARKS_EVENT, onLocal);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(BOOKMARKS_EVENT, onLocal);
      window.removeEventListener('storage', onStorage);
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
      for (const id of revokeTimersRef.current) clearTimeout(id);
      revokeTimersRef.current = [];
    };
  }, []);

  const flashStatus = (text: string) => {
    setStatusMessage(text);
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    messageTimerRef.current = setTimeout(() => setStatusMessage(''), 8000);
  };

  const onRemove = (bookmark: Bookmark) => {
    removeBookmark(bookmark.path);
    sync();
    flashStatus(
      translate(
        {id: 'bookmarks.removed', message: '已移除「{title}」。'},
        {title: bookmark.title},
      ),
    );
  };

  const onExport = () => {
    try {
      const blob = new Blob([exportBookmarks()], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `xrobot-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      // Defer revocation so Safari/Firefox finish initiating the download cleanly.
      const timer = setTimeout(() => URL.revokeObjectURL(url), 1000);
      revokeTimersRef.current.push(timer);
      flashStatus(
        translate({
          id: 'bookmarks.exportStarted',
          message: '已导出本地书签备份文件。',
        }),
      );
    } catch {
      flashStatus(
        translate({
          id: 'bookmarks.exportFailed',
          message: '导出失败：当前浏览器不允许下载文件。',
        }),
      );
    }
  };

  const onImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = importBookmarks(await file.text());
      if (!result) {
        flashStatus(
          translate({
            id: 'bookmarks.importFailedFormat',
            message: '导入失败：无效的书签备份文件格式。',
          }),
        );
        return;
      }
      sync();
      if (result.skipped > 0) {
        flashStatus(
          translate(
            {
              id: 'bookmarks.importDoneWithSkipped',
              message: '已导入：合入 {merged} 条，跳过 {skipped} 条无效记录。',
            },
            {merged: result.bookmarks, skipped: result.skipped},
          ),
        );
      } else {
        flashStatus(
          translate(
            {
              id: 'bookmarks.importDone',
              message: '已导入：合入 {merged} 条书签（同路径保留更新时间较新的一方）。',
            },
            {merged: result.bookmarks},
          ),
        );
      }
    } catch {
      flashStatus(
        translate({
          id: 'bookmarks.importFailedRead',
          message: '导入失败：无法读取所选文件。',
        }),
      );
    }
  };

  return (
    <Layout
      title={translate({id: 'bookmarks.title', message: '书签'})}
      description={translate({
        id: 'bookmarks.description',
        message: '本地收藏的文档与阅读进度，支持 JSON 导出与导入备份。',
      })}>
      <main className={styles.page}>
        <div className={styles.inner}>
          <header className={styles.header}>
            <PathLabel path="XROBOT / BOOKMARKS" />
            <h1 className={styles.title}>
              {translate({id: 'bookmarks.title', message: '书签'})}
            </h1>
            <p className={styles.lead}>
              {translate({
                id: 'bookmarks.lead',
                message: '本地保存的文档与阅读进度，数据仅存储在当前浏览器。',
              })}
            </p>
          </header>

          {bookmarks.length === 0 ? (
            <p className={styles.empty}>
              {translate({
                id: 'bookmarks.empty',
                message:
                  '暂无书签。浏览文档时点击右下角书签按钮即可保存当前阅读位置，此后会自动跟踪进度。',
              })}
            </p>
          ) : (
            <ul className={styles.list}>
              {bookmarks.map((item) => {
                const updated = formatTime(item.updatedAt);
                const sameLocale = isEnglishPath(item.path) === inEnglishLocale;
                const rowBody = (
                  <>
                    <div className={styles.rowHeader}>
                      <span className={styles.rowTitle}>{item.title}</span>
                      <span className={styles.rowPercent}>{item.scrollPercent}%</span>
                    </div>
                    {item.anchorText ? (
                      <p className={styles.rowAnchor}>{item.anchorText}</p>
                    ) : null}
                    <div className={styles.rowMeta}>
                      <span className={styles.rowPath}>{item.path}</span>
                      {updated ? (
                        <span className={styles.rowTime}>
                          {translate(
                            {id: 'bookmarks.updatedAt', message: '更新于 {time}'},
                            {time: updated},
                          )}
                        </span>
                      ) : null}
                    </div>
                  </>
                );
                return (
                  <li key={item.path} className={styles.row}>
                    <div className={styles.rowMain}>
                      {sameLocale ? (
                        <Link
                          className={styles.rowLink}
                          to={item.path}
                          onClick={() =>
                            markRestore(item.path, item.scrollPercent, item.anchorText)
                          }>
                          {rowBody}
                        </Link>
                      ) : (
                        <a
                          className={styles.rowLink}
                          href={item.path}
                          onClick={() =>
                            markRestore(item.path, item.scrollPercent, item.anchorText)
                          }>
                          {rowBody}
                        </a>
                      )}
                      <button
                        type="button"
                        className={`xr-btn xr-btn-secondary ${styles.removeBtn}`}
                        aria-label={translate(
                          {id: 'bookmarks.removeAria', message: '移除书签：{title}'},
                          {title: item.title},
                        )}
                        onClick={() => onRemove(item)}>
                        {translate({id: 'bookmarks.remove', message: '移除'})}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <section className={styles.backup} aria-label={translate({id: 'bookmarks.backupSection', message: '备份与迁移'})}>
            <span className={styles.backupHint}>
              {translate(
                {
                  id: 'bookmarks.backupCount',
                  message: '当前共 {count} 条本地书签（换设备或清理站点数据前可导出备份）。',
                },
                {count: bookmarks.length},
              )}
            </span>
            <div className={styles.backupActions}>
              <button type="button" className="xr-btn xr-btn-secondary" onClick={onExport}>
                {translate({id: 'bookmarks.export', message: '导出 JSON'})}
              </button>
              <button
                type="button"
                className="xr-btn xr-btn-secondary"
                onClick={() => fileInputRef.current?.click()}>
                {translate({id: 'bookmarks.import', message: '导入 JSON'})}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className={styles.fileInput}
                onChange={onImportFile}
              />
            </div>
            {statusMessage ? (
              <p className={styles.status} role="status">
                {statusMessage}
              </p>
            ) : null}
          </section>
        </div>
      </main>
    </Layout>
  );
}
