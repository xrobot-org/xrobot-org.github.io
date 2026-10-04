---
id: env-setup-docker
title: Docker 环境配置
sidebar_position: 6
---

# Docker 环境配置

[xrobot-org/Docker-Image](https://github.com/xrobot-org/Docker-Image) 当前发布的 Docker 镜像和使用方式如下。

当前发布以下 7 种镜像：

* `docker-image-stm32`
* `docker-image-esp32`
* `docker-image-ch32-riscv`
* `docker-image-linux`
* `docker-image-webots`
* `docker-image-mspm0`
* `docker-image-hpm`

## 镜像内容

### `docker-image-stm32`

* 基于 `ubuntu:24.04`
* 包含 `arm-gnu-toolchain-14.2.rel1`
* 包含 `starm-clang`
* 当前镜像专门把 `stm32cube-ide-core` 固定在 `1.1.0`，因为更新后的包线已经不再提供 Linux 侧 `cube` downloader，直接跟随更新会使当前 STM32 镜像失去这部分能力

### `docker-image-mspm0`

* 与 `docker-image-stm32` 使用同一 Dockerfile，提供 `arm-none-eabi` GNU Arm 工具链，用于 MSPM0 构建

### `docker-image-ch32-riscv`

* 基于 `ubuntu:24.04`
* 当前已切换到 **WCH GCC15 v240**
* 编译器前缀为 `riscv32-wch-elf-`
* 同时带有对应 OpenOCD

### `docker-image-hpm`

* 基于 `ubuntu:24.04`
* 提供 `riscv32-unknown-elf` GNU 工具链（[hpm-linux-gcc-release v0.1.0](https://github.com/Jiu-xiao/hpm-linux-gcc-release/releases/tag/v0.1.0)），安装在 `/opt/hpm-riscv32-unknown-elf`，路径记录在环境变量 `XR_HPM_TOOLCHAIN_ROOT` 中

### `docker-image-esp32`

* 基于 `ubuntu:24.04`
* 预装 `ESP-IDF v5.4.1`
* 目录位于 `~/esp/esp-idf`
* 适合直接跑官方 `idf.py` 工作流
* 镜像没有设置 IDF 环境变量，使用 `idf.py` 前先执行 `. ~/esp/esp-idf/export.sh`

### `docker-image-linux`

* 基于 `ubuntu:24.04`
* 预装 `clang / cmake / ninja / gcc / g++ / gdb`
* 预装 `libwpa-client-dev / libnm-dev / libudev-dev / libgpiod-dev`
* 预装 `pkg-config`、`libeigen3-dev` 和 OpenCV 4.13.0
* 适合直接作为 Linux 原生驱动和工具链环境

### `docker-image-webots`

* 基于 `ubuntu:24.04`
* 预装 Webots R2025a、OpenVINO 2025.4 和 OpenCV 4.13.0

## GHCR 拉取

当前以 `GHCR` 为准：

* `docker pull ghcr.io/xrobot-org/docker-image-stm32:main`
* `docker pull ghcr.io/xrobot-org/docker-image-esp32:main`
* `docker pull ghcr.io/xrobot-org/docker-image-ch32-riscv:main`
* `docker pull ghcr.io/xrobot-org/docker-image-linux:main`
* `docker pull ghcr.io/xrobot-org/docker-image-webots:main`
* `docker pull ghcr.io/xrobot-org/docker-image-mspm0:main`
* `docker pull ghcr.io/xrobot-org/docker-image-hpm:main`

## Docker Hub 镜像源

同名镜像也发布在 Docker Hub（`:latest`）：

* `docker pull xrimage/xrimage-stm32`
* `docker pull xrimage/xrimage-esp32`
* `docker pull xrimage/xrimage-ch32-riscv`
* `docker pull xrimage/xrimage-linux`
* `docker pull xrimage/xrimage-webots`
* `docker pull xrimage/xrimage-mspm0`
* `docker pull xrimage/xrimage-hpm`

## 运行 Docker 镜像

```bash
docker run -it --rm 镜像名
```

如果要把本地工程挂进去，直接显式挂载工作目录，例如：

```bash
docker run -it --rm -v "$PWD":/work -w /work ghcr.io/xrobot-org/docker-image-linux:main
```
