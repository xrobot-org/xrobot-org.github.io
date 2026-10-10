---
id: env-setup-mspm0
title: MSPM0 环境配置
sidebar_position: 3.5
---

# MSPM0 环境配置

MSPM0 工程基于 TI MSPM0 SDK 和 SysConfig，用 CMake、Ninja 和 GNU Arm Embedded Toolchain（编译器前缀 `arm-none-eabi-`）构建。BSP [bsp-mspm0g3507-mini](https://github.com/xrobot-org/bsp-mspm0g3507-mini) 和 [bsp-mspm0g3519-mini](https://github.com/xrobot-org/bsp-mspm0g3519-mini) 是可以完整构建的工程，本页以它们为例；[代码生成](../code_gen/mspm0/README.md)说明 `libxr mspm0 setup` 如何在这样的工程里生成 LibXR 代码。

快速开始推荐 Docker 镜像 `ghcr.io/xrobot-org/docker-image-mspm0:main`，见下文 [Docker 构建](#docker-构建)。

## 基础环境

本机构建安装：

* CMake（3.20 或更新版本）和 Ninja
* `arm-none-eabi-gcc`（[GNU Arm Embedded Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads)）
* [TI MSPM0 SDK](https://www.ti.com/tool/MSPM0-SDK)
* [SysConfig](https://www.ti.com/tool/SYSCONFIG) 独立安装包，其中的 `sysconfig_cli` 是命令行入口

CMake 工程通过两个变量找到 SDK 与 SysConfig，变量名与 SDK 的 `imports.mak` 一致，环境变量或 CMake 缓存（`-D`）都可以：

* `MSPM0_SDK_INSTALL_DIR`：MSPM0 SDK 根目录
* `SYSCONFIG_TOOL`：SysConfig 命令行的完整路径，Windows 是 `sysconfig_cli.bat`，Linux 是 `sysconfig_cli.sh`

Windows PowerShell 的示例：

```powershell
$env:MSPM0_SDK_INSTALL_DIR = "C:\ti\mspm0_sdk_2_11_00_07"
$env:SYSCONFIG_TOOL = "C:\ti\sysconfig_1.28.1\sysconfig_cli.bat"
```

## 工程结构

BSP 的目录结构如下：

```text
.
|-- CMakeLists.txt
|-- CMakePresets.json
|-- main.c
|-- mspm0g3507_minidb48.syscfg
|-- cmake/
|   |-- LibXR.CMake
|   |-- MSPM0SysConfig.cmake
|   `-- arm-none-eabi-gcc.cmake
|-- User/
|   |-- app_main.cpp
|   `-- libxr_config.yaml
|-- Modules/
`-- libxr/
```

* `main.c` 在工程根目录，先调用 SysConfig 生成的 `SYSCFG_DL_init()` 完成时钟、引脚和外设的初始化，然后进入 `app_main()`
* `.syscfg` 是 SysConfig 工程，在工程根目录；芯片、时钟、引脚和外设都由它描述
* `cmake/MSPM0SysConfig.cmake` 在 CMake 配置阶段调用 SysConfig 命令行，把 `ti_msp_dl_config.c/.h`、`device.opt`、链接脚本等输出生成到构建目录；CMake 跟踪 `.syscfg` 的修改，下一次构建自动重新生成
* `User/` 存放代码生成的 `app_main.cpp` 和 `libxr_config.yaml`
* `libxr/` 是 LibXR 子模块

## CMake 集成

`cmake/LibXR.CMake` 用三个变量把 LibXR 接入工程：

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER mspm0)
set(LIBXR_NO_EIGEN True)
```

`LIBXR_SYSTEM None` 表示裸机系统，`LIBXR_DRIVER mspm0` 启用 LibXR 的 `driver/mspm0` 驱动目录。链接选项与 SDK 例程的 gcc makefile 相同（`-nostartfiles`、`--specs=nano.specs`、`--specs=nosys.specs`），C++ 运行时因此缺少的 `__dso_handle`、`_getpid` 和 `_kill` 由 LibXR 的 `driver/mspm0/mspm0_syscalls.c` 以弱定义提供，工程需要时可以自行定义。

## 构建

`CMakePresets.json` 提供 `debug` 和 `release` 两个 preset（Ninja 生成器，工具链文件 `cmake/arm-none-eabi-gcc.cmake`）。BSP 使用 XRobot 模块，配置前先运行一次 `xrobot setup`，它按 `xrobot.lock` 拉取模块并生成 `Modules/CMakeLists.txt`（xrobot 的安装见[环境配置](./README.md)）：

```bash
xrobot setup
cmake --preset debug
cmake --build --preset debug
```

产物在 `build/debug/` 下：`mspm0_minidb48.elf`、`.hex` 和 `.bin`。

## Docker 构建

镜像 `ghcr.io/xrobot-org/docker-image-mspm0:main` 内置 `arm-none-eabi-gcc`、CMake、Ninja、MSPM0 SDK 和 SysConfig，并设置好了 `MSPM0_SDK_INSTALL_DIR` 与 `SYSCONFIG_TOOL`：

```bash
docker run --rm -v "$PWD:/work" -w /work ghcr.io/xrobot-org/docker-image-mspm0:main \
  bash -c 'pip install xrobot==1.0.1 && xrobot setup && cmake --preset release && cmake --build --preset release'
```

## 常见问题

### CMake 配置提示找不到 MSPM0 SDK 或 SysConfig

CMake 配置阶段检查这两个变量：`MSPM0_SDK_INSTALL_DIR` 下应有 `.metadata/product.json`，`SYSCONFIG_TOOL` 应指向 `sysconfig_cli` 脚本本体。检查失败时配置以错误结束，错误信息会带上当前的变量值；按提示用环境变量或 `-D` 修正后重新配置。
