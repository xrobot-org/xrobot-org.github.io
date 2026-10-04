---
id: env-setup-linux
title: Linux Environment Setup
sidebar_position: 4
---

# Linux Environment Setup

The commands below assume `Ubuntu 24.04` or another Debian-family distribution that uses `apt`.

```bash
sudo apt update
sudo apt install -y \
  git curl wget zip make file tar xz-utils \
  python3 python3-pip python3-venv pipx \
  cmake ninja-build gcc g++ gdb \
  clang clangd clang-tidy \
  libwpa-client-dev libnm-dev libudev-dev
```

`libudev-dev` is required by the LibXR Linux drivers. Without `libwpa-client-dev`, CMake only prints a warning and the Wi-Fi client (`linux_wifi_client.hpp`) is not built; with it, `libnm-dev` is required as well. Installing `xrobot` and `libxr` is described in [Environment Setup](README.md).

## Using Clang

Select Clang in CMake:

```bash
cmake -S . -B build -G Ninja \
  -DCMAKE_C_COMPILER=clang \
  -DCMAKE_CXX_COMPILER=clang++
```

The `docker-image-linux` image comes with these dependencies preinstalled, see [Docker Environment Setup](docker.md).
