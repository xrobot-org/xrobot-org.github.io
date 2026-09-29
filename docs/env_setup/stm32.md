---
id: env-setup-stm32
title: STM32环境配置
sidebar_position: 1
---

# STM32 环境配置

本文适用于由 `STM32CubeMX` 导出的 **CMake 工程**。推荐基于 `VS Code` 开发。`STM32CubeMX2 / HAL2` 当前不在支持范围内。

推荐配合[视频教程](https://space.bilibili.com/339766655/lists/5028472)使用此文档。

## 基础环境

Windows 安装：

* [git](https://git-scm.com/)
* [python](https://www.python.org/downloads/)

Linux 使用 apt 安装：

```bash
sudo apt update
sudo apt install -y git python3 python3-pip cmake tar xz-utils wget pipx ninja-build
```

## VS Code 开发

先用 `STM32CubeMX` 建工程，并导出 **CMake** 工程。`Project Manager` 里的 `Default Compiler/Linker` 选择 `gcc` 或 `starm-clang` 即可。这个设置会写到工程根目录 `CMakePresets.json` 的 `toolchainFile`，通常对应 `${sourceDir}/cmake/gcc-arm-none-eabi.cmake` 或 `${sourceDir}/cmake/starm-clang.cmake`。

建议安装：

* `STMicroelectronics.stm32-vscode-extension`
* [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot)

`XRobot.xrobot` 提供两个视图：LibXR 视图调用代码生成器并编辑 `User/libxr_config.yaml`；XRobot 视图显示 XRobot BSP 的状态、产品和实例，所有修改都通过 `xrobot` 命令完成。

<img src="/img/xrobot_vscode_plugin_setup.png" alt="XRobot VS Code 插件界面" width="360" />

## 工具链

当前推荐的编译器选择仍然是：

* `gcc`
* `starm-clang`

如果你要配合 `clangd`、`CLion` 或命令行自己接管编译，建议优先使用**纯 gcc** 或 **纯 starm-clang**，不要默认选混合 `Hybrid` 模式。

`clangd` 目前对 ST-ARM-CLANG 的 `--multi-lib-config` 识别并不稳定。混合 `Hybrid` 模式下，`compile_commands.json` 往往会带出额外参数，IDE 体验会比较差。

如果你明确要走 `starm-clang`，当前更推荐 `picolibc`。`starm-clang.cmake` 里的 `STARM_TOOLCHAIN_CONFIG` 仍然有 `STARM_HYBRID`、`STARM_NEWLIB`、`STARM_PICOLIBC` 三种配置，默认不建议继续用 `STARM_HYBRID`。

## CLion / 命令行编译

如果你不走 VS Code 插件流，而是要自己在命令行或 `CLion` 里接管构建，可以按下面方式配置。

Windows 需要先配置相关 `PATH`。安装 `STM32CubeCLT` 可以简化下面某些设置。

```bash
# gcc
set PATH=%PATH%;C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\gnu-tools-for-stm32\${版本号}\bin

# starm-clang
set PATH=%PATH%;C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\st-arm-clang\${版本号}\bin;
```

需要设置环境变量：

Windows：

```powershell
$env:GCC_TOOLCHAIN_ROOT = "C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\gnu-tools-for-stm32\${版本号}\bin"
$env:CLANG_GCC_CMSIS_COMPILER = "C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\st-arm-clang\${版本号}"
```

Linux：

```bash
export GCC_TOOLCHAIN_ROOT=/opt/arm-gnu-toolchain-14.2.rel1-x86_64-arm-none-eabi/bin
export CLANG_GCC_CMSIS_COMPILER=/opt/st-arm-clang
```

编译时还要指定 `-DCMAKE_TOOLCHAIN_FILE="cmake/gcc-arm-none-eabi.cmake"` 或 `-DCMAKE_TOOLCHAIN_FILE="cmake/starm-clang.cmake"` 来选择工具链。对于 `starm-clang.cmake`，也可以继续通过 `-DSTARM_TOOLCHAIN_CONFIG=STARM_NEWLIB` 或 `-DSTARM_TOOLCHAIN_CONFIG=STARM_PICOLIBC` 控制标准库配置。

## 常见问题

### 旧版 CubeMX 工程迁移到新版编译时链接不到 `ob`

如果提示链接不到库 `ob`，则在工程根目录的 `CMakeLists.txt` 中添加：

```cmake
# Remove wrong libob.a library dependency when using cpp files
list(REMOVE_ITEM CMAKE_C_IMPLICIT_LINK_LIBRARIES ob)
```

### 工具链切换怎么做

如果你已经接入了代码生成工具，也可以直接使用 `xr_stm32_toolchain_switch` 切换工具链和标准库，例如：

```bash
xr_stm32_toolchain_switch gcc
xr_stm32_toolchain_switch clang --newlib
xr_stm32_toolchain_switch clang --picolibc
```

这个命令会直接修改 `CMakePresets.json` 和 `cmake/starm-clang.cmake`，改完后重启 `VS Code` 即可生效。
