## 相关文档（可选阅读，仅作参考）
- 环境配置总览：https://xrobot.work/docs/env_setup
- Linux 环境配置：https://xrobot.work/docs/env_setup/env-setup-linux
- LibXR 仓库 README（库本体说明）：https://github.com/xrobot-org/libxr/blob/master/README.zh-CN.md
以上文档内容较完整，本任务不要求全部看懂，只作为需要时查细节的“说明书”。

## 本任务说明
本节只需要“看懂和想清楚”，**不需要**在电脑上执行任何命令，也不需要创建工程。
目标是从 **Linux 应用开发者** 的视角，在脑中先形成一套清晰的**整体图景**：
- Linux 本身负责什么？
- LibXR 在 Linux 上补了哪些能力？
- Python 侧的 CodeGenerator / xrobot 处在什么位置、在这条 Linux · 新手路线里为什么可以先完全不管。

## 本任务目标
- 弄清在 Linux 平台上：底层是 Linux 内核 + C++ 运行时，中间是 LibXR，上层是你的应用代码，各自大致负责什么。
- 搞明白：在这条 “Linux · 新手” 路线里，只需要把 LibXR 当作一个普通的 C++ 库来用，不使用 CodeGenerator，pip 安装的 libxr 包在这里不是必需品。
- 对“以后大概要用到哪些类型的工具”有一个粗略印象（编译器、构建工具、调试器、可选的 Python 环境等），具体安装步骤留给下一个任务。

## 整体图景：从 Linux 内核到 LibXR 应用
在 Linux · 新手 路线上，可以把整个体系想象成一条自下而上的链路：
- 最底层：硬件 + Linux 内核 + C 运行时（例如 glibc）。
- 再上层是一套 C++ 开发工具链：
  - C/C++ 编译器（如 g++ / clang）；
  - 构建系统（如 CMake 及其后端）；
  - 调试器和常用工具（如 gdb、git 等）。
- 再往上，是作为 **C++ 源码库** 的 LibXR：
  - 你会在工程里把它当作第三方库或子目录，引入到自己的 CMake 项目中一起编译；
  - 在 Linux 下，LibXR 内部通过 pthread、定时器、文件等系统调用实现线程、同步原语、时间、I/O 等能力，对外暴露统一的 C++ 接口。
- 最上层，是你的业务代码：命令行工具、守护进程、仿真环境或上位机程序，直接调用 LibXR 提供的线程、同步原语、定时器、日志、终端、数据库等接口。

一句话概括这条路线的定位：
> 在 Linux 上写的是“普通 C++ 程序”，只是尽量通过 LibXR 统一使用线程 / 同步 / 定时器 / I/O / 中间件，
> 这样将来如果需要把部分逻辑迁到其他平台，可以复用更多代码。

## LibXR / CodeGenerator / XRobot 在 Linux 场景下的关系
这一节只关心“Linux + LibXR”这个组合，但有必要顺带说明一下生态里的另外两个名词：

- **LibXR（C++ 库本体）**：
  - 是本路线的核心，你会把它当作 C++17 库来使用；
  - 在 Linux 上，它通过 system=Linux 的实现层封装线程、定时器、同步原语、日志、终端、数据库等。

- **CodeGenerator（Python 工具）**：
  - 是一个基于 Python 的代码生成工具，用于根据工程配置生成初始化代码和工程骨架；
  - 在本路线中，你不需要使用 CodeGenerator：我们会直接手写一个小而清晰的 CMake 工程，把 LibXR 当普通 C++ 库来链接；
  - pip 安装的 `libxr` 包对应的正是这个工具链，而不是你要在 Linux 上链接的 C++ 库本身，所以在这里可以完全忽略。

- **xrobot（Python 包）与 XRobot 体系**：
  - xrobot 是与 XRobot 相关的 Python 工具包，用于项目管理、模块管理、配置等；
  - 它可以在 Linux 上发挥作用，但对“先在 Linux 上学会直接使用 LibXR 写 C++ 程序”不是前置条件；
  - 在这条 Linux · 新手路线中，你可以暂时只把它当作“将来可能会用到的另外一层”，不需要安装也不需要理解细节。

可以简单记住：
> 这一条 Linux · 新手路线只聚焦在 “C++ 版 LibXR + 你的 C++ 工程” 这一块。
> Python 侧的 CodeGenerator / xrobot 处于同一生态，但与本路线解耦，你现在完全可以不去管它们。

## 本节暂时不用做的事情
- 不需要执行任何安装命令（例如 apt、pip、pipx 等）。
- 不需要拉取 LibXR 代码或创建工程目录。
- 不需要安装或使用任何 Python 包（包括 libxr 和 xrobot）。
以上这些具体操作，会在后续的“Linux 实际环境配置 / 第一个工程”任务中单独说明。

## 完成标准
- 你能用自己的话说出：在 Linux 上使用 LibXR，本质上是“写普通 C++ 程序，并把 LibXR 当作一个跨平台 C++ 库来链接”。
- 你清楚：这一条 Linux · 新手路线只关注 LibXR 的 C++ 用法，不依赖 CodeGenerator，也不需要 pip 安装的 libxr 包；
- 你知道：具体的安装命令、代码拉取和 CMake 配置会在下一个任务里讲，这一节只负责帮你把“LibXR 在 Linux 上处于哪一层”这件事情想清楚。
