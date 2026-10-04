---
id: env-setup-docker
title: Docker Environment Setup
sidebar_position: 6
---

# Docker Environment Setup

[xrobot-org/Docker-Image](https://github.com/xrobot-org/Docker-Image) currently provides the following Docker images.

There are seven images:

* `docker-image-stm32`
* `docker-image-esp32`
* `docker-image-ch32-riscv`
* `docker-image-linux`
* `docker-image-webots`
* `docker-image-mspm0`
* `docker-image-hpm`

## Image Contents

### `docker-image-stm32`

* Based on `ubuntu:24.04`
* Includes `arm-gnu-toolchain-14.2.rel1`
* Includes `starm-clang`
* Pins `stm32cube-ide-core` to `1.1.0`, because newer package lines no longer provide the Linux-side `cube` downloader

### `docker-image-mspm0`

* Built from the same Dockerfile as `docker-image-stm32`; provides the GNU Arm `arm-none-eabi` toolchain for MSPM0 builds

### `docker-image-ch32-riscv`

* Based on `ubuntu:24.04`
* Uses **WCH GCC15 v240**
* Compiler prefix: `riscv32-wch-elf-`
* Includes the matching OpenOCD

### `docker-image-hpm`

* Based on `ubuntu:24.04`
* Provides the GNU `riscv32-unknown-elf` toolchain ([hpm-linux-gcc-release v0.1.0](https://github.com/Jiu-xiao/hpm-linux-gcc-release/releases/tag/v0.1.0)), installed in `/opt/hpm-riscv32-unknown-elf`; the path is recorded in `XR_HPM_TOOLCHAIN_ROOT`

### `docker-image-esp32`

* Based on `ubuntu:24.04`
* Preinstalls `ESP-IDF v5.4.1`
* Installed at `~/esp/esp-idf`
* Suitable for the standard `idf.py` workflow
* The image does not set up the IDF environment; run `. ~/esp/esp-idf/export.sh` before using `idf.py`

### `docker-image-linux`

* Based on `ubuntu:24.04`
* Preinstalls `clang / cmake / ninja / gcc / g++ / gdb`
* Preinstalls `libwpa-client-dev / libnm-dev / libudev-dev / libgpiod-dev`
* Preinstalls `pkg-config`, `libeigen3-dev` and OpenCV 4.13.0
* Suitable for native Linux driver and toolchain work

### `docker-image-webots`

* Based on `ubuntu:24.04`
* Preinstalls Webots R2025a, OpenVINO 2025.4 and OpenCV 4.13.0

## GHCR

Current pulls use `GHCR`:

* `docker pull ghcr.io/xrobot-org/docker-image-stm32:main`
* `docker pull ghcr.io/xrobot-org/docker-image-esp32:main`
* `docker pull ghcr.io/xrobot-org/docker-image-ch32-riscv:main`
* `docker pull ghcr.io/xrobot-org/docker-image-linux:main`
* `docker pull ghcr.io/xrobot-org/docker-image-webots:main`
* `docker pull ghcr.io/xrobot-org/docker-image-mspm0:main`
* `docker pull ghcr.io/xrobot-org/docker-image-hpm:main`

## Docker Hub

The same images are also published on Docker Hub (`:latest`):

* `docker pull xrimage/xrimage-stm32`
* `docker pull xrimage/xrimage-esp32`
* `docker pull xrimage/xrimage-ch32-riscv`
* `docker pull xrimage/xrimage-linux`
* `docker pull xrimage/xrimage-webots`
* `docker pull xrimage/xrimage-mspm0`
* `docker pull xrimage/xrimage-hpm`

## Run a container

```bash
docker run -it --rm <image-name>
```

To mount a local workspace, bind the working directory explicitly:

```bash
docker run -it --rm -v "$PWD":/work -w /work ghcr.io/xrobot-org/docker-image-linux:main
```
