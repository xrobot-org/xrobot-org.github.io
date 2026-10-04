import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Translate, { translate } from '@docusaurus/Translate';
import commitInfo from '../data/commitInfo.json';
import './Home.css';

const agentQuickDeployFilename = 'xrobot-agent-context.md';

const agentQuickDeployPromptZh = [
  '# XRobot / LibXR 专用 Agent 启动提示词',
  '',
  '你正在协助的是 XRobot / LibXR 相关仓库。这里的仓库不一定是 STM32 工程，也不一定是 XRobot workspace；它也可能是 CH32、ESP32、Linux、Webots、HPM、MSPM0 平台工程，或者驱动、XRUSB、调试、CodeGen、示例与测试仓库。',
  '',
  '开始分析前，先根据当前仓库的目录和关键文件判断它属于哪一类，再进入对应文档和代码入口。',
  '',
  '## 这几个项目分别是什么',
  '- LibXR：运行时框架，负责核心语义、驱动抽象、中间件和 XRUSB。',
  '- XRobot：`xrobot` 命令，负责模块源与依赖解析、版本锁定（`xrobot.lock`）、应用配置和静态应用入口生成。',
  '- CodeGen：代码生成工具，负责根据配置生成工程入口和相关代码。',
  '',
  '## 使用原则',
  '- 这是 XRobot / LibXR 专用助手提示词，不是通用嵌入式模板。',
  '- 不要在看目录之前就默认它是 STM32、ESP32、Linux，或者默认它一定要先跑 XRobot 命令。',
  '- 先判断仓库角色，再决定看哪份文档、读哪部分代码、执行哪类命令。',
  '',
  '## 第一步先看什么',
  '- 先检查仓库根目录与关键配置文件，确认它更像工作区、平台工程、驱动仓库，还是工具仓库。',
  '- XRobot workspace 常见痕迹：`Modules/modules.yaml`、`Modules/sources.yaml`、`xrobot.lock`、`User/*.yaml`、调用 `XROBOT_MAIN()` 的入口源文件。',
  '- LibXR 平台工程常见痕迹：`CMakeLists.txt`、`CMakePresets.json`、`libxr_config.yaml`、平台目录、芯片配置文件、板级实现目录。',
  '- 平台或 SDK 线索也要纳入判断：`.ioc`、CubeMX 工程、`idf.py`、`platformio.ini`、Linux / Webots 目录、厂商 SDK 目录。',
  '- 如果重点文件集中在 `driver`、`system`、`USB`、`DAP`、`Debug`、协议栈或设备枚举实现，优先按驱动 / XRUSB / 调试工程理解。',
  '',
  '## 工程类型判断',
  '- 如果当前仓库有 `Modules/modules.yaml`，按 XRobot workspace 处理；`xrobot describe` 以 JSON 给出它的配置、锁定模块、注册和诊断。',
  '- 如果当前仓库主要围绕 LibXR 集成、平台工程、芯片/板级配置、驱动实现展开，按 LibXR 平台工程处理。',
  '- 如果当前仓库重点是设备接口、协议栈、调试链路、USB/CAN/UART 等实现，按驱动 / XRUSB 工程处理。',
  '- 如果当前仓库主要是代码生成、模板、示例、测试或基准，按工具 / 示例仓库处理，不要硬套到板级移植流程。',
  '- 如果仓库里同时存在多类入口，先说明你看到的证据，再决定主入口，不要直接跳到某个工具命令。',
  '',
  '## 文档入口',
  '- 总入口：https://xrobot.work/docs/intro',
  '- 设计思想：https://xrobot.work/docs/concept',
  '- 环境配置：https://xrobot.work/docs/env_setup',
  '- 基础编程：https://xrobot.work/docs/basic_coding',
  '- 项目管理（XRobot）：https://xrobot.work/docs/proj_man',
  '- XRUSB：https://xrobot.work/docs/xrusb',
  '- 调试：https://xrobot.work/docs/debug',
  '',
  '## 入口选择规则',
  '- 只有确认是 XRobot workspace 时，才优先看 `proj_man`、`xrobot setup`、`xrobot describe`、`Modules/`、`User/`。',
  '- 如果是 LibXR 平台工程，优先看 `env_setup`、`concept`、`basic_coding`，再按实际平台进入对应环境页。',
  '- 如果是驱动或设备接口问题，再转去 `xrusb`、`debug`、`basic_coding/driver`。',
  '- 如果是中间件、消息系统、调度、Topic 等运行时机制问题，优先看 `basic_coding` 下对应章节。',
  '- 如果当前仓库只是某个平台或某个芯片工程，不要把它强行解释成 XRobot workspace。',
  '',
  '## 遇到问题时怎么处理',
  '- 先确认问题属于哪一层：环境、工程工作流、运行时语义、驱动/XRUSB。',
  '- 先打开上面的对应文档链接，不要脱离文档自行猜测接口或目录结构。',
  '- 如果文档里没有，再结合当前仓库代码和命令输出继续判断。',
  '- 如果仍然解决不了，再整理最小问题描述、命令输出和环境信息后提问。',
  '',
  '## 需要进一步求助时',
  '- 补充当前平台、目标芯片/系统、使用的命令、报错原文。',
  '- 如果是 XRobot workspace 问题，优先附上 `Modules/` 和 `User/` 下相关文件状态。',
  '- 如果是 LibXR 平台工程问题，优先附上 `CMakeLists.txt`、`CMakePresets.json`、平台配置文件、`libxr_config.yaml` 等文件状态。',
  '- 如果是驱动、XRUSB、调试或运行时问题，优先附上相关源码位置、最小复现代码和日志。',
  '',
  '## 补充入口',
  '- 新手任务引导：https://xrobot.work/XRobot-Onboarding/',
].join('\n');

const agentQuickDeployPromptEn = [
  '# XRobot / LibXR Agent Startup Prompt',
  '',
  'You are assisting with a repository related to XRobot / LibXR. It may be an STM32, CH32, ESP32, Linux, Webots, HPM, or MSPM0 platform project; it may also be an XRobot workspace, a driver repository, an XRUSB/debug project, CodeGen, examples, or tests.',
  '',
  'Before changing code or running setup commands, inspect the repository layout and key files first, identify what kind of repository this is, and then choose the corresponding docs and code entry points.',
  '',
  '## What these projects are',
  '- LibXR: the runtime framework, covering core semantics, driver abstractions, middleware, and XRUSB.',
  '- XRobot: the `xrobot` command, covering module catalogs, dependency resolution and locking (`xrobot.lock`), application configuration, and static application entry generation.',
  '- CodeGen: the code generation tool, used to generate project entry code from configuration.',
  '',
  '## Ground rules',
  '- This is a dedicated XRobot / LibXR assistant prompt, not a generic embedded template.',
  '- Do not assume STM32, ESP32, Linux, or an XRobot workspace before you inspect the repository.',
  '- Classify the repository role first, then decide which docs to read, which code to inspect, and which commands to run.',
  '',
  '## What to inspect first',
  '- Start from the repository root and key config files, and decide whether it looks like a workspace, a platform project, a driver repository, or a tooling repository.',
  '- Common XRobot workspace traces: `Modules/modules.yaml`, `Modules/sources.yaml`, `xrobot.lock`, `User/*.yaml`, and an entry source that calls `XROBOT_MAIN()`.',
  '- Common LibXR platform-project traces: `CMakeLists.txt`, `CMakePresets.json`, `libxr_config.yaml`, platform directories, chip config files, and board-level implementation directories.',
  '- Platform or SDK clues also matter: `.ioc`, CubeMX projects, `idf.py`, `platformio.ini`, Linux / Webots directories, vendor SDK directories.',
  '- If key files are concentrated around `driver`, `system`, `USB`, `DAP`, `Debug`, protocol stacks, or device-enumeration logic, treat it first as a driver / XRUSB / debug project.',
  '',
  '## Repository classification',
  '- If the repository contains `Modules/modules.yaml`, treat it as an XRobot workspace; `xrobot describe` prints its configurations, locked modules, registrations, and diagnostics as JSON.',
  '- If the repository mainly centers on LibXR integration, platform bring-up, chip / board configuration, and driver implementation, treat it as a LibXR platform project.',
  '- If the repository mainly focuses on device interfaces, protocol stacks, debug links, or USB/CAN/UART implementation, treat it as a driver / XRUSB project.',
  '- If the repository mainly contains code generation, templates, examples, tests, or benchmarks, treat it as a tooling / example repository instead of forcing it into a board-porting flow.',
  '- If multiple entry styles coexist, describe the evidence first and then pick the main entry point. Do not jump straight to one tool command.',
  '',
  '## Documentation entry points',
  '- Overview: https://xrobot.work/docs/intro',
  '- Design concepts: https://xrobot.work/docs/concept',
  '- Environment setup: https://xrobot.work/docs/env_setup',
  '- Basic coding: https://xrobot.work/docs/basic_coding',
  '- Project management (XRobot): https://xrobot.work/docs/proj_man',
  '- XRUSB: https://xrobot.work/docs/xrusb',
  '- Debug: https://xrobot.work/docs/debug',
  '',
  '## Entry selection rules',
  '- Only prioritize `proj_man`, `xrobot setup`, `xrobot describe`, `Modules/`, and `User/` after confirming that the repository is an XRobot workspace.',
  '- For a LibXR platform project, start from `env_setup`, `concept`, and `basic_coding`, then drill into the actual platform page.',
  '- For driver or device-interface problems, move to `xrusb`, `debug`, and `basic_coding/driver`.',
  '- For runtime mechanisms such as middleware, messaging, scheduling, or Topic semantics, go to the corresponding `basic_coding` sections first.',
  '- If the repository is only a platform project or chip-specific project, do not force it into an XRobot workspace explanation.',
  '',
  '## How to proceed when there is a problem',
  '- First identify which layer the problem belongs to: environment, project workflow, runtime semantics, or driver / XRUSB.',
  '- Open the corresponding docs links above first. Do not guess APIs or directory structure without the docs.',
  '- If the docs are not enough, continue by combining the current repository code and command output.',
  '- If it is still unresolved, provide a minimal problem statement, command output, and environment details before asking for help.',
  '',
  '## What to include when asking for help',
  '- Include the current platform, target chip / system, commands used, and the exact error message.',
  '- For XRobot workspace problems, include the relevant file state under `Modules/` and `User/` first.',
  '- For LibXR platform-project problems, include the relevant state of `CMakeLists.txt`, `CMakePresets.json`, platform config files, and `libxr_config.yaml` first.',
  '- For driver, XRUSB, debug, or runtime problems, include the related source location, a minimal repro, and logs.',
  '',
  '## Extra entry',
  '- Onboarding guide: https://xrobot.work/XRobot-Onboarding/',
].join('\n');

type AgentPromptStatus = 'idle' | 'copied' | 'downloaded' | 'copy-failed';

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}


function VersionCard(): JSX.Element {
  return (
    <div className="homeVersionCard homeMetaCard">
      <div className="homePanelEyebrow">
        <Translate id="homepage.versionCard.eyebrow">Documentation Baseline</Translate>
      </div>
      <div className="homeVersionList">
        <div className="homeVersionItem">
          <span>XRobot</span>
          <code>{commitInfo.XRobot || 'N/A'}</code>
        </div>
        <div className="homeVersionItem">
          <span>LibXR</span>
          <code>{commitInfo.LibXR || 'N/A'}</code>
        </div>
        <div className="homeVersionItem">
          <span>CodeGen</span>
          <code>{commitInfo.CodeGen || 'N/A'}</code>
        </div>
      </div>
    </div>
  );
}

export default function Home(): JSX.Element {
  const {i18n} = useDocusaurusContext();
  const isEnglish = i18n.currentLocale === 'en';
  const agentQuickDeployPrompt = isEnglish ? agentQuickDeployPromptEn : agentQuickDeployPromptZh;
  const [isAgentPromptOpen, setIsAgentPromptOpen] = React.useState(false);
  const [agentPromptStatus, setAgentPromptStatus] = React.useState<AgentPromptStatus>('idle');

  React.useEffect(() => {
    if (!isAgentPromptOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAgentPromptOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAgentPromptOpen]);

  const handleAgentPromptOpen = () => {
    setAgentPromptStatus('idle');
    setIsAgentPromptOpen(true);
  };

  const handleAgentPromptClose = () => {
    setIsAgentPromptOpen(false);
  };

  const handleAgentPromptDownload = () => {
    const blob = new Blob([agentQuickDeployPrompt], {type: 'text/markdown;charset=utf-8'});
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = agentQuickDeployFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    setAgentPromptStatus('downloaded');
  };

  const handleAgentPromptCopy = async () => {
    try {
      await copyTextToClipboard(agentQuickDeployPrompt);
      setAgentPromptStatus('copied');
    } catch (error) {
      setAgentPromptStatus('copy-failed');
    }
  };

  return (
    <Layout
      title={translate({ message: '首页', id: 'homepage.title' })}
      description={translate({
        message: 'XRobot 与 LibXR 的开发文档。',
        id: 'homepage.description',
      })}
    >
      <main className="homePage">
        <div className="homeBackdrop" />

        <section className="homeHero">
          <div className="container homeHeroColumns">
            <div className="homeHeroColumn homeHeroColumnMain">
              <div className="homeHeroCopy">
                <div className="homeEyebrow">XRobot / LibXR / XRUSB</div>

                <h1 className="homeTitle">
                  <Translate id="homepage.hero.title">XRobot / LibXR</Translate>
                </h1>

                <p className="homeLead">
                  <Translate id="homepage.hero.lead">
                    面向机器人开发、设备接口与工程自动化的模块化框架。XRobot 负责包管理、项目组织和代码生成，LibXR 提供核心语义、驱动抽象与 XRUSB。
                  </Translate>
                </p>

                <div className="homeActionRow">
                  <Link className="button button--lg homeButton homeButtonPrimary" to="/docs/intro">
                    <Translate id="homepage.hero.cta.read">开始阅读</Translate>
                  </Link>
                  <Link className="button button--lg homeButton homeButtonSecondary" to="/docs/concept">
                    <Translate id="homepage.hero.cta.concept">理解设计思想</Translate>
                  </Link>
                  <Link
                    className="button button--lg homeButton homeButtonSecondary"
                    to={isEnglish
                      ? 'https://xrobot.work/libxr_web_demo/index_en.html'
                      : 'https://xrobot.work/libxr_web_demo/'}
                  >
                    <Translate id="homepage.hero.cta.demo">Web Demo</Translate>
                  </Link>
                  <Link className="button button--lg homeButton homeButtonGhost" to="/docs/proj_man">
                    <Translate id="homepage.hero.cta.xrobot">查看 XRobot</Translate>
                  </Link>
                </div>

                <div className="homeHeroFlowRail" aria-label="Abstract Module Workflow shortcuts">
                  <Link className="homeHeroFlowStep homeHeroFlowStepAbstract" to="/docs/basic_coding/driver">
                    <span className="homeHeroFlowStepKicker">Abstract</span>
                    <strong>{isEnglish ? 'Platform Abstraction' : '平台抽象'}</strong>
                    <div className="homeHeroFlowMini homeHeroFlowMiniAbstract">
                      <div className="homeHeroFlowMiniRow homeHeroFlowMiniRowFour">
                        <span className="homeHeroFlowMiniChip">STM32</span>
                        <span className="homeHeroFlowMiniChip">ESP32</span>
                        <span className="homeHeroFlowMiniChip">Linux</span>
                        <span className="homeHeroFlowMiniChip">...</span>
                      </div>
                      <div className="homeHeroFlowMiniMerge" />
                      <span className="homeHeroFlowMiniCore">XR API</span>
                    </div>
                  </Link>

                  <Link className="homeHeroFlowStep homeHeroFlowStepModule" to="/docs/basic_coding/middleware">
                    <span className="homeHeroFlowStepKicker">Module</span>
                    <strong>{isEnglish ? 'Module Composition' : '模块编排'}</strong>
                    <div className="homeHeroFlowMini homeHeroFlowMiniModule">
                      <span className="homeHeroFlowMiniPill homeHeroFlowMiniPillTop">Feature</span>
                      <div className="homeHeroFlowMiniBridge" />
                      <div className="homeHeroFlowMiniRow homeHeroFlowMiniRowTwo">
                        <span className="homeHeroFlowMiniPill">Driver</span>
                        <span className="homeHeroFlowMiniPill">Middleware</span>
                      </div>
                    </div>
                  </Link>

                  <Link className="homeHeroFlowStep homeHeroFlowStepWorkflow" to="/docs/proj_man">
                    <span className="homeHeroFlowStepKicker">Workflow</span>
                    <strong>{isEnglish ? 'Project Workflow' : '工程工作流'}</strong>
                    <div className="homeHeroFlowMini homeHeroFlowMiniWorkflow">
                      <div className="homeHeroWorkflowGrid">
                        <span className="homeHeroFlowMiniCmd">CodeGen</span>
                        <span className="homeHeroWorkflowArrowInline">→</span>
                        <span className="homeHeroFlowMiniCmd">Build</span>
                        <span className="homeHeroWorkflowDrop">↓</span>
                        <span className="homeHeroFlowMiniCmd">CI/CD</span>
                        <span className="homeHeroWorkflowArrowInline">→</span>
                        <span className="homeHeroFlowMiniDemo">Deploy</span>
                      </div>
                    </div>
                  </Link>
                </div>

                <div className="homeGuideGrid homeGuideGridInline">
                  <Link className="homeGuideCard" to="https://xrobot.work/XRobot-Onboarding/">
                    <span className="homeGuideTag">Guide</span>
                    <h3>
                      <Translate id="homepage.guide.onboarding.title">新手任务引导</Translate>
                    </h3>
                    <p>
                      <Translate id="homepage.guide.onboarding.desc">
                        按平台选择合适的起步路径，逐步了解 XR 的设计理念与基础写法。
                      </Translate>
                    </p>
                  </Link>

                  <button type="button" className="homeGuideCard homeGuideCardButton" onClick={handleAgentPromptOpen}>
                    <span className="homeGuideTag">Agent</span>
                    <h3>
                      <Translate id="homepage.guide.agent.title">Agent 快速部署</Translate>
                    </h3>
                    <p>
                      <Translate id="homepage.guide.agent.desc">
                        给 XRobot / LibXR 专用助手的一页启动上下文，先判断仓库角色，再进入对应文档和代码入口。
                      </Translate>
                    </p>
                  </button>

                </div>
              </div>
            </div>

            <div className="homeHeroColumn homeHeroColumnSide">
              <div className="homeHeroPanel">
                <div className="homePanelSurface">
                  <div className="homePanelHeader">
                    <div className="homePanelTitleBlock">
                      <div className="homePanelEyebrow">
                        <Translate id="homepage.panel.eyebrow">Document Entry Map</Translate>
                      </div>
                      <h2>
                        <Translate id="homepage.panel.title">从当前任务直接进入文档</Translate>
                      </h2>
                    </div>
                    <div className="homePanelState">
                      <span className="homePanelDot" />
                      docs live
                    </div>
                  </div>

                  <div className="homeRouteGrid">
                    <Link className="homeRouteCard" to="/docs/proj_man">
                      <span className="homeRouteTag">XRobot</span>
                      <strong>
                        <Translate id="homepage.route.xrobot.title">工程与工作流</Translate>
                      </strong>
                      <p>
                        <Translate id="homepage.route.xrobot.desc">
                          包管理、项目管理、代码生成和日常开发流程。
                        </Translate>
                      </p>
                    </Link>

                    <Link className="homeRouteCard" to="/docs/basic_coding/core">
                      <span className="homeRouteTag">Core</span>
                      <strong>
                        <Translate id="homepage.route.core.title">核心语义</Translate>
                      </strong>
                      <p>
                        <Translate id="homepage.route.core.desc">
                          回调、事件、消息、时间、内存与基础抽象。
                        </Translate>
                      </p>
                    </Link>

                    <Link className="homeRouteCard" to="/docs/basic_coding/driver">
                      <span className="homeRouteTag">Drivers</span>
                      <strong>
                        <Translate id="homepage.route.driver.title">驱动与 XRUSB</Translate>
                      </strong>
                      <p>
                        <Translate id="homepage.route.driver.desc">
                          外设抽象、平台实现，以及属于驱动层的 XRUSB。
                        </Translate>
                      </p>
                    </Link>

                    <Link className="homeRouteCard" to="/docs/env_setup">
                      <span className="homeRouteTag">Start</span>
                      <strong>
                        <Translate id="homepage.route.start.title">环境与上手</Translate>
                      </strong>
                      <p>
                        <Translate id="homepage.route.start.desc">
                          平台选择、环境配置和第一个 Demo。
                        </Translate>
                      </p>
                    </Link>
                  </div>
                </div>
              </div>

              <VersionCard />
            </div>
          </div>
        </section>

        <section className="homeSection">
          <div className="container">
            <div className="homeSectionHead">
              <div className="homeSectionEyebrow">
                <Translate id="homepage.quick.eyebrow">Quick Paths</Translate>
              </div>
              <h2>
                <Translate id="homepage.quick.title">按常见场景进入</Translate>
              </h2>
              <p>
                <Translate id="homepage.quick.desc">
                  这里回答的不是“文档分几类”，而是“你现在手上要解决什么问题”。
                </Translate>
              </p>
            </div>

            <div className="homePathGrid">
              <Link className="homePathCard" to="/docs/intro">
                <span className="homePathIndex">01</span>
                <h3>
                  <Translate id="homepage.path.intro.title">我第一次接触 LibXR / XRobot</Translate>
                </h3>
                <p>
                  <Translate id="homepage.path.intro.desc">
                    先看整体概念、目录结构和最小使用路径，再决定往哪一层深入。
                  </Translate>
                </p>
              </Link>

              <Link className="homePathCard" to="/docs/basic_coding/driver">
                <span className="homePathIndex">02</span>
                <h3>
                  <Translate id="homepage.path.core.title">我要移植到新硬件平台</Translate>
                </h3>
                <p>
                  <Translate id="homepage.path.core.desc">
                    从驱动抽象、平台实现和基础外设能力开始，先把板级承载层看清楚。
                  </Translate>
                </p>
              </Link>

              <Link className="homePathCard" to="/docs/xrusb">
                <span className="homePathIndex">03</span>
                <h3>
                  <Translate id="homepage.path.driver.title">我要处理设备侧接口与链路</Translate>
                </h3>
                <p>
                  <Translate id="homepage.path.driver.desc">
                    从设备接口、协议栈和链路实现开始，查看设备通信、识别与更新相关内容。
                  </Translate>
                </p>
              </Link>

              <Link className="homePathCard" to="/docs/proj_man/proj-man-setup">
                <span className="homePathIndex">04</span>
                <h3>
                  <Translate id="homepage.path.usb.title">我要把工程快速跑起来</Translate>
                </h3>
                <p>
                  <Translate id="homepage.path.usb.desc">
                    先区分这是 XRobot workspace 还是普通 LibXR 工程；如果准备让 Agent 先判断入口，首页这份提示词可以直接用。
                  </Translate>
                </p>
              </Link>
            </div>

          </div>
        </section>

        <section className="homeSection homeSectionContrast">
          <div className="container homeRecentGrid">
            <div className="homeSectionHead homeSectionHeadCompact">
              <div className="homeSectionEyebrow">
                <Translate id="homepage.recent.eyebrow">Recent Direction</Translate>
              </div>
              <h2>
                <Translate id="homepage.recent.title">近期开发动态</Translate>
              </h2>
              <p>
                <Translate id="homepage.recent.desc">
                  这里展示最近已经启动或正在推进的方向，方便你判断哪些能力正在扩展中。
                </Translate>
              </p>
            </div>

            <div className="homeRecentList">
              <div className="homeRecentItem">
                <span className="homeRecentTag">Platform</span>
                <h3>
                  <Translate id="homepage.recent.core.title">平台驱动已覆盖 MSPM0、HPM、ESP、CH32、STM32</Translate>
                </h3>
                <p>
                  <Translate id="homepage.recent.core.desc">
                    当前主线已经包含多平台驱动目录；查看具体平台前，先按仓库和目标芯片确认自己实际落在哪一条实现线上。
                  </Translate>
                </p>
              </div>

              <div className="homeRecentItem">
                <span className="homeRecentTag">XRUSB</span>
                <h3>
                  <Translate id="homepage.recent.linux.title">XRUSB 已覆盖 CDC、DAP、DFU、GSUSB、HID、UAC</Translate>
                </h3>
                <p>
                  <Translate id="homepage.recent.linux.desc">
                    设备侧能力已经不只是一条单一协议线。进入 XRUSB 文档前，先确认你要看的是哪一类 device class。
                  </Translate>
                </p>
              </div>

              <div className="homeRecentItem">
                <span className="homeRecentTag">Debug</span>
                <h3>
                  <Translate id="homepage.recent.usb.title">调试链路以 SWD 为主，相关实现已分层整理</Translate>
                </h3>
                <p>
                  <Translate id="homepage.recent.usb.desc">
                    当前文档和代码里与调试最相关的是 SWD、GPIO 时序实现和 CMSIS-DAP 设备类；不要先假定存在完整 JTAG 业务路径。
                  </Translate>
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="homeSection">
          <div className="container">
            <div className="homeSectionHead">
              <div className="homeSectionEyebrow">
                <Translate id="homepage.focus.eyebrow">Focus Areas</Translate>
              </div>
              <h2>
                <Translate id="homepage.focus.title">先判断你现在在解决哪一类问题</Translate>
              </h2>
              <p>
                <Translate id="homepage.focus.desc">
                  大多数问题都落在这三类：理解机制、接硬件、跑工程。
                </Translate>
              </p>
            </div>

            <div className="homeFocusGrid">
              <div className="homeFocusCard">
                <span className="homeFocusTag">Semantics</span>
                <h3>
                  <Translate id="homepage.focus.core.title">当你在搞清系统怎么工作</Translate>
                </h3>
                <p>
                  <Translate id="homepage.focus.core.desc">
                    先看 callback、event、message 和中间件关系，把系统内部怎么运转先看明白。
                  </Translate>
                </p>
                <div className="homeMiniLinks">
                  <Link to="/docs/basic_coding/core">Core</Link>
                  <Link to="/docs/basic_coding/middleware">Middleware</Link>
                  <Link to="/docs/basic_coding/system">System</Link>
                </div>
              </div>

              <div className="homeFocusCard">
                <span className="homeFocusTag">Platform</span>
                <h3>
                  <Translate id="homepage.focus.driver.title">当你在接硬件和做移植</Translate>
                </h3>
                <p>
                  <Translate id="homepage.focus.driver.desc">
                    先看驱动、平台实现、XRUSB 和调试链路，搞清板子、外设和接口怎么接进来。
                  </Translate>
                </p>
                <div className="homeMiniLinks">
                  <Link to="/docs/basic_coding/driver">Driver</Link>
                  <Link to="/docs/xrusb">XRUSB</Link>
                  <Link to="/docs/debug">Debug</Link>
                </div>
              </div>

              <div className="homeFocusCard">
                <span className="homeFocusTag">Workflow</span>
                <h3>
                  <Translate id="homepage.focus.project.title">当你在把工程跑起来</Translate>
                </h3>
                <p>
                  <Translate id="homepage.focus.project.desc">
                    先让 Agent 判断工程类型，再决定走 workspace、平台工程还是驱动入口，把初始化路径选对。
                  </Translate>
                </p>
                <div className="homeMiniLinks">
                  <Link to="/docs/proj_man/proj-man-setup">Setup</Link>
                  <button type="button" onClick={handleAgentPromptOpen}>
                    Agent Prompt
                  </button>
                  <Link to="/docs/code_gen">Code Gen</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isAgentPromptOpen ? (
          <div className="homeAgentModalBackdrop" role="presentation" onClick={handleAgentPromptClose}>
            <div
              className="homeAgentModal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="home-agent-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="homeAgentModalHeader">
                <div>
                  <div className="homePanelEyebrow">Agent Prompt</div>
                  <h2 id="home-agent-modal-title">
                    {isEnglish ? 'Agent Quick Start' : 'Agent 快速部署'}
                  </h2>
                </div>
                <button
                  type="button"
                  className="homeAgentModalClose"
                  onClick={handleAgentPromptClose}
                  aria-label={isEnglish ? 'Close Agent prompt dialog' : '关闭 Agent 提示词弹框'}
                >
                  ×
                </button>
              </div>
              <p className="homeAgentModalLead">
                {isEnglish
                  ? 'This prompt makes the Agent classify the repository as a workspace, platform project, or driver project first, then locks down the doc entry points and decision order so it does not start from the wrong path.'
                  : '这份提示词先让 Agent 判断当前工程属于 workspace、平台工程还是驱动工程，再把文档入口和后续判断顺序钉住，避免一上来就走错链路。'}
              </p>
              <div className="homeAgentModalMeta">
                <span>{isEnglish ? 'Filename' : '文件名'}</span>
                <code>{agentQuickDeployFilename}</code>
              </div>
              <div className="homeAgentModalLinks">
                <Link className="homeAgentModalLink" to="/docs/proj_man/proj-man-setup">
                  {isEnglish ? 'Setup Guide' : '一键配置文档'}
                </Link>
                <Link className="homeAgentModalLink" to="/docs/proj_man">
                  {isEnglish ? 'Project Management' : '项目管理总览'}
                </Link>
                <Link className="homeAgentModalLink" to="https://xrobot.work/XRobot-Onboarding/">
                  {isEnglish ? 'Onboarding Guide' : '新手任务引导'}
                </Link>
              </div>
              <pre className="homeAgentModalPreview">{agentQuickDeployPrompt}</pre>
              <div className="homeAgentModalActions">
                <button type="button" className="homeAgentModalAction is-primary" onClick={handleAgentPromptDownload}>
                  {isEnglish ? 'Download Prompt .md' : '下载提示词 .md'}
                </button>
                <button type="button" className="homeAgentModalAction" onClick={() => void handleAgentPromptCopy()}>
                  {isEnglish ? 'Copy' : '直接复制'}
                </button>
              </div>
              <p className="homeAgentModalStatus" aria-live="polite">
                {agentPromptStatus === 'copied'
                  ? isEnglish
                    ? 'Copied to clipboard.'
                    : '已复制到剪贴板。'
                  : agentPromptStatus === 'downloaded'
                    ? isEnglish
                      ? 'Markdown download started.'
                      : 'Markdown 文件已开始下载。'
                    : agentPromptStatus === 'copy-failed'
                      ? isEnglish
                        ? 'Copy failed. Please use download instead.'
                        : '复制失败，请改用下载。'
                      : isEnglish
                        ? 'This prompt is for classifying the repository first, then deciding which docs or commands should come next.'
                        : '提示词用于先判定工程类型，再决定后续该进哪份文档或执行哪一步。'}
              </p>
            </div>
          </div>
        ) : null}

        <section className="homeSection homeSectionFoot">
          <div className="container homeFootGrid">
            <div className="homeFootCopy">
              <div className="homeSectionEyebrow">
                <Translate id="homepage.foot.eyebrow">Project</Translate>
              </div>
              <h2>
                <Translate id="homepage.foot.title">项目背景与社区入口</Translate>
              </h2>
              <p>
                <Translate id="homepage.foot.desc">
                  这里放项目起源、参与方式和开发者社区入口，适合在深入技术内容前先了解项目本身。
                </Translate>
              </p>
            </div>

            <div className="homeFootPanel">
              <Link className="homeFootStat" to="/docs/about">
                <span>About</span>
                <strong>{isEnglish ? 'Project Background' : '项目起源'}</strong>
              </Link>
              <Link className="homeFootStat" to="/docs/con_guide">
                <span>Contribute</span>
                <strong>{isEnglish ? 'Contribution Guide' : '贡献指南'}</strong>
              </Link>
              <Link className="homeFootStat" to="https://github.com/xrobot-org">
                <span>Community</span>
                <strong>{isEnglish ? 'Developers & Repos' : '开发者与仓库'}</strong>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
