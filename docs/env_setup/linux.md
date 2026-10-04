---
id: env-setup-linux
title: Linux 环境配置
sidebar_position: 4
---

# Linux 环境配置

以下以 `Ubuntu 24.04` 等使用 apt 的 Debian 系发行版为例。

```bash
sudo apt update
sudo apt install -y \
  git curl wget zip make file tar xz-utils \
  python3 python3-pip python3-venv pipx \
  cmake ninja-build gcc g++ gdb \
  clang clangd clang-tidy \
  libwpa-client-dev libnm-dev libudev-dev
```

其中 `libudev-dev` 是 LibXR Linux 驱动的必需依赖；缺少 `libwpa-client-dev` 时 CMake 只给出警告，不编译 Wi-Fi 客户端（`linux_wifi_client.hpp`），有 `libwpa-client-dev` 时还需要 `libnm-dev`。`xrobot` 和 `libxr` 的安装见[环境配置](README.md)。

## 使用 Clang

在 CMake 中指定编译器：

```bash
cmake -S . -B build -G Ninja \
  -DCMAKE_C_COMPILER=clang \
  -DCMAKE_CXX_COMPILER=clang++
```

也可以使用预装这些依赖的 `docker-image-linux`，见 [Docker 环境配置](docker.md)。
