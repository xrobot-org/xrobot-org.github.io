---
id: env-setup
title: Environment Setup
sidebar_position: 3
---

# Environment Setup

This chapter has three parts: this page installs LibXR, CodeGenerator, XRobot and the VS Code extension; the platform pages cover each platform's toolchain and how LibXR is brought into it; [Docker Environment Setup](docker.md) lists the images with the toolchains preinstalled.

## Supported Platforms

LibXR is a C++20 library that uses the standard C++ library and runs on bare metal, on an RTOS or on Linux.

CodeGenerator and XRobot are Python packages and require Python 3.10 or newer with `pip`.

## Installation

### LibXR

Clone the repository directly:

```bash
git clone https://github.com/xrobot-org/libxr.git
```

For integration into an existing project, `submodule` or `subtree` is more common:

```bash
git submodule add https://github.com/xrobot-org/libxr.git libxr
```

### CodeGenerator (libxr) and XRobot

Install with `pipx`:

Windows:

```powershell
python -m pip install --user pipx
python -m pipx ensurepath
python -m pipx install xrobot==1.0.1
python -m pipx install libxr==6.0.1
# Restart your terminal
```

Linux:

```bash
sudo apt install pipx
pipx ensurepath
pipx install xrobot==1.0.1
pipx install libxr==6.0.1
# Restart your terminal
```

Installing with `pip` applies to Windows or to an activated virtual environment:

```bash
pip install xrobot==1.0.1 libxr==6.0.1
```

On Ubuntu 24.04 and other Debian-based distributions the system Python is managed by apt, and a plain `pip` install fails with `externally-managed-environment`. On these systems use `pipx` as above, or create a virtual environment first and use `pip` inside it:

```bash
sudo apt install python3-venv
python3 -m venv .venv
. .venv/bin/activate
pip install xrobot==1.0.1 libxr==6.0.1
```

Use only one of these methods. With several installations present, the command line may run a different version than expected. `xrobot --version` and `libxr --version` show the versions in use.

The xrobot version a BSP uses is recorded in the `xrobot:` field of `Modules/modules.yaml`; STM32 BSPs that use the CodeGenerator also record the libxr version in the `generator:` field of `User/libxr_config.yaml`. Install the same versions.

### VS Code Extension

The VS Code extension [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot) adds two views to the activity bar, XRobot and LibXR. When a BSP with `Modules/modules.yaml` is opened, the XRobot view shows its Modules, configurations and instances and makes changes through `xrobot` commands.

The LibXR view recognizes the platform from the workspace root: a project with an `.ioc` at its root is an STM32CubeMX project, an `app.yaml` with `boards/*/*.hpmpc` is an HPM project, and a SysConfig `.syscfg` is an MSPM0 project. The view shows the platform and the settings of `User/libxr_config.yaml`; the settings can be edited there and the code is regenerated. "Generate LibXR Code" runs `libxr parse` and `libxr gen`, or the platform's `libxr stm32 setup`, `libxr mspm0 setup` or `libxr hpm setup` while there is no `libxr_config.yaml` yet. For an MSPM0 project, "Open in SysConfig" opens the `.syscfg` in the standalone SysConfig; for an HPM project, "Open in HPM Pinmux Tool" opens the `.hpmpc` with HPMicro's HPM Pinmux Tool extension. "Pin Layout" in the LibXR view opens the package drawing of the chip (the pin layout, `libxr pins`): the selected pins are coloured by peripheral category, the package of an MSPM0 comes from its SysConfig project, and the panel is read-only.

The extension requires VS Code 1.108 or newer; MSPM0 and HPM projects and the pin layout need extension 2.0.1. The XRobot view needs xrobot 1.0.0 and `git`; the LibXR view needs libxr, 6.0.0 for STM32 projects and 6.0.1 for MSPM0 and HPM projects and the pin layout; both are installed as in the previous section. The extension looks up these commands on `PATH`, in pip's per-user script directories and in the `xrobot.cli.extraPath` setting; when the commands are installed in a virtual environment, put the full path of its `bin` directory (`Scripts` on Windows) in `xrobot.cli.extraPath`. Parsing an MSPM0 project (which runs SysConfig) and "Open in SysConfig" use the settings `xrobot.libxr.sysconfigTool` and `xrobot.libxr.mspm0SdkDir`; when they are empty, the environment variables `SYSCONFIG_TOOL` and `MSPM0_SDK_INSTALL_DIR` are used.

## Platforms

- [STM32](stm32.md): CMake projects exported by STM32CubeMX, compilers and command-line builds
- [CH32](ch32.md), [ESP32](esp32.md), [MSPM0](mspm0.md), [HPM](hpm.md): toolchains and how LibXR is brought into each platform
- [Linux](linux.md): host compilers and the dependencies of the LibXR Linux drivers
- [Docker](docker.md): images with the toolchains of each platform preinstalled
