---
id: env-setup
title: Environment Setup
sidebar_position: 4
---

# Environment Setup

This chapter covers local environment setup for LibXR, CodeGenerator, and XRobot.

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
python -m pipx install xrobot==1.0.0
python -m pipx install libxr==6.0.0
# Restart your terminal
```

Linux:

```bash
sudo apt install pipx
pipx ensurepath
pipx install xrobot==1.0.0
pipx install libxr==6.0.0
# Restart your terminal
```

Install with `pip`:

```bash
pip install xrobot==1.0.0 libxr==6.0.0
```

Use only one of these methods. With several installations present, the command line may run a different version than expected. `xrobot --version` and `libxr --version` show the versions in use.

The XRobot version a BSP uses is recorded in the `xrobot:` field of `Modules/modules.yaml`; STM32 BSPs that use the CodeGenerator also record the libxr version in the `generator:` field of `User/libxr_config.yaml`. Install the same versions.
