---
id: env-setup
title: 环境配置
sidebar_position: 3
---

# 环境配置

本章分为三部分：本页说明 LibXR、CodeGenerator、XRobot 和 VS Code 扩展的安装；各平台的页面说明该平台的工具链和 LibXR 的接入方式；[Docker 环境配置](docker.md) 列出预装工具链的镜像。

## 支持平台

LibXR 是一个 C++20 库，依赖标准 C++ 库，可用于裸机、RTOS 和 Linux。

CodeGenerator 和 XRobot 是 Python 包，需要 Python 3.10 及以上版本和 `pip`。

## 安装

### LibXR

直接拉取代码：

```bash
git clone https://github.com/xrobot-org/libxr.git
```

集成到现有工程时，更常见的做法是使用 submodule 或 subtree：

```bash
git submodule add https://github.com/xrobot-org/libxr.git libxr
```

### CodeGenerator（libxr）与 XRobot

使用 `pipx` 安装：

Windows：

```powershell
python -m pip install --user pipx
python -m pipx ensurepath
python -m pipx install xrobot==1.0.0
python -m pipx install libxr==6.0.0
# 重新打开终端
```

Linux：

```bash
sudo apt install pipx
pipx ensurepath
pipx install xrobot==1.0.0
pipx install libxr==6.0.0
# 重新打开终端
```

使用 `pip` 安装适用于 Windows 或已激活的虚拟环境：

```bash
pip install xrobot==1.0.0 libxr==6.0.0
```

Ubuntu 24.04 等 Debian 系发行版的系统 Python 由 apt 管理，直接用 `pip` 安装时报错 `externally-managed-environment`。在这些系统上使用上面的 `pipx`，或先创建虚拟环境，再在其中使用 `pip`：

```bash
sudo apt install python3-venv
python3 -m venv .venv
. .venv/bin/activate
pip install xrobot==1.0.0 libxr==6.0.0
```

以上方式只选其一，不要混用。系统中有多份安装时，命令行实际调用的版本可能与预期不同。当前使用的版本可通过 `xrobot --version` 和 `libxr --version` 查看。

BSP 使用的 xrobot 版本记录在 `Modules/modules.yaml` 的 `xrobot:` 字段中；使用 CodeGenerator 的 STM32 BSP 另在 `User/libxr_config.yaml` 的 `generator:` 字段中记录 libxr 的版本。安装时应与之一致。

### VS Code 扩展

VS Code 扩展 [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot) 在活动栏中提供 XRobot 和 LibXR 两个视图。打开包含 `Modules/modules.yaml` 的 BSP 时，XRobot 视图显示其中的模块、配置和实例，修改通过 `xrobot` 命令完成。

LibXR 视图按工程根目录识别平台：根目录有 `.ioc` 的是 STM32CubeMX 工程，`app.yaml` 加 `boards/*/*.hpmpc` 的是 HPM 工程，SysConfig 的 `.syscfg` 是 MSPM0 工程。视图显示平台和 `User/libxr_config.yaml` 中的各项设置，设置可以直接修改，修改后重新生成代码；"Generate LibXR Code" 运行 `libxr parse` 和 `libxr gen`，还没有 `libxr_config.yaml` 时则是对应平台的 `libxr stm32 setup`、`libxr mspm0 setup` 或 `libxr hpm setup`。MSPM0 工程的 "Open in SysConfig" 用独立版 SysConfig 打开 `.syscfg`，HPM 工程的 "Open in HPM Pinmux Tool" 用 HPMicro 的 HPM Pinmux Tool 扩展打开 `.hpmpc`。LibXR 视图的 "Pin Layout" 打开芯片的封装图（引脚布局，`libxr pins`）：已选引脚按外设类别着色，MSPM0 的封装取自 SysConfig 工程，面板只读。

扩展要求 VS Code 1.108 及以上版本，MSPM0、HPM 工程和引脚布局需要扩展 2.1.0。XRobot 视图需要 xrobot 1.0.0 和 `git`；LibXR 视图需要 libxr，STM32 工程用 6.0.0 即可，MSPM0、HPM 工程和引脚布局需要 6.1.0；两者按上一节安装。扩展在 `PATH`、pip 的用户脚本目录和设置项 `xrobot.cli.extraPath` 中查找这些命令；命令装在虚拟环境中时，把虚拟环境中 `bin` 目录（Windows 上为 `Scripts` 目录）的完整路径写入 `xrobot.cli.extraPath`。MSPM0 工程的解析（运行 SysConfig）和 "Open in SysConfig" 使用设置项 `xrobot.libxr.sysconfigTool` 和 `xrobot.libxr.mspm0SdkDir`，留空时使用环境变量 `SYSCONFIG_TOOL` 与 `MSPM0_SDK_INSTALL_DIR`。

## 平台

- [STM32](stm32.md)：STM32CubeMX 导出的 CMake 工程、编译器与命令行构建
- [CH32](ch32.md)、[ESP32](esp32.md)、[MSPM0](mspm0.md)、[HPM](hpm.md)：工具链与 LibXR 在该平台上的接入
- [Linux](linux.md)：主机上的编译器与 LibXR Linux 驱动的依赖
- [Docker](docker.md)：预装各平台工具链的镜像
