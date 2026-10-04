---
id: con-guide-doc-style
title: 文档规范
sidebar_position: 6
---

# 文档规范

这里整理 XRobot 生态中文档的写法，适用于各仓库的 README、模块与 BSP 的 README 以及本网站。每条规则附有反例和正例，反例取自实际出现过的写法。

## 文档类型

| 文档 | 读者 | 内容 |
| --- | --- | --- |
| 仓库 README | 初次了解项目的人 | 项目做什么、安装、基本概念、主要功能及示例、命令一览、文档链接 |
| 网站教程 | 准备上手的人 | 从零开始的完整步骤 |
| 网站参考 | 查阅规则的人 | 完整的格式、参数与规则 |
| 模块 README | 使用该模块的人 | 模块作用、构造接口、Topic、配置示例、依赖与硬件 |
| BSP README | 使用该 BSP 的人 | 板子与平台、包含的配置、构建与烧录 |

- 仓库 README 是介绍，只介绍功能，示例用来说明效果；分步操作放在网站教程中，完整规则放在网站参考中。

反例（README 中写操作步骤）：

> Then generate and build natively:

正例：

> `xrobot gen` 由配置生成普通的 C++ 代码，对象按配置顺序静态创建：

- 一篇文档只写本项目的内容，其他项目的用法链接到对应文档。

反例（XRobot 的 README 中写 CodeGenerator 的安装与版本）：

> STM32 BSPs also use the CodeGenerator (`pip install libxr==6.0.0`), pinned by `generator:` in `User/libxr_config.yaml`.

## 结构

### 仓库 README

```text
# 名称
一句话副标题（中文 / English）
logo 与徽章
介绍：中文一段，英文一段
## 🔧 安装 / Installation
## 📚 基本概念 / Concepts
## <功能> / <Feature>        每个功能一节：说明、真实示例、文档链接
## 🚀 命令一览 / Commands
## 🧪 测试 / Tests
## 📖 更多信息 / More Information
```

参照：[XRobot 的 README](https://github.com/xrobot-org/XRobot)。

### 模块 README

```text
# 模块名
## 1. 模块作用 / Purpose
## 2. 构造接口 / Constructor                    依赖在前，配置参数在后，逐项说明
## 3. Topic                                     发布与订阅的名称、类型和用途
## 4. 配置示例 / Configuration Example          xrobot instance add 生成并填写后的 YAML
## 5. 依赖与硬件 / Dependencies and Hardware
```

模块有需要单独说明的约定（例如时间戳的含义）时，放在“模块作用”之后，单独成节。

### BSP README

```text
# BSP 名称
## 1. 板子与平台 / Board and Platform
## 2. 配置一览 / Configurations         每份配置对应的产品或用途
## 3. 构建 / Build
## 4. 烧录与运行 / Flash and Run
```

## 语言与排版

- 仓库 README 中文在前、英文在后，各自成段；网站的中文页面放在 `docs/`，英文页面放在 `i18n/en/`。
- 仓库 README 的二级标题使用 emoji 加中英文，例如 `## 🔧 安装 / Installation`。
- 代码块标注语言；命令以 `$ ` 开头，输出紧跟在命令之后。
- 不在每一条中文后面机械地附一行英文。

反例：

> - 值是 C++ 表达式。`null` 表示未填写，空指针写 `nullptr`。
>   *Values are C++ expressions. `null` means not filled in; write `nullptr` for a null pointer.*

正例：中文段落写完后，另起一段写对应的英文。

## 语气

- 使用中性的第三人称书面语，与项目自身的介绍一致。

反例：

> 三种方式选一种，不要混用。同时装了几份时，命令行调到的不一定是你以为的那一份。

正例：

> 以上三种方式只选其一，不要混用。系统中有多份安装时，命令行实际调用的版本可能与预期不同。

- 不写说明“不是什么”“不依赖什么”的表态句，直接说明它是什么、做什么。

反例：

> It is not a build system: after `xrobot setup`, build with the BSP's own CMake. LibXR is usable without XRobot.

正例：

> XRobot 是配合 LibXR 使用的模块管理工具。它负责拉取模块、把每个模块锁定到具体的提交，再根据 `User/` 下的 YAML 配置生成主函数 `XRobotMain`。

- 不写绝对化的保证，说明实际行为即可。

反例：

> Setup never discards local work.

正例：

> 模块有未提交或未推送的改动时，`xrobot setup` 停止并说明原因。

- 避免翻译腔。

反例：

> 升级要显式运行 `xrobot setup --update`。

正例：

> 升级模块时运行 `xrobot setup --update`。

- 避免口语。

反例：

> 模块就是一个普通的 C++ 类。……连同它们依赖的模块一起拉到 `Modules/` 下。

正例：

> 模块是一个普通的 C++ 类。……拉取到 `Modules/` 目录。

- 介绍性的文字不写成指导。

反例：

> 用 LibXR 写程序时，驱动、算法这类能在不同板子之间复用的代码做成模块。

正例：

> XRobot 把可以在不同板子之间复用的驱动和算法组织成模块，板级初始化则保留在各自的 BSP 中。

## 概念

- 用一个具体场景说明各个概念，不只按形式下定义。

反例：

> 模块（Module）：一个 Git 仓库 `owner/Repo`，里面是一个 C++ 类 `Repo`。

正例：

> 以一块带有 BMI088 IMU 和 LED 的板子为例：模块是 `xrobot-org/BMI088`（IMU 驱动）、`xrobot-org/MadgwickAHRS`（姿态解算）和 `xrobot-org/BlinkLED`（状态灯），各自是一个 Git 仓库。

- 术语使用下表中的固定叫法，同一概念不换说法。

| 中文 | English | 含义 | 不使用 |
| --- | --- | --- | --- |
| 模块 | Module | 可在不同 BSP 中复用的功能单元，一个 Git 仓库中的一个 C++ 类 | 组件、包、库 |
| 源 | Source | 列出模块仓库的 `index.yaml` | 模块索引、仓库源 |
| BSP | BSP | 使用模块的工程，例如某块板子的固件或一个 Linux 程序 | 板级包 |
| 配置 | Configuration | `User/` 下的一个 YAML 文件，描述一个产品 | 应用 yaml、产品配置文件 |
| 实例 | Instance | 配置中的一项，即某个模块的一个对象 | 模块对象、实例化对象 |
| 硬件注册 | Registration | 入口源文件中的 `XR_REGISTER` | 硬件别名、设备别名 |
| 入口源文件 | Entry source | `User/` 下调用 `XROBOT_MAIN()` 的源文件 | 入口、main 文件 |
| 主函数 | Main function (`XRobotMain`) | `xrobot gen` 生成的函数 | 入口函数、主入口 |
| lock | lock | `xrobot.lock`，记录每个模块使用的提交 | 锁文件 |

## 示例

- 命令输出来自实际运行，只允许把本机路径替换为 `<BSP>` 或相对路径，不编写输出。
- 模块 README 的配置示例取 `xrobot instance add` 写出的实例再填写，结构体保持工具写出的形式（映射或 C++ 文本）；BSP 配置中 LibXR 结构体的值可以写成一行指定初始化器，只写与默认值不同的字段。
- LibXR、XRobot、CodeGenerator 等核心仓库的文档使用通用的例子，不出现 RoboMaster 的机器人名称。

反例：

> 一个 BSP 可以有好几份配置，比如英雄、步兵、哨兵。

正例：

> 同一个 BSP 可以包含多份配置，例如用于调试的精简配置和完整功能的配置。

- 示例中不出现个人路径和个人环境。

反例：

> `cube-cmake --build /home/leo/Documents/bsp-dev-c/build/debug --`

正例：

> `cmake --build --preset debug`

## 自查

提交文档前逐项检查：

1. 读过这篇文档的旧版本和同类文档，沿用了原有的结构和风格。
2. 内容与文档类型相符：介绍、教程、参考不混写。
3. 语气符合上文规则：没有口语、翻译腔、表态句和绝对化的保证，不对读者说“你”。
4. 没有其他项目的内容。
5. 术语与术语表一致。
6. 输出来自实际运行，例子通用，没有个人路径。
7. 中英文内容一致。
