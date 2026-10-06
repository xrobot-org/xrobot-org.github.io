/**
 * QQ group introduction page (/qq), following the layout of
 * xiaoshuaijie.online/qq/: penguin icon + title, QR card with group name /
 * number / copy button, one-click join button, then the intro copy and the
 * organization's repository list. Styling stays on the XRobot ink tokens.
 */
import React, { useCallback, useState } from 'react';
import Layout from '@theme/Layout';
import { translate } from '@docusaurus/Translate';
import { copyTextToClipboard } from '@site/src/utils/clipboard';
import styles from './qq.module.css';

const QQ_ICON =
  'M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673c.54.065 2.103-2.472 2.103-2.472c0 1.469.756 3.387 2.394 4.771c-.612.188-1.363.479-1.845.835c-.434.32-.379.646-.301.778c.343.578 5.883.369 7.482.189c1.6.18 7.14.389 7.483-.189c.078-.132.132-.458-.301-.778c-.483-.356-1.233-.646-1.846-.836c1.637-1.384 2.393-3.302 2.393-4.771c0 0 1.563 2.537 2.103 2.472c.251-.03.581-1.39-.438-4.673';

const COPY_ICON =
  'M16 1H4q-1.25 0-2.125.875T1 4v12h2V4h13zm3 4H8q-1.25 0-2.125.875T5 8v12q0 1.25.875 2.125T8 23h11q1.25 0 2.125-.875T23 20V8q0-1.25-.875-2.125T20 5m0 15H8V8h12z';

const GROUP = {
  name: translate({ id: 'qq.groupName', message: 'XRobot交流群' }),
  number: '608182228',
  joinUrl: 'https://qm.qq.com/q/RPgE71OXmw',
  qr: '/img/qq-group-qr.jpg',
};

const REPOS: Array<{ name: string; url: string }> = [
  { name: translate({ id: 'qq.repo.github', message: 'Github' }), url: 'https://github.com/xrobot-org/XRobot.git' },
  { name: translate({ id: 'qq.repo.gitee', message: 'Gitee' }), url: 'https://gitee.com/x-robot/XRobot.git' },
  { name: translate({ id: 'qq.repo.docs', message: '文档' }), url: 'https://xrobot-org.github.io/' },
  { name: 'OneMessage', url: 'https://github.com/Jiu-xiao/OneMessage.git' },
  { name: 'MiniShell', url: 'https://github.com/Jiu-xiao/mini_shell.git' },
  { name: 'MiniFlashDB', url: 'https://github.com/Jiu-xiao/MiniFlashDB.git' },
];

/** Small copy button with success/failure feedback ("copied ✓" only on real success). */
function CopyButton({ text, label }: { text: string; label: string }): JSX.Element {
  const [copied, setCopied] = useState<boolean | null>(null);
  const onCopy = useCallback(() => {
    void copyTextToClipboard(text).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(null), 1600);
    });
  }, [text]);
  return (
    <button type="button" className={styles.copyBtn} onClick={onCopy} aria-label={label}>
      {copied === null ? (
        <>
          <svg viewBox="0 0 24 24" width="0.9em" height="0.9em" fill="currentColor" aria-hidden="true">
            <path d={COPY_ICON} />
          </svg>
          {label}
        </>
      ) : copied ? (
        <span className={styles.copyDone}>{translate({ id: 'qq.copied', message: '已复制 ✓' })}</span>
      ) : (
        <span className={styles.copyFailed}>{translate({ id: 'qq.copyFailed', message: '复制失败' })}</span>
      )}
    </button>
  );
}

export default function QqPage(): JSX.Element {
  return (
    <Layout
      title={translate({ id: 'qq.title', message: '加入交流' })}
      description={translate({
        id: 'qq.description',
        message: '加入 XRobot 交流群：扫码、搜群号或一键加群，以及组织各仓库与文档的入口。',
      })}>
      <main className={styles.page}>
        <div className={styles.card}>
          <header className={styles.header}>
            <div className={styles.titleRow}>
              <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true">
                <path d={QQ_ICON} />
              </svg>
              <h1 className={styles.title}>{translate({ id: 'qq.title', message: '加入交流' })}</h1>
            </div>
            <p className={styles.lead}>
              {translate({
                id: 'qq.lead',
                message:
                  '本群为XRobot（青岛大学嵌入式软件开源）组织及其衍生项目的交流群，欢迎Star！有问题可以直接在群里问。',
              })}
            </p>
          </header>

          <section className={styles.qrZone} aria-label={translate({ id: 'qq.groupCard', message: '群二维码' })}>
            <div className={styles.qrCard}>
              <img
                src={GROUP.qr}
                alt={translate({ id: 'qq.qrAlt', message: 'XRobot交流群 QQ 群二维码' })}
                width={288}
                className={styles.qrImg}
                loading="lazy"
              />
            </div>
            <div className={styles.groupName}>{GROUP.name}</div>
            <div className={styles.groupNumberRow}>
              <span className={styles.groupNumberLabel}>{translate({ id: 'qq.groupNumber', message: '群号' })}</span>
              <code className={styles.groupNumber}>{GROUP.number}</code>
              <CopyButton
                text={GROUP.number}
                label={translate({ id: 'qq.copy', message: '复制' })}
              />
            </div>
            <a className={styles.joinBtn} href={GROUP.joinUrl} target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4s-4 1.79-4 4s1.79 4 4 4m-9-2V7H4v3H1v2h3v3h2v-3h3v-2zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4" />
              </svg>
              {translate({ id: 'qq.join', message: '一键加群' })}
            </a>
            <p className={styles.hint}>
              {translate({ id: 'qq.hint', message: '手机 QQ 扫一扫二维码，或在 QQ 里搜索群号加入。' })}
            </p>
          </section>

          <section aria-label={translate({ id: 'qq.repos', message: '组织与项目' })}>
            <h2 className={styles.reposTitle}>{translate({ id: 'qq.repos', message: '组织与项目' })}</h2>
            <ul className={styles.repoList}>
              {REPOS.map((repo) => (
                <li key={repo.url} className={styles.repoRow}>
                  <span className={styles.repoName}>{repo.name}</span>
                  <a className={styles.repoUrl} href={repo.url} target="_blank" rel="noopener noreferrer">
                    {repo.url}
                  </a>
                  <CopyButton text={repo.url} label={translate({ id: 'qq.copy', message: '复制' })} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </Layout>
  );
}
