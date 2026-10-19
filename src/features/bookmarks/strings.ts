import {useLocation} from '@docusaurus/router';
import {isEnglishPath} from './docContext';

/**
 * UI copy for the bookmark/note feature. The site has a Chinese default locale
 * and an English one under `/en`; route-based selection keeps every component
 * (including the navbar items) consistent without extra i18n wiring.
 */

export interface BookmarkStrings {
  navBookmarks: string;
  notesTitle: string;
  notesAll: string;
  notesAllTitle: string;
  notesEmptyTitle: string;
  notesEmptyHint: string;
  noteJumpTitle: string;
  noteRemove: string;

  captureButton: string;
  captureTitle: string;
  captureSaved: string;
  captureRejected: string;

  bookmarkAdd: string;
  bookmarkAdded: string;
  bookmarkAddTitle: string;
  bookmarkAddedTitle: (percent: number) => string;

  pageTitle: string;
  pageDescription: string;
  pageIntro: string;
  pageEmpty: string;
  unstar: string;
  unstarAria: (title: string) => string;
  unstarTitle: string;
  unstarDone: (title: string) => string;
  readAt: (time: string) => string;
  backupHint: (bookmarks: number, notes: number) => string;
  exportBackup: string;
  importBackup: string;
  exportStarted: string;
  exportFailed: string;
  importFailedFormat: string;
  importFailedRead: string;
  importDone: (bookmarks: number, notes: number) => string;
}

const zh: BookmarkStrings = {
  navBookmarks: '书签',
  notesTitle: '本页便签',
  notesAll: '全部 ↗',
  notesAllTitle: '去书签页看全部收藏与便签',
  notesEmptyTitle: '本页还没有便签',
  notesEmptyHint:
    '划选正文里的一段文字，点弹出的\n「✎ 存为便签」，回头在这里一键跳回原处。',
  noteJumpTitle: '点击定位到原文原处',
  noteRemove: '删除这条便签',

  captureButton: '✎ 存为便签',
  captureTitle: '把选中的文字存成便签，回头从书签页点它跳回原处',
  captureSaved: '✓ 已存，书签页见',
  captureRejected: '这段存不进（太短啦）',

  bookmarkAdd: '收藏',
  bookmarkAdded: '已收藏',
  bookmarkAddTitle: '收藏本页当前位置，回头从导航「书签」进来续读',
  bookmarkAddedTitle: (percent) => `已收藏在 ${percent}%（点此取消，想换位置就删了重收）`,

  pageTitle: '书签',
  pageDescription: '收藏的文章与摘录的便签都在这里——续读、跳回原文原处、导出导入备份',
  pageIntro: '收藏的文章与摘录的便签都在这里。',
  pageEmpty:
    '还没有书签，也没有便签。读文章时点导航栏的「☆ 收藏」收下整篇；在正文里划选一段文字，点弹出的「✎ 存为便签」，回头从这里点它就能跳回原处。换设备前导出一份备份。',
  unstar: '取消收藏',
  unstarAria: (title) => `取消收藏「${title}」`,
  unstarTitle: '取消收藏（这篇的便签会保留）',
  unstarDone: (title) => `已取消「${title}」的收藏。`,
  readAt: (time) => `读到 ${time}`,
  backupHint: (bookmarks, notes) =>
    `书签与便签（${bookmarks} + ${notes}）只存在当前浏览器，换设备或清缓存会丢，走之前导出一份，到了新地方再导入接上。`,
  exportBackup: '导出备份 ↓',
  importBackup: '导入备份 ↑',
  exportStarted: '备份文件已开始下载，收好它；到新设备回到这里导入就能接上。',
  exportFailed: '导出失败：当前浏览器不允许下载文件。QAQ',
  importFailedFormat: '导入失败：这不是书签备份文件。',
  importFailedRead: '导入失败：文件读不出来。',
  importDone: (bookmarks, notes) =>
    `已导入：合并 ${bookmarks} 条书签、${notes} 条便签（同一条两边都动过时，保留更新时间晚的一方）。`,
};

const en: BookmarkStrings = {
  navBookmarks: 'Bookmarks',
  notesTitle: 'Notes on this page',
  notesAll: 'All ↗',
  notesAllTitle: 'Open Bookmarks to see all saved articles and notes',
  notesEmptyTitle: 'No notes on this page yet',
  notesEmptyHint:
    'Select a passage in the article, choose “✎ Save as note”, then jump back to it here.',
  noteJumpTitle: 'Jump back to the original passage',
  noteRemove: 'Delete this note',

  captureButton: '✎ Save as note',
  captureTitle:
    'Save the selected text as a note; open it from Bookmarks to jump back to the spot',
  captureSaved: '✓ Saved — see Bookmarks',
  captureRejected: 'Too short to save',

  bookmarkAdd: 'Bookmark',
  bookmarkAdded: 'Bookmarked',
  bookmarkAddTitle: 'Bookmark this position; resume from Bookmarks later',
  bookmarkAddedTitle: (percent) =>
    `Bookmarked at ${percent}% (click to remove; re-add to change position)`,

  pageTitle: 'Bookmarks',
  pageDescription:
    'Your saved articles and highlighted notes live here — resume reading, jump back to the exact passage, export/import a backup',
  pageIntro: 'Your saved articles and highlighted notes live here.',
  pageEmpty:
    'No bookmarks or notes yet. While reading, click “☆ Bookmark” in the navbar to save the whole article, or select a passage and choose “✎ Save as note”; open it here later to jump back. Export a backup before switching devices.',
  unstar: 'Remove',
  unstarAria: (title) => `Remove bookmark “${title}”`,
  unstarTitle: 'Remove bookmark (its notes are kept)',
  unstarDone: (title) => `Removed “${title}” from bookmarks.`,
  readAt: (time) => `read at ${time}`,
  backupHint: (bookmarks, notes) =>
    `${bookmarks} bookmark(s) and ${notes} note(s) live only in this browser. Export a backup before switching devices or clearing site data, then import it on the new one.`,
  exportBackup: 'Export backup ↓',
  importBackup: 'Import backup ↑',
  exportStarted: 'The backup download has started. Keep it safe and import it on the new device.',
  exportFailed: 'Export failed: this browser does not allow downloads. QAQ',
  importFailedFormat: 'Import failed: this is not a bookmark backup file.',
  importFailedRead: 'Import failed: the file could not be read.',
  importDone: (bookmarks, notes) =>
    `Imported: merged ${bookmarks} bookmark(s) and ${notes} note(s) (when both sides changed an item, the newer update wins).`,
};

export function useBookmarkStrings(): BookmarkStrings {
  const {pathname} = useLocation();
  return isEnglishPath(pathname) ? en : zh;
}
