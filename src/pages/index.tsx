/**
 * Home page (XRobot Style). Content and links: src/data/home.tsx; widgets: src/components/showcase.
 * Order: first screen (value, actions, chapters, SameCode) -> capabilities -> documentation entry
 * -> getting started and contributing -> "XRobot is all you need".
 */
import React, { useCallback, useEffect, useState } from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import { translate } from '@docusaurus/Translate';
import { Button, Card, Logo, PathLabel, Tag, inlineCode } from '@site/src/components/xr';
import Showcase from '@site/src/components/showcase/Showcase';
import { readMotionOff, setMotionOff, useReducedMotion } from '@site/src/utils/motion';
import ShowcaseSection, { StaticFigure } from '@site/src/components/showcase/ShowcaseSection';
import AgentPromptDialog from '@site/src/components/home/AgentPromptDialog';
import { capabilities, chapters, heroActions, links, recent, routes, scenarios, versionRows, type FigureSpec } from '@site/src/data/home';
import commitInfo from '@site/src/data/commitInfo.json';
import styles from './index.module.css';

function Figure({ spec }: { spec: FigureSpec }): JSX.Element {
  return (
    <StaticFigure src={spec.src} alt={spec.alt} ratio={spec.ratio} caption={spec.caption}>
      {spec.commands ? (
        <figure className="xr-code">
          {spec.commandsTitle ? <figcaption className="xr-code-title">{spec.commandsTitle}</figcaption> : null}
          <pre className="xr-code-pre">
            <code>{spec.commands}</code>
          </pre>
        </figure>
      ) : null}
    </StaticFigure>
  );
}

/** Page-wide animation switch; on by default, stored in localStorage (see src/utils/motion.ts). */
function MotionSwitch(): JSX.Element {
  const off = useReducedMotion();
  useEffect(() => {
    document.documentElement.dataset.motion = readMotionOff() ? 'off' : 'on';
  }, []);
  const label = translate({ id: 'home.motion.label', message: '动画' });
  return (
    <div className={styles.motionSwitch} role="group" aria-label={label}>
      <span className={styles.motionLabel}>{label}</span>
      <button type="button" aria-pressed={!off} className={!off ? styles.motionOn : undefined} onClick={() => setMotionOff(false)}>
        {translate({ id: 'home.motion.on', message: '开' })}
      </button>
      <button type="button" aria-pressed={off} className={off ? styles.motionOn : undefined} onClick={() => setMotionOff(true)}>
        {translate({ id: 'home.motion.off', message: '关' })}
      </button>
    </div>
  );
}

const BILIBILI_ICON =
  'M17.813 4.653h.854q2.266.08 3.773 1.574Q23.946 7.72 24 9.987v7.36q-.054 2.266-1.56 3.773c-1.506 1.507-2.262 1.524-3.773 1.56H5.333q-2.266-.054-3.773-1.56C.053 19.614.036 18.858 0 17.347v-7.36q.054-2.267 1.56-3.76t3.773-1.574h.774l-1.174-1.12a1.23 1.23 0 0 1-.373-.906q0-.534.373-.907l.027-.027q.4-.373.92-.373t.92.373L9.653 4.44q.107.106.187.213h4.267a.8.8 0 0 1 .16-.213l2.853-2.747q.4-.373.92-.373c.347 0 .662.151.929.4s.391.551.391.907q0 .532-.373.906zM5.333 7.24q-1.12.027-1.88.773q-.76.748-.786 1.894v7.52q.026 1.146.786 1.893t1.88.773h13.334q1.12-.026 1.88-.773t.786-1.893v-7.52q-.026-1.147-.786-1.894t-1.88-.773zM8 11.107q.56 0 .933.373q.375.374.4.96v1.173q-.025.586-.4.96q-.373.375-.933.374c-.56-.001-.684-.125-.933-.374q-.375-.373-.4-.96V12.44q0-.56.386-.947q.387-.386.947-.386m8 0q.56 0 .933.373q.375.374.4.96v1.173q-.025.586-.4.96q-.373.375-.933.374c-.56-.001-.684-.125-.933-.374q-.375-.373-.4-.96V12.44q.025-.586.4-.96q.373-.373.933-.373';

const GITHUB_ICON =
  'M12 .297c-6.63 0-12 5.373-12 12c0 5.303 3.438 9.8 8.205 11.385c.6.113.82-.258.82-.577c0-.285-.01-1.04-.015-2.04c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729c1.205.084 1.838 1.236 1.838 1.236c1.07 1.835 2.809 1.305 3.495.998c.108-.776.417-1.305.76-1.605c-2.665-.3-5.466-1.332-5.466-5.93c0-1.31.465-2.38 1.235-3.22c-.135-.303-.54-1.523.105-3.176c0 0 1.005-.322 3.3 1.23c.96-.267 1.98-.399 3-.405c1.02.006 2.04.138 3 .405c2.28-1.552 3.285-1.23 3.285-1.23c.645 1.653.24 2.873.12 3.176c.765.84 1.23 1.91 1.23 3.22c0 4.61-2.805 5.625-5.475 5.92c.42.36.81 1.096.81 2.22c0 1.606-.015 2.896-.015 3.286c0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12';

const MAIL_ICON = 'M4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm8-7L4 8v10h16V8zm0-2l8-5H4zM4 8V6v12z';

const QQ_ICON =
  'M21.395 15.035a40 40 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 4.632 17.351 0 12 0S4.474 4.632 4.474 9.241c0 .274.013.804.014.836l-1.08 2.695a39 39 0 0 0-.802 2.264c-1.021 3.283-.69 4.643-.438 4.673c.54.065 2.103-2.472 2.103-2.472c0 1.469.756 3.387 2.394 4.771c-.612.188-1.363.479-1.845.835c-.434.32-.379.646-.301.778c.343.578 5.883.369 7.482.189c1.6.18 7.14.389 7.483-.189c.078-.132.132-.458-.301-.778c-.483-.356-1.233-.646-1.846-.836c1.637-1.384 2.393-3.302 2.393-4.771c0 0 1.563 2.537 2.103 2.472c.251-.03.581-1.39-.438-4.673';

const BOOK_ICON =
  'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z';

/** Hanging tag cards under the hero wordmark (bilibili / GitHub / email / QQ group). */
function HeroTags(): JSX.Element {
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    const email = 'Cong.Liu_Xiao@outlook.com';
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = email;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const tags: Array<{
    key: string;
    color: string;
    ink: string;
    label: string;
    icon: string;
    href?: string;
    onClick?: () => void;
  }> = [
    {
      key: 'bilibili',
      color: 'rgb(255 150 165 / 0.95)',
      ink: '#5a1020',
      label: translate({ id: 'home.hero.tag.bilibili', message: 'B站' }),
      icon: BILIBILI_ICON,
      href: 'https://space.bilibili.com/339766655',
    },
    {
      key: 'github',
      color: 'rgb(255 210 80 / 0.95)',
      ink: '#553500',
      label: translate({ id: 'home.hero.tag.github', message: 'GitHub' }),
      icon: GITHUB_ICON,
      href: 'https://github.com/xrobot-org',
    },
    {
      key: 'email',
      color: 'rgb(144 211 173 / 0.95)',
      ink: '#174b38',
      label: copied
        ? translate({ id: 'home.hero.tag.copied', message: '已复制 ✓' })
        : translate({ id: 'home.hero.tag.email', message: '邮箱' }),
      icon: MAIL_ICON,
      onClick: () => void copyEmail(),
    },
    {
      key: 'qq',
      color: 'rgb(135 190 236 / 0.95)',
      ink: '#173b61',
      label: translate({ id: 'home.hero.tag.qq', message: 'QQ群' }),
      icon: QQ_ICON,
      href: '/qq',
    },
    {
      key: 'docs',
      color: 'rgb(246 184 98 / 0.95)',
      ink: '#5b3510',
      label: translate({ id: 'home.hero.tag.docs', message: '文档' }),
      icon: BOOK_ICON,
      href: '/docs/intro',
    },
  ];
  return (
    <div className={styles.heroTagZone}>
      <p className={styles.heroSlogan}>XRobot is all you need</p>
      <div className={styles.heroTags} role="list" aria-label={translate({ id: 'home.hero.tags', message: '联系我们' })}>
        {tags.map((tag) => {
          const style = {
            ['--tag-color' as string]: tag.color,
            ['--tag-ink' as string]: tag.ink,
          } as React.CSSProperties;
          const inner = (
            <>
              <span className={styles.heroTagIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
                  <path d={tag.icon} />
                </svg>
              </span>
              <span className={styles.heroTagName}>{tag.label}</span>
            </>
          );
          if (tag.href) {
            return tag.href.startsWith('/')
              ? (
                <Link key={tag.key} role="listitem" to={tag.href} className={styles.heroTag} style={style}>
                  {inner}
                </Link>
              )
              : (
                <a key={tag.key} role="listitem" href={tag.href} target="_blank" rel="noopener noreferrer"
                  className={styles.heroTag} style={style}>
                  {inner}
                </a>
              );
          }
          return (
            <button key={tag.key} role="listitem" type="button" className={styles.heroTag} style={style}
              onClick={tag.onClick}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Hero({ isEnglish }: { isEnglish: boolean }): JSX.Element {
  return (
    <section className={styles.hero} aria-labelledby="home-title">
      <div className={`${styles.inner} ${styles.heroTop}`}>
        <div className={styles.heroCopy}>
          <PathLabel path="XROBOT / LIBXR" />
          <h1 id="home-title" className={styles.heroTitle}>
            {translate({ id: 'home.hero.title', message: '同一份模块代码，在不同的硬件和系统上运行' })}
          </h1>
          <p className={styles.heroLead}>
            {inlineCode(
              translate({
                id: 'home.hero.lead.libxr',
                message:
                  'LibXR 是跨平台的 C++ 兼容层，包含外设驱动、数据结构、通信中间件、操作系统封装与数学工具，以及 USB 协议栈 XRUSB。',
              }),
            )}
          </p>
          <p className={styles.heroLead}>
            {inlineCode(
              translate({
                id: 'home.hero.lead.tools',
                message:
                  'CodeGenerator 和 XRobot 是配合 LibXR 使用的两个命令行工具：CodeGenerator 由 STM32CubeMX 工程生成外设对象和入口函数 `app_main`，XRobot 负责拉取模块、把每个模块锁定到具体的提交，并根据配置生成主函数 `XRobotMain`。',
              }),
            )}
          </p>
          <div className={styles.heroActions}>
            {heroActions(isEnglish).map((action) => (
              <Button key={action.href} variant={action.primary ? 'primary' : undefined} href={action.href}>
                {action.label}
              </Button>
            ))}
          </div>
        </div>
        <nav className={styles.chapters} aria-labelledby="home-chapters">
          <Logo height={96} className={styles.heroLogo} />
          <HeroTags />
          <span id="home-chapters" className={`xr-path ${styles.chaptersLabel}`}>
            {translate({ id: 'home.hero.chapters', message: '文档章节' })}
          </span>
          <ul className={styles.chapterList}>
            {chapters().map((chapter) => (
              <li key={chapter.href}>
                <Link className={styles.chapter} to={chapter.href}>
                  <span className={styles.chapterPath}>{chapter.path}</span>
                  <span className={styles.chapterLabel}>{chapter.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className={`${styles.inner} ${styles.heroStage}`}>
        <MotionSwitch />
        <Showcase
          name="SameCode"
          height={{ desktop: 476, mobile: 952 }}
          label={translate({ id: 'home.hero.widgetLabel', message: '同一份 BlinkLED 在四种硬件和系统上运行' })}
        />
      </div>
    </section>
  );
}

function VersionCard(): JSX.Element {
  const rows = versionRows.map((row) => {
    const value = (commitInfo as Record<string, string>)[row.key] || 'N/A';
    return { name: row.name, sha: value, href: row.href(value) };
  });
  return (
    <Card label="DOCS / BASELINE" title={translate({ id: 'home.version.title', message: '文档基线' })}>
      <p>{translate({ id: 'home.version.desc', message: '本文档对应的 xrobot、libxr 发布版本与 LibXR 提交。' })}</p>
      <dl className={styles.versionList}>
        {rows.map((row) => (
          <div key={row.name} className={styles.versionRow}>
            <dt>{row.name}</dt>
            <dd>
              {row.href ? (
                <Link className="xr-link" to={row.href}>
                  <code>{row.sha}</code>
                </Link>
              ) : (
                <code>{row.sha}</code>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function DocsArea(): JSX.Element {
  return (
    <section className={styles.block} aria-labelledby="home-docs">
      <div className={styles.inner}>
        <div className={styles.blockHead}>
          <PathLabel path="DOCS" />
          <h2 id="home-docs" className={styles.blockTitle}>
            {translate({ id: 'home.docs.title', message: '按工程类型进入文档' })}
          </h2>
          <p className={styles.blockLead}>
            {translate({
              id: 'home.docs.lead',
              message: '四个入口对应四类工程；场景列表给出常见任务的起点。',
            })}
          </p>
        </div>

        <div className={styles.routeGrid}>
          {routes().map((route) => (
            <Card
              key={route.href}
              label={route.path}
              title={route.title}
              href={route.href}
              footer={route.more.map((more) => (
                <Link key={more.href} className={`xr-link ${styles.routeMore}`} to={more.href}>
                  {more.label}
                </Link>
              ))}
            >
              <p>{inlineCode(route.desc)}</p>
            </Card>
          ))}
        </div>

        <div className={styles.docsSplit}>
          <div>
            <h3 className={styles.subTitle}>{translate({ id: 'home.docs.scenarios', message: '按场景进入' })}</h3>
            <ol className={styles.scenarios}>
              {scenarios().map((item) => (
                <li key={item.index}>
                  <Link className={styles.scenario} to={item.href}>
                    <span className={styles.scenarioIndex}>{item.index}</span>
                    <span className={styles.scenarioText}>
                      <span className={styles.scenarioTitle}>{item.title}</span>
                      <span className={styles.scenarioDesc}>{item.desc}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
          <div className={styles.docsSide}>
            <VersionCard />
            <div>
              <h3 className={styles.subTitle}>{translate({ id: 'home.recent.title', message: '近期动态' })}</h3>
              <ul className={styles.recent}>
                {recent().map((item) => (
                  <li key={item.tag} className={styles.recentItem}>
                    <Tag>{item.tag}</Tag>
                    <span className={styles.recentTitle}>{item.title}</span>
                    <span className={styles.recentDesc}>{inlineCode(item.desc)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Join({ onAgent }: { onAgent: () => void }): JSX.Element {
  return (
    <section className={styles.block} aria-labelledby="home-join">
      <div className={styles.inner}>
        <div className={styles.blockHead}>
          <PathLabel path="COMMUNITY" />
          <h2 id="home-join" className={styles.blockTitle}>
            {translate({ id: 'home.join.title', message: '上手与参与' })}
          </h2>
        </div>
        <div className={styles.joinGrid}>
          <Card
            label="ONBOARDING"
            title={translate({ id: 'home.join.onboarding.title', message: '新手任务引导' })}
            href={links.onboarding}
          >
            <p>
              {translate({
                id: 'home.join.onboarding.desc',
                message: '按平台给出起步路径，逐步介绍 XRobot 与 LibXR 的设计思想和基本写法。',
              })}
            </p>
          </Card>
          <article className={`xr-card ${styles.agentCard}`}>
            <PathLabel path="AGENT" />
            <h3 className="xr-card-title">{translate({ id: 'home.join.agent.title', message: 'Agent 快速部署' })}</h3>
            <div className="xr-card-body">
              <p>
                {translate({
                  id: 'home.join.agent.desc',
                  message: '一页启动上下文：编程助手先判断仓库属于 XRobot BSP、平台工程还是驱动工程，再进入对应的文档和代码。',
                })}
              </p>
            </div>
            <div className="xr-card-footer">
              <Button onClick={onAgent}>{translate({ id: 'home.join.agent.open', message: '打开提示词' })}</Button>
            </div>
          </article>
          <Card
            label="MODULES"
            title={translate({ id: 'home.join.modules.title', message: '模块源' })}
            href="/docs/proj_man/proj-man-source-man"
            footer={
              <Link className={`xr-link ${styles.routeMore}`} to={links.modulesRepo}>
                xrobot-org/xrobot-modules
              </Link>
            }
          >
            <p>
              {inlineCode(
                translate({
                  id: 'home.join.modules.desc',
                  message: '官方模块源列出可以加入 BSP 的模块，`xrobot source` 可以搜索和查看其中的条目。',
                }),
              )}
            </p>
          </Card>
          <Card
            label="CONTRIBUTE"
            title={translate({ id: 'home.join.contribute.title', message: '贡献指南' })}
            href="/docs/con_guide"
            footer={
              <>
                <Link className={`xr-link ${styles.routeMore}`} to="/docs/about">
                  {translate({ id: 'home.join.about', message: '项目起源' })}
                </Link>
                <Link className={`xr-link ${styles.routeMore}`} to={links.github}>
                  {translate({ id: 'home.join.github', message: 'GitHub 组织' })}
                </Link>
              </>
            }
          >
            <p>
              {translate({
                id: 'home.join.contribute.desc',
                message: '仓库与分支约定、编码与文档规范、测试规范，以及提交改动的方式。',
              })}
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  const { i18n } = useDocusaurusContext();
  const isEnglish = i18n.currentLocale === 'en';
  const [agentOpen, setAgentOpen] = useState(false);
  const closeAgent = useCallback(() => setAgentOpen(false), []);

  return (
    <Layout
      title={translate({ id: 'home.meta.title', message: '首页' })}
      description={translate({ id: 'home.meta.description', message: 'XRobot 与 LibXR 的开发文档。' })}
    >
      <main className={styles.page}>
        <Hero isEnglish={isEnglish} />

        {capabilities(isEnglish).map(({ figure, ...section }) => (
          <ShowcaseSection key={section.id} {...section} fallback={figure ? <Figure spec={figure} /> : undefined} />
        ))}

        <DocsArea />
        <Join onAgent={() => setAgentOpen(true)} />

        <section className={styles.closing} aria-label="XRobot is all you need">
          <div className={`${styles.inner} ${styles.closingInner}`}>
            <Logo height={56} />
            <p className={styles.slogan}>{translate({ id: 'home.closing.slogan', message: 'XRobot is all you need' })}</p>
          </div>
        </section>

        <AgentPromptDialog open={agentOpen} onClose={closeAgent} isEnglish={isEnglish} />
      </main>
    </Layout>
  );
}
