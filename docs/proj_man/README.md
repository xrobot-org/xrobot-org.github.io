---
id: proj-man
title: 项目管理（XRobot）
sidebar_position: 6
---

# 项目管理（XRobot）

XRobot 是配合 LibXR 使用的模块管理工具。它负责拉取模块、把每个模块锁定到具体的提交，再根据 `User/` 下的 YAML 配置生成主函数 `XRobotMain`。从零新建一个 BSP 并构建的完整步骤见[快速开始](../quick_start.md#新建-bsp)。

---

## 安装

pip 包 `xrobot` 的安装方法见[环境配置](../env_setup/README.md#安装)。BSP 使用的版本记录在 `Modules/modules.yaml` 的 `xrobot:` 字段中，安装时应与之一致，例如 `pipx install xrobot==1.0.0`。VS Code 扩展 `XRobot.xrobot` 显示 `xrobot describe` 的结果，所有修改都通过 `xrobot` 命令完成，见 [VS Code 扩展](../env_setup/README.md#vs-code-扩展)。

---

## BSP 目录约定

BSP 根目录是向上查找到的第一个包含 `Modules/modules.yaml` 的目录。所有命令都可以在 BSP 的任意子目录运行，也可以用 `-C DIR` 指定起点。

| 文件 | 是否提交 | 含义 |
| --- | --- | --- |
| `Modules/modules.yaml` | 是 | 需要的模块（`owner/Repo@ref`）和 `xrobot:` 工具版本 |
| `Modules/sources.yaml` | 是 | 源（`index.yaml`）及优先级 |
| `xrobot.lock` | 是 | 依赖闭包中每个模块的具体提交 |
| `User/` 下（含子目录）的 `*.yaml` | 是 | 配置，每份描述一个产品；`User/libxr_config.yaml` 除外 |
| `User/` 下的入口源文件 | 是 | 用 `XR_REGISTER` 注册 BSP 对象并调用 `XROBOT_MAIN()` |
| `Modules/<owner>/<Repo>/` | 否 | 检出到锁定提交的模块仓库 |
| `Modules/CMakeLists.txt` | 否 | 由 `xrobot setup` 生成 |
| `User/xrobot_main.hpp` | 否 | 为选中的配置生成的头文件，其中是主函数 `XRobotMain` |

`xrobot init` 在当前目录创建 `Modules/modules.yaml`、`Modules/sources.yaml`、`User/xrobot.yaml`，把生成文件写入 `.gitignore`，并写入 `.gitattributes`（`* text=auto`、`*.sh text eol=lf`、`*.bat text eol=crlf`；已有文件时只补缺少的行）。仓库内统一为 LF，签出时按平台转换，这样在 Windows 和 Linux 上用 CubeMX 重新生成工程，提交里只有真实的改动。

---

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `xrobot --version` | 显示安装的 xrobot 版本 |
| `xrobot init` | 在当前目录创建 BSP 文件，写入 `.gitignore` 和 `.gitattributes` 条目 |
| `xrobot setup [--no-line-directives]` | 解析并锁定模块，检查所有配置，重新生成 `User/xrobot_main.hpp` |
| `xrobot gen [-c CONFIG] [--no-line-directives]` | 生成 `User/xrobot_main.hpp`（选中这份配置；`--no-line-directives` 不写 `#line`） |
| `xrobot describe [-c CONFIG]` | 以 JSON 输出 BSP 状态，供编辑器使用 |
| `xrobot sync [-c CONFIG]...` | 为新增字段/参数写入默认值，删除已移除的字段 |
| `xrobot format [--check] [-c CONFIG]...` | 把配置改写为规范格式 |
| `xrobot instance [-c CONFIG] add\|set\|remove\|rename` | 编辑一个实例 |
| `xrobot module add\|remove owner/Repo[@ref]` | 编辑 `Modules/modules.yaml` |
| `xrobot module show MODULE` | 显示模块的 manifest 和构造函数（目录、头文件或模块 id） |
| `xrobot new-module NAME` | 创建模块骨架（头文件、CMake、README、CI） |
| `xrobot check-module MODULE` | 像 `setup` 一样解析模块（会更新 `xrobot.lock` 和 `Modules/`），再写出模块 CI 编译用的构造调用（只编译，不执行） |
| `xrobot source ...` | 查询或编辑源 |

`xrobot <命令> --help` 显示每个命令的参数。

命令的输出和报错随系统语言：中文环境下为中文，其他环境下为英文。环境变量 `XR_LANG` 可以指定语言（`zh` 或 `en`），LibXR_CppCodeGenerator 的命令同样使用这个变量。生成的文件内容不随语言变化。

---

## 本章内容

- [模块请求与锁定](./setup.md)：`modules.yaml`、ref 规则、`xrobot.lock`、`xrobot setup` 与发布门禁
- [配置](./config.md)：配置格式、依赖绑定、结构体、常量、多份配置
- [主函数生成](./gen_main.md)：`XR_REGISTER`、`XROBOT_MAIN()`、生成的头文件与构建检查
- [编写模块](./create_mod.md)：模块类与构造函数、manifest
- [源](./src_man.md)：`sources.yaml`、`index.yaml` 与 `xrobot source`
- [CI 与固件发布](./ci.md)：模块 CI、STM32 BSP 的 CI 与固件发布
