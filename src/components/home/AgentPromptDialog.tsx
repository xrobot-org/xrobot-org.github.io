/**
 * Agent quick start: a dialog with the startup prompt, a download button (.md) and a copy button.
 */
import React, { useEffect, useRef, useState } from 'react';
import Link from '@docusaurus/Link';
import { translate } from '@docusaurus/Translate';
import { Button, PathLabel } from '@site/src/components/xr';
import { agentPromptEn, agentPromptFilename, agentPromptZh } from '@site/src/data/agentPrompt';
import styles from './AgentPromptDialog.module.css';

type Status = 'idle' | 'copied' | 'downloaded' | 'copy-failed';

async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', 'true');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('copy failed');
}

export default function AgentPromptDialog({
  open,
  onClose,
  isEnglish,
}: {
  open: boolean;
  onClose: () => void;
  isEnglish: boolean;
}): JSX.Element | null {
  const [status, setStatus] = useState<Status>('idle');
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prompt = isEnglish ? agentPromptEn : agentPromptZh;

  useEffect(() => {
    if (!open) return undefined;
    setStatus('idle');
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // aria-modal dialog: keep keyboard focus cycling inside the dialog.
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement;
      if (event.shiftKey && (current === first || !dialog.contains(current))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || !dialog.contains(current))) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const download = () => {
    const blob = new Blob([prompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = agentPromptFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus('downloaded');
  };

  const copy = async () => {
    try {
      await copyText(prompt);
      setStatus('copied');
    } catch {
      setStatus('copy-failed');
    }
  };

  const statusText = {
    idle: translate({ id: 'home.agent.status.idle', message: '提示词先判断工程类型，再决定进入哪份文档或执行哪一步。' }),
    copied: translate({ id: 'home.agent.status.copied', message: '已复制到剪贴板。' }),
    downloaded: translate({ id: 'home.agent.status.downloaded', message: 'Markdown 文件已开始下载。' }),
    'copy-failed': translate({ id: 'home.agent.status.copyFailed', message: '浏览器拒绝了剪贴板写入。下载得到的 .md 文件内容相同。' }),
  }[status];

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <div>
            <PathLabel path="AGENT / PROMPT" />
            <h2 id="agent-dialog-title" className={styles.title}>
              {translate({ id: 'home.agent.title', message: 'Agent 快速部署' })}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className={`xr-btn xr-btn-secondary ${styles.close}`}
            onClick={onClose}
          >
            {translate({ id: 'home.agent.close', message: '关闭' })}
          </button>
        </div>
        <p className={styles.lead}>
          {translate({
            id: 'home.agent.lead',
            message: '这份提示词让 Agent 先判断当前工程属于 XRobot BSP、平台工程还是驱动工程，再按固定顺序选择文档入口。',
          })}
        </p>
        <dl className={styles.meta}>
          <dt>{translate({ id: 'home.agent.filename', message: '文件名' })}</dt>
          <dd>
            <code>{agentPromptFilename}</code>
          </dd>
        </dl>
        <ul className={styles.links}>
          <li>
            <Link className="xr-link" to="/docs/quick_start">
              {translate({ id: 'home.agent.link.quickStart', message: '快速开始' })}
            </Link>
          </li>
          <li>
            <Link className="xr-link" to="/docs/proj_man">
              {translate({ id: 'home.agent.link.projman', message: '项目管理（XRobot）' })}
            </Link>
          </li>
          <li>
            <Link className="xr-link" to="https://xrobot.work/XRobot-Onboarding/">
              {translate({ id: 'home.agent.link.onboarding', message: '新手任务引导' })}
            </Link>
          </li>
        </ul>
        <pre className={styles.preview} tabIndex={0}>
          {prompt}
        </pre>
        <div className={styles.actions}>
          <Button variant="primary" onClick={download}>
            {translate({ id: 'home.agent.download', message: '下载提示词' })}
          </Button>
          <Button onClick={() => void copy()}>{translate({ id: 'home.agent.copy', message: '复制提示词' })}</Button>
        </div>
        <p className={styles.status} aria-live="polite">
          {statusText}
        </p>
      </div>
    </div>
  );
}
