---
id: env-setup-stm32
title: STM32 Environment Setup
sidebar_position: 1
---

# STM32 Environment Setup

This page applies to **CMake projects exported by `STM32CubeMX`**. `VS Code` is the recommended editor flow. `STM32CubeMX2 / HAL2` is currently out of scope.

The video tutorial list is still a useful companion:

- [Bilibili tutorial list](https://space.bilibili.com/339766655/lists/5028472)

## Basic Environment

Windows:

- [git](https://git-scm.com/)
- [python](https://www.python.org/downloads/)
- [STM32CubeMX](https://www.st.com/en/development-tools/stm32cubemx.html)
- CMake and Ninja
- the compiler `arm-none-eabi-gcc` (GNU Tools for STM32) or `starm-clang` (ST Arm Clang)

CMake, Ninja and the compilers can be downloaded by `STMicroelectronics.stm32-vscode-extension` into `%LOCALAPPDATA%\stm32cube\bundles`, or installed with `STM32CubeCLT`. For command-line builds, the directories of these tools must be on `PATH`, see the section "CLion / Command-Line Builds" below.

Linux:

```bash
sudo apt update
sudo apt install -y git python3 python3-pip cmake tar xz-utils wget pipx ninja-build
```

## VS Code Workflow

Create the project in `STM32CubeMX` first and export it as a **CMake** project. In `Project Manager`, choose `gcc` or `starm-clang` as `Default Compiler/Linker`. CubeMX writes that choice into `CMakePresets.json`, typically through `${sourceDir}/cmake/gcc-arm-none-eabi.cmake` or `${sourceDir}/cmake/starm-clang.cmake`.

Recommended extensions:

- `STMicroelectronics.stm32-vscode-extension`
- [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot)

`XRobot.xrobot` provides two views: the LibXR view works on STM32CubeMX projects, edits `User/libxr_config.yaml` and runs the `libxr` command; the XRobot view shows the Modules, configurations and instances of a BSP and changes Modules and instances through `xrobot` commands.

## Toolchain Choice

Current recommended compiler choices are still:

- `gcc`
- `starm-clang`

For `clangd`, `CLion` or command-line builds, pure gcc or pure starm-clang is recommended; the mixed `Hybrid` mode is not.

`clangd` is still not reliable with ST-ARM-CLANG's `--multi-lib-config`. In `Hybrid` mode, `compile_commands.json` often ends up carrying extra arguments that make IDE behavior worse.

With `starm-clang`, `picolibc` is the recommended C library. `STARM_TOOLCHAIN_CONFIG` in `starm-clang.cmake` accepts `STARM_HYBRID`, `STARM_NEWLIB` and `STARM_PICOLIBC`; `STARM_HYBRID` is not recommended.

## CLion / Command-Line Builds

For builds from the command line or in `CLion`, configure the environment as follows.

On Windows, you usually need relevant toolchain paths in `PATH`. Installing `STM32CubeCLT` can simplify some of this.

```powershell
# gcc
$env:PATH += ";$env:LOCALAPPDATA\stm32cube\bundles\gnu-tools-for-stm32\<version>\bin"

# starm-clang
$env:PATH += ";$env:LOCALAPPDATA\stm32cube\bundles\st-arm-clang\<version>\bin"
```

When `STARM_TOOLCHAIN_CONFIG` is `STARM_HYBRID`, `starm-clang.cmake` also reads these two environment variables:

Windows:

```powershell
$env:GCC_TOOLCHAIN_ROOT = "$env:LOCALAPPDATA\stm32cube\bundles\gnu-tools-for-stm32\<version>\bin"
$env:CLANG_GCC_CMSIS_COMPILER = "$env:LOCALAPPDATA\stm32cube\bundles\st-arm-clang\<version>"
```

Linux:

```bash
export GCC_TOOLCHAIN_ROOT=/opt/arm-gnu-toolchain-14.2.rel1-x86_64-arm-none-eabi/bin
export CLANG_GCC_CMSIS_COMPILER=/opt/st-arm-clang
```

Select the toolchain with `-DCMAKE_TOOLCHAIN_FILE="cmake/gcc-arm-none-eabi.cmake"` or `-DCMAKE_TOOLCHAIN_FILE="cmake/starm-clang.cmake"`. The C library of `starm-clang.cmake` is set by its `set(STARM_TOOLCHAIN_CONFIG ...)` line, which overrides `-DSTARM_TOOLCHAIN_CONFIG=...` on the command line; edit that line, or run `libxr stm32 toolchain clang --newlib` / `--picolibc`.

## Common Problems

### Legacy CubeMX projects fail to link `ob`

If the build complains about library `ob`, add this to the root `CMakeLists.txt`:

```cmake
# Remove wrong libob.a library dependency when using cpp files
list(REMOVE_ITEM CMAKE_C_IMPLICIT_LINK_LIBRARIES ob)
```

### Switching toolchains

With libxr installed, `libxr stm32 toolchain` switches the toolchain of the default preset of an STM32CubeMX project and the C library of starm-clang, for example:

```bash
libxr stm32 toolchain gcc
libxr stm32 toolchain clang --newlib
libxr stm32 toolchain clang --picolibc
```

The command replaces `toolchainFile` of the default preset in `CMakePresets.json` and, when a C library is chosen, rewrites the `set(STARM_TOOLCHAIN_CONFIG ...)` line in `cmake/starm-clang.cmake`. When the toolchain changes, it deletes the `build/` and `cmake-build*` directories configured with the old toolchain. Restart `VS Code` afterwards so the new configuration is picked up.
