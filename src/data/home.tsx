/**
 * Home page content: copy, links and widget choices. Change text and links here; the page
 * (src/pages/index.tsx) only lays them out. Every visible string goes through translate();
 * English is in i18n/en/code.json under the same id. Backticks mark inline code.
 */
import { translate } from '@docusaurus/Translate';
import type { ShowcaseSectionProps } from '@site/src/components/showcase/ShowcaseSection';

export const links = {
  webDemoZh: 'https://xrobot.work/libxr_web_demo/',
  webDemoEn: 'https://xrobot.work/libxr_web_demo/index_en.html',
  onboarding: 'https://xrobot.work/XRobot-Onboarding/',
  github: 'https://github.com/xrobot-org',
  modulesRepo: 'https://github.com/xrobot-org/xrobot-modules',
};

export type HeroAction = { label: string; href: string; primary?: boolean };

/** First-screen buttons. */
export function heroActions(isEnglish: boolean): HeroAction[] {
  return [
    { href: '/docs/quick_start', primary: true, label: translate({ id: 'home.hero.cta.quickStart', message: '快速开始' }) },
    { href: '/docs/intro', label: translate({ id: 'home.hero.cta.read', message: '阅读文档' }) },
    { href: isEnglish ? links.webDemoEn : links.webDemoZh, label: translate({ id: 'home.hero.cta.demo', message: '试用 Web Demo' }) },
    { href: links.onboarding, label: translate({ id: 'home.hero.cta.onboarding', message: '查看新手引导' }) },
  ];
}

export type VersionRow = { name: string; key: string; href: (value: string) => string | undefined };

const releaseVersion = /^\d[\w.]*$/;

/**
 * Documentation baseline: the keys of src/data/commitInfo.json, which scripts/fetch-commits.js writes before the build
 * (the released pip versions of xrobot and libxr, the LibXR commit on master).
 */
export const versionRows: VersionRow[] = [
  { name: 'xrobot', key: 'xrobotVersion', href: (v) => (releaseVersion.test(v) ? `https://pypi.org/project/xrobot/${v}/` : undefined) },
  { name: 'libxr (CodeGenerator)', key: 'codegenVersion', href: (v) => (releaseVersion.test(v) ? `https://pypi.org/project/libxr/${v}/` : undefined) },
  { name: 'LibXR master', key: 'libxrCommit', href: (v) => (/^[0-9a-f]{7,40}$/.test(v) ? `https://github.com/xrobot-org/libxr/commit/${v}` : undefined) },
];

export type Chapter = { path: string; label: string; href: string };

/** Top-level chapters in sidebar order (after the welcome and quick start pages), shown in the first screen. */
export function chapters(): Chapter[] {
  return [
    { path: 'SETUP', href: '/docs/env_setup', label: translate({ id: 'home.chapter.setup', message: '环境配置' }) },
    { path: 'LIBXR', href: '/docs/basic_coding', label: translate({ id: 'home.chapter.basic', message: '基础编程' }) },
    { path: 'CODEGEN', href: '/docs/code_gen', label: translate({ id: 'home.chapter.codegen', message: '代码生成' }) },
    { path: 'XROBOT', href: '/docs/proj_man', label: translate({ id: 'home.chapter.projman', message: '项目管理' }) },
    { path: 'DEBUG', href: '/docs/debug', label: translate({ id: 'home.chapter.debug', message: '调试接口' }) },
    { path: 'XRUSB', href: '/docs/xrusb', label: translate({ id: 'home.chapter.xrusb', message: 'XRUSB' }) },
    { path: 'LIBXR', href: '/docs/adv_coding', label: translate({ id: 'home.chapter.advanced', message: '进阶编程' }) },
    { path: 'CONCEPT', href: '/docs/concept', label: translate({ id: 'home.chapter.concept', message: '设计思想' }) },
  ];
}

export type FigureSpec = {
  src: string;
  ratio: number;
  alt: string;
  caption?: string;
  /** Command lines shown under the illustration (taken from the docs, without output). */
  commands?: string;
  commandsTitle?: string;
};

export type Capability = Omit<ShowcaseSectionProps, 'fallback'> & { figure?: FigureSpec };

/**
 * Capability sections, in page order. `widget.name` is a directory under
 * src/components/showcase; until it exists the section shows `figure`.
 */
export function capabilities(isEnglish: boolean): Capability[] {
  return [
    {
      id: 'web-terminal',
      path: 'LIBXR / WEBASSEMBLY / TERMINAL',
      title: translate({ id: 'home.cap.terminal.title', message: 'LibXR 的命令行终端在浏览器中运行' }),
      body: [
        translate({
          id: 'home.cap.terminal.p1',
          message:
            '这里的终端是 LibXR 编译成 WebAssembly 后在浏览器中运行的程序。`Terminal` 提供行编辑、历史记录和路径补全，按路径运行 `RamFS` 中的命令。',
        }),
        translate({
          id: 'home.cap.terminal.p2',
          message: '在单片机上，同一个 `Terminal` 通过串口或 USB 虚拟串口提供命令行。',
        }),
      ],
      tags: ['Terminal', 'RamFS', 'WebAssembly'],
      docs: [
        { href: '/docs/basic_coding/middleware/terminal', label: translate({ id: 'home.cap.terminal.doc1', message: '命令行终端' }) },
        { href: '/docs/basic_coding/middleware/ramfs', label: translate({ id: 'home.cap.terminal.doc2', message: '内存文件系统' }) },
        { href: isEnglish ? links.webDemoEn : links.webDemoZh, label: translate({ id: 'home.cap.terminal.doc3', message: 'Web Demo 全屏版' }) },
      ],
      layout: 'left',
      widget: { name: 'WebTerminal', height: { desktop: 400, mobile: 480 } },
      figure: {
        src: '/showcase/img/terminal.svg',
        ratio: 640 / 300,
        alt: translate({ id: 'home.cap.terminal.figAlt', message: '终端窗口线稿' }),
        caption: translate({ id: 'home.cap.terminal.figCaption', message: '终端在浏览器中加载 LibXR 的 WebAssembly 程序。' }),
      },
    },
    {
      id: 'uart-rx',
      path: 'LIBXR / UART / READPORT',
      title: translate({ id: 'home.cap.ring.title', message: '串口接收：硬件持续写入，软件按需读取' }),
      body: [
        translate({
          id: 'home.cap.ring.p1',
          message:
            'MCU 上的串口驱动让接收 DMA 一直运行。中断根据 DMA 的写指针算出新增的字节，用 `PushBatch` 写入 `ReadPort` 的环形队列 `SPSCQueue`，再调用 `Publish()` 完成挂起的读请求。',
        }),
        translate({
          id: 'home.cap.ring.p2',
          message: '接收路径中没有停下 DMA 再重新启动的一步，软件只负责追赶硬件的写指针。',
        }),
      ],
      tags: ['ReadPort', 'SPSCQueue', 'DMA'],
      docs: [
        { href: '/docs/adv_coding/driver/adv-coding-drv-uart-driver', label: translate({ id: 'home.cap.ring.doc1', message: '串口驱动设计' }) },
        { href: '/docs/basic_coding/core/core-rw', label: translate({ id: 'home.cap.ring.doc2', message: 'IO 读写抽象' }) },
        { href: '/docs/basic_coding/structure/spsc_queue', label: 'SPSCQueue' },
      ],
      layout: 'right',
      widget: { name: 'RingBuffer', height: { desktop: 600, mobile: 1000 } },
      figure: {
        src: '/showcase/img/ring.svg',
        ratio: 640 / 300,
        alt: translate({ id: 'home.cap.ring.figAlt', message: 'DMA 写入环形队列的线稿' }),
      },
    },
    {
      id: 'topic',
      path: 'LIBXR / MESSAGE / TOPIC',
      title: translate({ id: 'home.cap.topic.title', message: 'Topic：精确类型的发布订阅' }),
      body: [
        translate({
          id: 'home.cap.topic.p1',
          message:
            '`Topic` 是进程内、精确类型的发布订阅通道。发布时同步分发给已注册的订阅者，订阅者以同步、异步、队列或回调四种方式之一接收。',
        }),
        translate({
          id: 'home.cap.topic.p2',
          message:
            'Linux 上的 `LinuxSharedTopic` 把数据放在共享内存的槽位中，订阅者通过描述符读取同一块内存，进程之间不复制数据。',
        }),
      ],
      tags: ['Topic', 'LinuxSharedTopic'],
      docs: [
        { href: '/docs/basic_coding/middleware/message/message-topic', label: translate({ id: 'home.cap.topic.doc1', message: 'Topic 基础、订阅与分发语义' }) },
        { href: '/docs/basic_coding/middleware/message/message-linux-shared-topic', label: translate({ id: 'home.cap.topic.doc2', message: '共享内存 Topic（Linux）' }) },
        { href: '/docs/adv_coding/middleware/adv-coding-middleware-topic-design', label: translate({ id: 'home.cap.topic.doc3', message: 'Topic 设计' }) },
      ],
      layout: 'left',
      widget: { name: 'TopicFanout', height: { desktop: 580, mobile: 800 } },
      figure: {
        src: '/showcase/img/topic.svg',
        ratio: 640 / 220,
        alt: translate({ id: 'home.cap.topic.figAlt', message: '一个发布者、四种订阅者与共享内存槽位的线稿' }),
        caption: translate({
          id: 'home.cap.topic.figCaption',
          message: '左：发布者经 Topic 分发给同步、异步、队列、回调四种订阅者。右：两个 Linux 进程通过共享内存槽位交换数据。',
        }),
      },
    },
    {
      id: 'workflow',
      path: 'XROBOT / MODULES / CI',
      title: translate({ id: 'home.cap.workflow.title', message: '模块的拉取、锁定与主函数生成' }),
      body: [
        translate({
          id: 'home.cap.workflow.p1',
          message:
            'BSP 在 `Modules/modules.yaml` 中列出需要的模块。`xrobot setup` 拉取模块并把每个模块锁定到 `xrobot.lock` 中的具体提交，`xrobot gen` 根据 `User/` 下的配置生成主函数 `XRobotMain`。',
        }),
        translate({
          id: 'home.cap.workflow.p2',
          message: 'STM32 BSP 的 CI 调用共享工作流：检查生成的文件与提交一致，构建每份配置，并在推送到 `master`、打 `v*` tag 或发布 Release 时上传固件。',
        }),
      ],
      tags: ['xrobot.lock', 'XRobotMain', 'CI'],
      docs: [
        { href: '/docs/proj_man', label: translate({ id: 'home.cap.workflow.doc1', message: '项目管理（XRobot）' }) },
        { href: '/docs/proj_man/proj-man-setup', label: translate({ id: 'home.cap.workflow.doc2', message: '模块请求与锁定' }) },
        { href: '/docs/proj_man/proj-man-gen-main', label: translate({ id: 'home.cap.workflow.doc3', message: '入口与生成' }) },
        { href: '/docs/proj_man/proj-man-ci', label: translate({ id: 'home.cap.workflow.doc4', message: 'CI 与固件发布' }) },
      ],
      layout: 'right',
      widget: { name: 'ModuleFlow', height: { desktop: 460, mobile: 860 } },
      figure: {
        src: '/showcase/img/workflow.svg',
        ratio: 640 / 200,
        alt: translate({ id: 'home.cap.workflow.figAlt', message: '模块仓库、lock、生成的头文件与固件的线稿' }),
        commandsTitle: translate({ id: 'home.cap.workflow.cmdTitle', message: 'BSP 根目录' }),
        commands: [
          '$ xrobot module add xrobot-org/BlinkLED@dev',
          '$ xrobot setup',
          '$ xrobot instance add xrobot-org/BlinkLED',
          '$ xrobot instance set blinkled_0 args.led LED',
          '$ xrobot gen',
        ].join('\n'),
      },
    },
    {
      id: 'xrusb',
      path: 'LIBXR / XRUSB / DAP',
      title: translate({ id: 'home.cap.xrusb.title', message: 'XRUSB：设备侧 USB 协议栈与调试接口' }),
      body: [
        translate({
          id: 'home.cap.xrusb.p1',
          message:
            'XRUSB 是 LibXR 中的 USB 设备协议栈，提供 CDC、HID、UAC、GSUSB、CMSIS-DAP v1/v2 和 DFU 等设备类，一个设备可以同时包含多个设备类。',
        }),
        translate({
          id: 'home.cap.xrusb.p2',
          message: '调试接口部分用 GPIO 时序实现 SWD 与 JTAG，DAPLink 设备类通过它们访问目标芯片，例如读取 DP 的 `IDCODE`。',
        }),
      ],
      tags: ['CDC', 'DAPLink', 'DFU', 'SWD'],
      docs: [
        { href: '/docs/xrusb', label: translate({ id: 'home.cap.xrusb.doc1', message: 'XRUSB 协议栈' }) },
        { href: '/docs/xrusb/dev_stack', label: translate({ id: 'home.cap.xrusb.doc2', message: '设备协议栈' }) },
        { href: '/docs/debug', label: translate({ id: 'home.cap.xrusb.doc3', message: '调试接口' }) },
      ],
      layout: 'left',
      widget: { name: 'UsbDebug', height: { desktop: 520, mobile: 960 } },
      figure: {
        src: '/showcase/img/xrusb.svg',
        ratio: 640 / 230,
        alt: translate({ id: 'home.cap.xrusb.figAlt', message: '主机、调试器与目标板连接的线稿' }),
        caption: translate({
          id: 'home.cap.xrusb.figCaption',
          message: '主机经 USB 连接运行 XRUSB 的调试器，调试器经 SWD 连接目标板。',
        }),
      },
    },
    {
      id: 'robots',
      path: 'XROBOT / MODULES / ROBOTS',
      title: translate({ id: 'home.cap.robots.title', message: '由模块组成的机器人' }),
      body: [
        translate({
          id: 'home.cap.robots.p1',
          message:
            '官方模块源包含 IMU、磁力计、气压计、光流、激光测距、灰度循迹、遥控接收、显示屏和姿态解算等模块。',
        }),
        translate({
          id: 'home.cap.robots.p2',
          message: '一份配置选择模块并填写参数，`xrobot gen` 由它生成一台机器人的主函数；不同的配置组成不同机器人的固件。',
        }),
      ],
      tags: ['Module', 'BSP'],
      docs: [
        { href: '/docs/proj_man/proj-man-source-man', label: translate({ id: 'home.cap.robots.doc1', message: '模块源' }) },
        { href: '/docs/proj_man/proj-man-config', label: translate({ id: 'home.cap.robots.doc2', message: '应用配置' }) },
        { href: '/docs/proj_man/proj-man-create-mod', label: translate({ id: 'home.cap.robots.doc3', message: '编写模块' }) },
      ],
      layout: 'right',
      widget: { name: 'RobotModules', height: { desktop: 660, mobile: 810 } },
      figure: {
        src: '/showcase/img/robots.svg',
        ratio: 640 / 240,
        alt: translate({ id: 'home.cap.robots.figAlt', message: '多旋翼、轮式底盘和机械臂的线稿' }),
        caption: translate({ id: 'home.cap.robots.figCaption', message: '多旋翼、轮式底盘、机械臂。' }),
      },
    },
  ];
}

export type RouteCard = { path: string; title: string; desc: string; href: string; more: Array<{ href: string; label: string }> };

/** Entry map: one route per project type (as on the welcome page), each with its sub-chapters. */
export function routes(): RouteCard[] {
  return [
    {
      path: 'LIBXR',
      href: '/docs/basic_coding',
      title: translate({ id: 'home.route.libxr.title', message: '只使用 LibXR' }),
      desc: translate({ id: 'home.route.libxr.desc', message: '在已有工程中使用 LibXR 的核心 API、外设驱动与中间件。' }),
      more: [
        { href: '/docs/basic_coding/core', label: translate({ id: 'home.route.libxr.more1', message: '核心 API' }) },
        { href: '/docs/basic_coding/driver', label: translate({ id: 'home.route.libxr.more2', message: '外设驱动' }) },
        { href: '/docs/basic_coding/middleware', label: translate({ id: 'home.route.libxr.more3', message: '中间件' }) },
      ],
    },
    {
      path: 'CODEGEN',
      href: '/docs/code_gen',
      title: translate({ id: 'home.route.codegen.title', message: 'STM32 与 CodeGenerator' }),
      desc: translate({
        id: 'home.route.codegen.desc',
        message: '由 STM32CubeMX 工程生成外设对象、入口函数 `app_main`，并接入 CMake 构建。',
      }),
      more: [
        { href: '/docs/env_setup/env-setup-stm32', label: translate({ id: 'home.route.codegen.more1', message: 'STM32 环境配置' }) },
        { href: '/docs/code_gen/stm32', label: translate({ id: 'home.route.codegen.more2', message: 'STM32 代码生成' }) },
        { href: '/docs/code_gen/code-gen-xrobot-inter', label: translate({ id: 'home.route.codegen.more3', message: '与 XRobot 集成' }) },
      ],
    },
    {
      path: 'XROBOT',
      href: '/docs/proj_man',
      title: translate({ id: 'home.route.xrobot.title', message: 'XRobot BSP' }),
      desc: translate({ id: 'home.route.xrobot.desc', message: '模块的拉取与锁定、配置和主函数生成。' }),
      more: [
        { href: '/docs/proj_man/proj-man-config', label: translate({ id: 'home.route.xrobot.more1', message: '应用配置' }) },
        { href: '/docs/proj_man/proj-man-create-mod', label: translate({ id: 'home.route.xrobot.more2', message: '编写模块' }) },
        { href: '/docs/proj_man/proj-man-ci', label: translate({ id: 'home.route.xrobot.more3', message: 'CI 与固件发布' }) },
      ],
    },
    {
      path: 'PORT',
      href: '/docs/adv_coding/adv-coding-porting',
      title: translate({ id: 'home.route.port.title', message: '移植到新平台' }),
      desc: translate({ id: 'home.route.port.desc', message: '新操作系统和新芯片需要实现的系统层与外设驱动。' }),
      more: [
        { href: '/docs/basic_coding/system', label: translate({ id: 'home.route.port.more1', message: '操作系统' }) },
        { href: '/docs/adv_coding/driver', label: translate({ id: 'home.route.port.more2', message: '驱动开发' }) },
        { href: '/docs/perf', label: translate({ id: 'home.route.port.more3', message: '关于性能' }) },
      ],
    },
  ];
}

export type Scenario = { index: string; title: string; desc: string; href: string };

/** Entry by common task. */
export function scenarios(): Scenario[] {
  return [
    {
      index: '01',
      href: '/docs/intro',
      title: translate({ id: 'home.path.intro.title', message: '初次接触 LibXR / XRobot' }),
      desc: translate({ id: 'home.path.intro.desc', message: 'LibXR、CodeGenerator 和 XRobot 的分工，以及按工程类型的阅读顺序。' }),
    },
    {
      index: '02',
      href: '/docs/adv_coding/adv-coding-porting',
      title: translate({ id: 'home.path.port.title', message: '移植到新的硬件平台' }),
      desc: translate({ id: 'home.path.port.desc', message: '新芯片新增外设驱动目录，新操作系统新增系统层目录，两层可以分别沿用已有实现。' }),
    },
    {
      index: '03',
      href: '/docs/xrusb',
      title: translate({ id: 'home.path.device.title', message: '设备侧接口与链路' }),
      desc: translate({ id: 'home.path.device.desc', message: '设备接口、协议栈和链路实现，包括设备通信、识别与更新。' }),
    },
    {
      index: '04',
      href: '/docs/quick_start',
      title: translate({ id: 'home.path.run.title', message: '构建第一个程序' }),
      desc: translate({ id: 'home.path.run.desc', message: '从安装工具到构建出第一个程序，起点可以是已有的 BSP、STM32CubeMX 工程或新建的 BSP。' }),
    },
  ];
}

export type RecentItem = { tag: string; title: string; desc: string };

export function recent(): RecentItem[] {
  return [
    {
      tag: 'XRobot 1.0',
      title: translate({ id: 'home.recent.xrobot.title', message: 'XRobot 1.0 由配置静态生成主函数' }),
      desc: translate({
        id: 'home.recent.xrobot.desc',
        message: '入口源文件用 `XR_REGISTER` 注册硬件，`xrobot gen` 生成按配置顺序构造实例的 `XRobotMain`。',
      }),
    },
    {
      tag: 'Platform',
      title: translate({ id: 'home.recent.platform.title', message: '平台驱动覆盖 STM32、CH32、ESP32、HPM、MSPM0、Linux、Webots 和 WebAssembly' }),
      desc: translate({ id: 'home.recent.platform.desc', message: '各平台驱动位于 LibXR 的 `driver` 目录下，每个平台一个子目录。' }),
    },
    {
      tag: 'XRUSB',
      title: translate({ id: 'home.recent.xrusb.title', message: 'XRUSB 提供 CDC、DAP、DFU、GSUSB、HID、UAC 设备类' }),
      desc: translate({ id: 'home.recent.xrusb.desc', message: '文档按设备类分页说明。' }),
    },
    {
      tag: 'Debug',
      title: translate({ id: 'home.recent.debug.title', message: '调试链路支持 SWD 与 JTAG' }),
      desc: translate({ id: 'home.recent.debug.desc', message: '包括用 GPIO 时序实现的 SWD 与 JTAG，以及 CMSIS-DAP v1/v2 设备类。' }),
    },
  ];
}
