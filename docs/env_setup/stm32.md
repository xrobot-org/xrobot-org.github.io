---
id: env-setup-stm32
title: STM32 环境配置
sidebar_position: 1
---

# STM32 环境配置

本文适用于由 `STM32CubeMX` 导出的 **CMake 工程**。推荐基于 `VS Code` 开发。`STM32CubeMX2 / HAL2` 当前不在支持范围内。

推荐配合[视频教程](https://space.bilibili.com/339766655/lists/5028472)使用此文档。视频录制于 libxr 6.0.0 和 xrobot 1.0.0 发布之前，其中的命令是旧版写法：libxr 5.x 的 `xr_*` 命令与 6.0.0 的 `libxr` 子命令的对照见 [CodeGenerator 的 README](https://github.com/xrobot-org/LibXR_CppCodeGenerator#旧命令--old-commands)，xrobot 1.0.0 的命令见[项目管理](../proj_man/README.md#命令一览)。

## 基础环境

Windows 安装：

* [git](https://git-scm.com/)
* [python](https://www.python.org/downloads/)
* [STM32CubeMX](https://www.st.com/en/development-tools/stm32cubemx.html)
* CMake 和 Ninja
* 编译器 `arm-none-eabi-gcc`（GNU Tools for STM32）或 `starm-clang`（ST Arm Clang）

CMake、Ninja 和编译器可以由 `STMicroelectronics.stm32-vscode-extension` 下载到 `%LOCALAPPDATA%\stm32cube\bundles`，也可以通过 `STM32CubeCLT` 安装。在命令行构建时，这些工具所在的目录需要加入 `PATH`，见下文“CLion / 命令行编译”一节。

Linux 使用 apt 安装：

```bash
sudo apt update
sudo apt install -y git python3 python3-pip cmake tar xz-utils wget pipx ninja-build
```

Arm 编译器不在 apt 中，可以通过 STM32CubeCLT 的 Linux 版安装，也可以从 Arm 官网下载 [Arm GNU Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads)（`arm-none-eabi-gcc`），安装后把编译器所在的 `bin` 目录加入 `PATH`。[docker-image-stm32](docker.md) 镜像中已装有 Arm GNU Toolchain 14.2 和 ST Arm Clang，`arm-none-eabi-gcc` 与 `starm-clang` 都可以直接调用。

## VS Code 开发

先用 `STM32CubeMX` 建工程，并导出 **CMake** 工程。`Project Manager` 里的 `Default Compiler/Linker` 选择 `gcc` 或 `starm-clang` 即可。这个设置会写到工程根目录 `CMakePresets.json` 的 `toolchainFile`，通常对应 `${sourceDir}/cmake/gcc-arm-none-eabi.cmake` 或 `${sourceDir}/cmake/starm-clang.cmake`。

建议安装：

* `STMicroelectronics.stm32-vscode-extension`
* [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot)

`XRobot.xrobot` 的视图与前置条件见 [VS Code 扩展](README.md#vs-code-扩展)。

## 工具链

当前推荐的编译器选择仍然是：

* `gcc`
* `starm-clang`

配合 `clangd`、`CLion` 或在命令行构建时，建议使用纯 gcc 或纯 starm-clang，不建议使用混合 `Hybrid` 模式。

`clangd` 目前对 ST-ARM-CLANG 的 `--multi-lib-config` 识别并不稳定。混合 `Hybrid` 模式下，`compile_commands.json` 往往会带出额外参数，IDE 体验会比较差。

使用 `starm-clang` 时推荐 `picolibc`。`starm-clang.cmake` 中的 `STARM_TOOLCHAIN_CONFIG` 有 `STARM_HYBRID`、`STARM_NEWLIB`、`STARM_PICOLIBC` 三种配置，不建议使用 `STARM_HYBRID`。

## CLion / 命令行编译

在命令行或 `CLion` 中构建时，按以下方式配置环境。

Windows 需要先配置相关 `PATH`。安装 `STM32CubeCLT` 可以简化下面某些设置。

```powershell
# gcc
$env:PATH += ";$env:LOCALAPPDATA\stm32cube\bundles\gnu-tools-for-stm32\<版本号>\bin"

# starm-clang
$env:PATH += ";$env:LOCALAPPDATA\stm32cube\bundles\st-arm-clang\<版本号>\bin"
```

`STARM_TOOLCHAIN_CONFIG` 设为 `STARM_HYBRID` 时，`starm-clang.cmake` 还使用以下两个环境变量：

Windows：

```powershell
$env:GCC_TOOLCHAIN_ROOT = "$env:LOCALAPPDATA\stm32cube\bundles\gnu-tools-for-stm32\<版本号>\bin"
$env:CLANG_GCC_CMSIS_COMPILER = "$env:LOCALAPPDATA\stm32cube\bundles\st-arm-clang\<版本号>"
```

Linux（示例路径取自 docker-image-stm32 镜像，镜像没有设置这两个变量；本机安装时换成实际的安装目录）：

```bash
export GCC_TOOLCHAIN_ROOT=/opt/arm-gnu-toolchain-14.2.rel1-x86_64-arm-none-eabi/bin
export CLANG_GCC_CMSIS_COMPILER=/opt/st-arm-clang
```

编译时用 `-DCMAKE_TOOLCHAIN_FILE="cmake/gcc-arm-none-eabi.cmake"` 或 `-DCMAKE_TOOLCHAIN_FILE="cmake/starm-clang.cmake"` 选择工具链。`starm-clang.cmake` 使用的标准库由文件中 `set(STARM_TOOLCHAIN_CONFIG ...)` 一行决定，这一行会覆盖命令行的 `-DSTARM_TOOLCHAIN_CONFIG=...`；修改时编辑该行，或运行 `libxr stm32 toolchain clang --newlib` / `--picolibc`。

## 常见问题

### 旧版 CubeMX 工程迁移到新版编译时链接不到 `ob`

如果提示链接不到库 `ob`，则在工程根目录的 `CMakeLists.txt` 中添加：

```cmake
# Remove wrong libob.a library dependency when using cpp files
list(REMOVE_ITEM CMAKE_C_IMPLICIT_LINK_LIBRARIES ob)
```

### 工具链切换怎么做

安装 libxr 后，可以用 `libxr stm32 toolchain` 切换 STM32CubeMX 工程默认 preset 的工具链和 starm-clang 的标准库，例如：

```bash
libxr stm32 toolchain gcc
libxr stm32 toolchain clang --newlib
libxr stm32 toolchain clang --picolibc
```

该命令替换 `CMakePresets.json` 中 default preset 的 `toolchainFile`，选择标准库时改写 `cmake/starm-clang.cmake` 中的 `set(STARM_TOOLCHAIN_CONFIG ...)` 一行。工具链改变时，命令删除用旧工具链配置过的 `build/` 和 `cmake-build*` 目录。修改后重启 `VS Code`，使新配置生效。
