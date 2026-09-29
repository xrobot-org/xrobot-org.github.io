---
id: env-setup
title: Environment Setup
sidebar_position: 4
---

# Environment Setup

This chapter covers local environment setup for LibXR, CodeGenerator, and XRobot.

## Supported Platforms

LibXR itself is a C++ library that does not depend on a specific operating system. The current mainline requires C++20 and the standard C++ library, and can run on bare metal or with an RTOS.

CodeGenerator and XRobot are Python-based packages and require Python 3 plus a working `pip3` environment.

## Installation

### LibXR

Clone the repository directly:

```bash
git clone https://github.com/Jiu-xiao/libxr.git
```

For integration into an existing project, `submodule` or `subtree` is more common:

```bash
git submodule add https://github.com/Jiu-xiao/libxr.git libxr
```

### CodeGenerator (libxr) and XRobot

Install with `pip`:

```bash
pip install xrobot==1.0.0 libxr==6.0.0
```

An XRobot BSP pins both tools, with `xrobot:` in `Modules/modules.yaml` and `generator:` in `User/libxr_config.yaml`; install the versions the BSP pins.

Install with `pipx`:

```bash
### Windows
python -m pip install --user pipx
python -m pipx ensurepath
pipx install xrobot==1.0.0
pipx install libxr==6.0.0
pipx ensurepath
# Restart your terminal

### Linux
sudo apt install pipx
pipx install xrobot==1.0.0
pipx install libxr==6.0.0
pipx ensurepath
# Restart your terminal
```

Do not install the same package with both `pip` and `pipx` at the same time. That usually leads to mixed PATH state and version conflicts.
