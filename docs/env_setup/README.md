---
id: env-setup
title: 环境配置
sidebar_position: 4
---

# 环境配置

LibXR、CodeGenerator 和 XRobot 的本地环境配置见本章。

## 支持平台

LibXR 本身是一个 C++ 库，不依赖特定操作系统，但当前主线要求 C++20 和标准 C++ 库，可用于裸机和 RTOS。

CodeGenerator 和 XRobot 是基于 Python 的包，需要 Python 3 和 `pip3` 环境。

## 安装

### LibXR

直接拉取代码：

```bash
git clone https://github.com/Jiu-xiao/libxr.git
```

集成到现有工程时，更常见的做法是使用 submodule 或 subtree：

```bash
git submodule add https://github.com/Jiu-xiao/libxr.git libxr
```

### CodeGenerator(libxr)与XRobot

直接通过 pip 安装：

```bash
pip install xrobot==1.0.0 libxr==6.0.0
```

XRobot BSP 在 `Modules/modules.yaml` 的 `xrobot:` 和 `User/libxr_config.yaml` 的 `generator:` 中固定两个工具的版本，请安装与 BSP 一致的版本。

使用 `pipx` 安装：

```bash
### windows
python -m pip install --user pipx
python -m pipx ensurepath
pipx install xrobot==1.0.0
pipx install libxr==6.0.0
pipx ensurepath
# Restart your terminal

### linux
sudo apt install pipx
pipx install xrobot==1.0.0
pipx install libxr==6.0.0
pipx ensurepath
# Restart your terminal
```

注意不要同时用 pip 和 pipx 安装同一个包，否则你的环境变量可能会混乱，导致版本冲突。
