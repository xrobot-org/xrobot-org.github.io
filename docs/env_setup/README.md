---
id: env-setup
title: 环境配置
sidebar_position: 4
---

# 环境配置

LibXR、CodeGenerator 和 XRobot 的本地环境配置见本章。

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

使用 `pip` 安装：

```bash
pip install xrobot==1.0.0 libxr==6.0.0
```

以上方式只选其一，不要混用。系统中有多份安装时，命令行实际调用的版本可能与预期不同。当前使用的版本可通过 `xrobot --version` 和 `libxr --version` 查看。

BSP 使用的 XRobot 版本记录在 `Modules/modules.yaml` 的 `xrobot:` 字段中；使用 CodeGenerator 的 STM32 BSP 另在 `User/libxr_config.yaml` 的 `generator:` 字段中记录 libxr 的版本。安装时应与之一致。
