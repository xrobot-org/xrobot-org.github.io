---
id: con-guide-doc-style
title: Documentation Style
sidebar_position: 6
---

# Documentation Style

This page summarizes how documentation is written in the XRobot ecosystem: repository READMEs, Module and BSP READMEs, and this website. Each rule comes with a rejected and an accepted example; the rejected examples are text that actually appeared. Chinese examples are quoted in the original.

## Document types

| Document | Reader | Content |
| --- | --- | --- |
| Repository README | People meeting the project for the first time | What the project does, installation, basic concepts, main features with examples, commands, documentation links |
| Website tutorial | People getting started | Complete steps from scratch |
| Website reference | People looking up rules | Complete formats, parameters and rules |
| Module README | Users of the Module | Purpose, constructor interface, topics, configuration example, dependencies and hardware |
| BSP README | Users of the BSP | Board and platform, included configurations, build and flashing |

- A repository README is an introduction. It describes features and uses examples to show the result; step-by-step instructions belong in the website tutorials and complete rules in the website reference.

Rejected (instructions in a README):

> Then generate and build natively:

Accepted:

> `xrobot gen` generates plain C++ code from the configuration, creating the objects statically in configuration order:

- A document covers only its own project and links to other projects' documentation.

Rejected (CodeGenerator installation and version in the XRobot README):

> STM32 BSPs also use the CodeGenerator (`pip install libxr==6.0.0`), pinned by `generator:` in `User/libxr_config.yaml`.

## Structure

### Repository README

```text
# Name
One-line subtitle (Chinese / English)
Logo and badges
Introduction: one Chinese paragraph, one English paragraph
## 🔧 安装 / Installation
## 📚 基本概念 / Concepts
## <功能> / <Feature>        one section per feature: description, real example, documentation link
## 🚀 命令一览 / Commands
## 🧪 测试 / Tests
## 📖 更多信息 / More Information
```

Reference: [the XRobot README](https://github.com/xrobot-org/XRobot).

### Module README

```text
# Module name
## 1. 模块作用          purpose
## 2. 构造接口          constructor: dependencies first, then configuration parameters, each described
## 3. Topic             published and subscribed names, types and purposes
## 4. 配置示例          the YAML written by xrobot instance add, filled in
## 5. 依赖与硬件        dependencies and hardware
```

A convention that needs its own explanation (for example the meaning of timestamps) gets a separate section after “模块作用”.

### BSP README

```text
# BSP name
## 1. 板子与平台        board and platform
## 2. 配置一览          the product or purpose of each configuration
## 3. 构建              build
## 4. 烧录与运行        flashing and running
```

## Language and layout

- In a repository README, Chinese comes first and English follows, each in its own paragraphs. Chinese website pages live in `docs/`, English pages in `i18n/en/`.
- Second-level headings of a repository README combine an emoji with Chinese and English, for example `## 🔧 安装 / Installation`.
- Code blocks name their language. Commands start with `$ `, followed directly by their output.
- A Chinese line is not mechanically followed by an English line.

Rejected:

> - 值是 C++ 表达式。`null` 表示未填写，空指针写 `nullptr`。
>   *Values are C++ expressions. `null` means not filled in; write `nullptr` for a null pointer.*

Accepted: the Chinese paragraph first, then the English paragraph.

## Tone

- Neutral written language in the third person, consistent with the project's own description.

Rejected:

> 三种方式选一种，不要混用。同时装了几份时，命令行调到的不一定是你以为的那一份。

Accepted:

> Use only one of these methods. With several installations present, the command line may run a different version than expected.

- No statements about what a tool is not or does not depend on; say what it is and what it does.

Rejected:

> It is not a build system: after `xrobot setup`, build with the BSP's own CMake. LibXR is usable without XRobot.

Accepted:

> XRobot is the Module manager for LibXR. It fetches Modules, locks each one to a commit, and generates the main function `XRobotMain` from the YAML configurations under `User/`.

- No absolute guarantees; describe the actual behavior.

Rejected:

> Setup never discards local work.

Accepted:

> `xrobot setup` stops and explains why when a Module has uncommitted or unpushed changes.

- No translationese.

Rejected:

> 升级要显式运行 `xrobot setup --update`。

Accepted:

> 升级模块时运行 `xrobot setup --update`。

- No colloquial wording.

Rejected:

> 模块就是一个普通的 C++ 类。……连同它们依赖的模块一起拉到 `Modules/` 下。

Accepted:

> 模块是一个普通的 C++ 类。……拉取到 `Modules/` 目录。

- Introductory text does not instruct.

Rejected:

> 用 LibXR 写程序时，驱动、算法这类能在不同板子之间复用的代码做成模块。

Accepted:

> XRobot organizes drivers and algorithms that can be reused across boards as Modules, while board-specific setup remains in each BSP.

## Concepts

- Concepts are explained through one concrete scenario rather than by formal definition alone.

Rejected:

> Module: a Git repository `owner/Repo` holding one C++ class `Repo`.

Accepted:

> For a board with a BMI088 IMU and an LED, the Modules are `xrobot-org/BMI088` (IMU driver), `xrobot-org/MadgwickAHRS` (attitude estimation) and `xrobot-org/BlinkLED` (status LED), one Git repository each.

- Terms follow the table below; one concept keeps one name.

| Chinese | English | Meaning | Not used |
| --- | --- | --- | --- |
| 模块 | Module | A reusable unit: one C++ class in one Git repository | component, package, library |
| 源 | Source | An `index.yaml` listing Module repositories | catalog, module index |
| BSP | BSP | A project that uses Modules, such as a board's firmware or a Linux program | board support package (spelled out) |
| 配置 | Configuration | A YAML file under `User/` describing one product | application yaml, product config file |
| 实例 | Instance | One entry of a configuration: an object of a Module | module object |
| 硬件注册 | Registration | `XR_REGISTER` in the entry source | hardware alias, device alias |
| 入口源文件 | Entry source | The `User/` source that calls `XROBOT_MAIN()` | entry, main file |
| 主函数 | Main function (`XRobotMain`) | The function generated by `xrobot gen` | entry function |
| lock | lock | `xrobot.lock`, the commit used for each Module | lock file |

## Examples

- Command output comes from an actual run. Only machine paths may be replaced with `<BSP>` or relative paths; output is never written by hand.
- The configuration example in a Module README is the instance `xrobot instance add` writes, then filled in; structs keep the form the tool writes (mapping or C++ text). In BSP configurations a LibXR struct value may be written as a one-line designated initializer that names only the fields that differ from the default.
- Documentation of core repositories such as LibXR, XRobot and CodeGenerator uses generic examples without RoboMaster robot names.

Rejected:

> 一个 BSP 可以有好几份配置，比如英雄、步兵、哨兵。

Accepted:

> A BSP can contain several configurations, for example a minimal one for debugging and a full one.

- Examples contain no personal paths or environments.

Rejected:

> `cube-cmake --build /home/leo/Documents/bsp-dev-c/build/debug --`

Accepted:

> `cmake --build --preset debug`

## Checklist

Before submitting documentation, check:

1. The previous version of the document and similar documents have been read, and their structure and style are kept.
2. The content matches the document type: introduction, tutorial and reference are not mixed.
3. The tone follows the rules above: no colloquial wording, translationese, statements of what something is not, or absolute guarantees, and the reader is not addressed as "you".
4. Nothing belongs to another project.
5. Terms match the terminology table.
6. Output comes from actual runs, examples are generic, and there are no personal paths.
7. The Chinese and English texts say the same thing.
