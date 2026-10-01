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

`XRobot.xrobot` provides two views: the LibXR view runs the code generator and edits `User/libxr_config.yaml`; the XRobot view shows an XRobot BSP's state, products and instances and makes every change through an `xrobot` command.

## Toolchain Choice

Current recommended compiler choices are still:

- `gcc`
- `starm-clang`

If you want to cooperate with `clangd`, `CLion`, or command-line-driven builds, prefer **pure gcc** or **pure starm-clang**. Do not default to the mixed `Hybrid` mode.

`clangd` is still not reliable with ST-ARM-CLANG's `--multi-lib-config`. In `Hybrid` mode, `compile_commands.json` often ends up carrying extra arguments that make IDE behavior worse.

If you explicitly choose `starm-clang`, `picolibc` is the current recommended standard-library configuration. The available `STARM_TOOLCHAIN_CONFIG` values remain `STARM_HYBRID`, `STARM_NEWLIB`, and `STARM_PICOLIBC`, but current docs do not recommend staying on `STARM_HYBRID` by default.

## CLion / Command-Line Builds

If you are not using the VS Code plugin flow and want to drive the build yourself in `CLion` or the shell, configure the environment like this.

On Windows, you usually need relevant toolchain paths in `PATH`. Installing `STM32CubeCLT` can simplify some of this.

```bash
# gcc
set PATH=%PATH%;C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\gnu-tools-for-stm32\${version}\bin

# starm-clang
set PATH=%PATH%;C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\st-arm-clang\${version}\bin;
```

Environment variables:

Windows:

```powershell
$env:GCC_TOOLCHAIN_ROOT = "C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\gnu-tools-for-stm32\${version}\bin"
$env:CLANG_GCC_CMSIS_COMPILER = "C:\Users\$env:USERNAME\AppData\Local\stm32cube\bundles\st-arm-clang\${version}"
```

Linux:

```bash
export GCC_TOOLCHAIN_ROOT=/opt/arm-gnu-toolchain-14.2.rel1-x86_64-arm-none-eabi/bin
export CLANG_GCC_CMSIS_COMPILER=/opt/st-arm-clang
```

Select the toolchain with `-DCMAKE_TOOLCHAIN_FILE="cmake/gcc-arm-none-eabi.cmake"` or `-DCMAKE_TOOLCHAIN_FILE="cmake/starm-clang.cmake"`. For `starm-clang.cmake`, you can also keep using `-DSTARM_TOOLCHAIN_CONFIG=STARM_NEWLIB` or `-DSTARM_TOOLCHAIN_CONFIG=STARM_PICOLIBC` to choose the C library.

## Common Problems

### Legacy CubeMX projects fail to link `ob`

If the build complains about library `ob`, add this to the root `CMakeLists.txt`:

```cmake
# Remove wrong libob.a library dependency when using cpp files
list(REMOVE_ITEM CMAKE_C_IMPLICIT_LINK_LIBRARIES ob)
```

### Switching toolchains

If you already use the code-generation toolchain, `libxr stm32 toolchain` can switch the toolchain and C library directly:

```bash
libxr stm32 toolchain gcc
libxr stm32 toolchain clang --newlib
libxr stm32 toolchain clang --picolibc
```

That command edits `CMakePresets.json` and `cmake/starm-clang.cmake` directly. Restart `VS Code` afterwards so the new configuration is picked up cleanly.
