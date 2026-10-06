/**
 * QQ group page (/qq): the group QR code, the group ID with a copy button, a join link, and the
 * organization's repositories. XRobot Style: ink on paper, 1px lines, square corners.
 */
import React, { useCallback, useState } from 'react';
import Layout from '@theme/Layout';
import { translate } from '@docusaurus/Translate';
import { PathLabel } from '@site/src/components/xr';
import { copyTextToClipboard } from '@site/src/utils/clipboard';
import styles from './qq.module.css';

const GROUP = {
  name: translate({ id: 'qq.groupName', message: 'XRobot 交流群' }),
  number: '608182228',
  joinUrl: 'https://qm.qq.com/q/RPgE71OXmw',
  qr: '/img/qq-group-qr.jpg',
};

const REPOS: Array<{ name: string; url: string }> = [
  { name: translate({ id: 'qq.repo.github', message: 'GitHub' }), url: 'https://github.com/xrobot-org/XRobot.git' },
  { name: translate({ id: 'qq.repo.gitee', message: 'Gitee' }), url: 'https://gitee.com/x-robot/XRobot.git' },
  { name: translate({ id: 'qq.repo.docs', message: '文档' }), url: 'https://xrobot-org.github.io/' },
  { name: 'OneMessage', url: 'https://github.com/Jiu-xiao/OneMessage.git' },
  { name: 'MiniShell', url: 'https://github.com/Jiu-xiao/mini_shell.git' },
  { name: 'MiniFlashDB', url: 'https://github.com/Jiu-xiao/MiniFlashDB.git' },
];

/** Copy button; reports "copied" only when the clipboard write succeeded. */
function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState<boolean | null>(null);
  const onCopy = useCallback(() => {
    void copyTextToClipboard(text).then((ok) => {
      setCopied(ok);
      window.setTimeout(() => setCopied(null), 1600);
    });
  }, [text]);
  const label =
    copied === null
      ? translate({ id: 'qq.copy', message: '复制' })
      : copied
        ? translate({ id: 'qq.copied', message: '已复制 ✓' })
        : translate({ id: 'qq.copyFailed', message: '复制失败' });
  return (
    <button type="button" className={`xr-btn xr-btn-secondary ${styles.copyBtn}`} onClick={onCopy} aria-live="polite">
      {label}
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
        <div className={styles.inner}>
          <header className={styles.header}>
            <PathLabel path="XROBOT / COMMUNITY" />
            <h1 className={styles.title}>{translate({ id: 'qq.title', message: '加入交流' })}</h1>
            <p className={styles.lead}>
              {translate({
                id: 'qq.lead',
                message: 'XRobot 组织（青岛大学嵌入式软件开源）及其衍生项目的交流群。使用中遇到的问题可以直接在群里提出。',
              })}
            </p>
          </header>

          <section className={styles.group} aria-label={translate({ id: 'qq.groupCard', message: '群二维码' })}>
            <figure className={styles.qrFrame}>
              <img
                src={GROUP.qr}
                alt={translate({ id: 'qq.qrAlt', message: 'XRobot 交流群 QQ 群二维码' })}
                width={240}
                height={240}
                className={styles.qrImg}
                loading="lazy"
              />
            </figure>
            <div className={styles.groupInfo}>
              <h2 className={styles.groupName}>{GROUP.name}</h2>
              <dl className={styles.fields}>
                <div className={styles.field}>
                  <dt>{translate({ id: 'qq.groupNumber', message: '群号' })}</dt>
                  <dd>
                    <code className={styles.mono}>{GROUP.number}</code>
                    <CopyButton text={GROUP.number} />
                  </dd>
                </div>
              </dl>
              <a className="xr-btn xr-btn-primary" href={GROUP.joinUrl} target="_blank" rel="noopener noreferrer">
                {translate({ id: 'qq.join', message: '一键加群' })}
              </a>
              <p className={styles.hint}>
                {translate({ id: 'qq.hint', message: '手机 QQ 扫一扫二维码，或在 QQ 里搜索群号加入。' })}
              </p>
            </div>
          </section>

          <section className={styles.repos}>
            <h2 className={styles.sectionTitle}>{translate({ id: 'qq.repos', message: '组织与项目' })}</h2>
            <ul className={styles.repoList}>
              {REPOS.map((repo) => (
                <li key={repo.url} className={styles.repoRow}>
                  <span className={styles.repoName}>{repo.name}</span>
                  <a className={`xr-link ${styles.repoUrl}`} href={repo.url} target="_blank" rel="noopener noreferrer">
                    {repo.url}
                  </a>
                  <CopyButton text={repo.url} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </Layout>
  );
}
