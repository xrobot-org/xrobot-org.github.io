## 推荐视频
- 【无需配置！STM32 + VS Code 最好的开发方式：XRobot 官方教程第 0 节——STM32 开发环境】
  https://www.bilibili.com/video/BV1SHnAztE11
视频中包含 Python 包安装、VS Code 与插件安装，以及最基本的一次编译和调试流程。本任务只关注其中“安装 Python 与 libxr / xrobot”这一部分，其他步骤会在后续任务中分别展开。
## 参考文档
- 环境配置文档：https://xrobot.work/docs/env_setup
本任务主要对应文档中的「CodeGenerator(libxr) 与 XRobot」小节。LibXR 的 C++ 仓库在这一阶段不用手动处理，后续在创建 STM32 工程时会由工具自动拉取。
## 本任务要完成的事情
- 在当前开发电脑（Windows 或 Linux）上准备好可用的 Python 3 环境。
- 安装两个后续会频繁使用的 Python 包：libxr（CodeGenerator 工具链）和 xrobot。
- 建立一个清晰印象：此时只是在“准备脚本工具”，真正的 STM32 工程和 LibXR 源码会在后面步骤中自动生成或拉取。
## 前置条件（概要）
- 电脑上已经安装了 Python 3（可以参考视频或文档中的示例检查版本）。
- 能够打开终端/命令行：
  - Windows：PowerShell 或命令提示符（cmd）。
  - Linux：任意终端（Terminal）。
如果尚未安装 Python 3，建议先按照视频或参考文档完成 Python 安装，再继续本任务。
## 安装步骤（建议流程）
1. 打开终端/命令行。
2. 参考环境配置文档中 “CodeGenerator(libxr) 与 XRobot” 小节（或视频中的演示），在终端中执行安装命令，为当前用户安装以下两个包：
   - libxr（用于 CodeGenerator 工具链）。
   - xrobot（用于 XRobot 工具链）。
   具体命令以文档和视频中给出的为准，你可以选择使用 pip，或使用 pipx 为它们创建独立环境，两种方式任选其一即可，无需同时使用。
3. 安装完成后，可以按照文档或视频中的简单检查方式，确认这两个工具已经可以在终端中被调用。后续任务会具体说明如何使用它们，目前只需保证“已成功安装”。
## 避免的问题
- 避免在同一台机器上同时用 pip 和 pipx 安装同一个包（例如 libxr 或 xrobot），否则可能出现路径、版本混在一起的情况。
- 如果之前已经尝试过多种安装方式，建议先按文档说明卸载不需要的安装，只保留一种明确的方式（只用 pip 或只用 pipx）。
## 本节暂时不用做的事情
- 不需要手动 git clone LibXR 仓库。
- 不需要在这一节配置 STM32 工程或 C++ 编译器。
- 不需要立即理解 libxr 和 xrobot 的全部功能，只要确认它们安装成功即可。
## 完成标准
- 电脑上有可用的 Python 3 环境，可以按文档或视频中的示例运行与 Python 相关的基本命令。
- libxr 和 xrobot 两个 Python 包已经通过一种方式（pip 或 pipx）成功安装。
- 理解本节的结果是：后续在创建 STM32 示例工程时，已经具备运行 CodeGenerator 和 XRobot 工具所需的基础环境。
