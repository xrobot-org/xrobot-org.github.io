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
import Showcase, { readMotionOff, setMotionOff, useReducedMotion } from '@site/src/components/showcase/Showcase';
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

/** Page-wide animation switch; on by default, stored in localStorage (see Showcase.tsx). */
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
