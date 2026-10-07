---
id: env-setup-mspm0
title: MSPM0 Environment Setup
sidebar_position: 3.5
---

# MSPM0 Environment Setup

An MSPM0 project builds on the TI MSPM0 SDK and SysConfig, with CMake, Ninja and the GNU Arm Embedded Toolchain (compiler prefix `arm-none-eabi-`). The BSPs [bsp-mspm0g3507-mini](https://github.com/xrobot-org/bsp-mspm0g3507-mini) and [bsp-mspm0g3519-mini](https://github.com/xrobot-org/bsp-mspm0g3519-mini) are fully buildable projects and serve as the examples on this page; [Code Generation](../code_gen/mspm0/README.md) describes how `libxr mspm0 setup` generates LibXR code in such a project.

For a quick start the Docker image `ghcr.io/xrobot-org/docker-image-mspm0:main` is recommended, see [Docker Build](#docker-build) below.

## Base Environment

A local build installs:

* CMake (3.20 or newer) and Ninja
* `arm-none-eabi-gcc` ([GNU Arm Embedded Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads))
* [TI MSPM0 SDK](https://www.ti.com/tool/MSPM0-SDK)
* The [SysConfig](https://www.ti.com/tool/SYSCONFIG) standalone installation, whose `sysconfig_cli` is the command-line entry point

The CMake project finds the SDK and SysConfig through two variables, named after the SDK's `imports.mak`; environment variables and the CMake cache (`-D`) both work:

* `MSPM0_SDK_INSTALL_DIR`: the MSPM0 SDK root
* `SYSCONFIG_TOOL`: the full path of the SysConfig command line, `sysconfig_cli.bat` on Windows and `sysconfig_cli.sh` on Linux

A Windows PowerShell example:

```powershell
$env:MSPM0_SDK_INSTALL_DIR = "C:\ti\mspm0_sdk_2_11_00_07"
$env:SYSCONFIG_TOOL = "C:\ti\sysconfig_1.28.1\sysconfig_cli.bat"
```

## Project Layout

The BSP directory structure:

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

* `main.c` sits in the project root, calls the SysConfig-generated `SYSCFG_DL_init()` for the clocks, pins and peripherals, and then enters `app_main()`
* The `.syscfg` file is the SysConfig project, in the project root; it describes the device, clocks, pins and peripherals, and changing the device means changing this one file
* `cmake/MSPM0SysConfig.cmake` runs the SysConfig command line at the CMake configure step and generates `ti_msp_dl_config.c/.h`, `device.opt`, the linker script and the rest into the build directory; CMake tracks changes to the `.syscfg` and regenerates on the next build
* `User/` holds the generated `app_main.cpp` and `libxr_config.yaml`
* `libxr/` is the LibXR submodule

## CMake Integration

`cmake/LibXR.CMake` brings LibXR into the project with three variables:

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER mspm0)
set(LIBXR_NO_EIGEN True)
```

`LIBXR_SYSTEM None` is the bare-metal system and `LIBXR_DRIVER mspm0` enables the LibXR `driver/mspm0` driver directory. The newlib system calls come from `libxr/driver/mspm0/mspm0_syscalls.c`; stub functions such as `_write` or `_read` written elsewhere in the project would duplicate it.

## Build

`CMakePresets.json` provides the `debug` and `release` presets (Ninja generator, toolchain file `cmake/arm-none-eabi-gcc.cmake`):

```bash
cmake --preset debug
cmake --build --preset debug
```

The artifacts land in `build/debug/`: `mspm0_minidb48.elf`, `.hex` and `.bin`.

## Docker Build

The image `ghcr.io/xrobot-org/docker-image-mspm0:main` ships `arm-none-eabi-gcc`, CMake, Ninja, the MSPM0 SDK and SysConfig, with `MSPM0_SDK_INSTALL_DIR` and `SYSCONFIG_TOOL` already set:

```bash
docker run --rm -v "$PWD:/work" -w /work ghcr.io/xrobot-org/docker-image-mspm0:main \
  bash -c 'cmake --preset release && cmake --build --preset release'
```

## FAQ

### CMake configuration reports the MSPM0 SDK or SysConfig missing

The configure step checks both variables: `MSPM0_SDK_INSTALL_DIR` should contain `.metadata/product.json`, and `SYSCONFIG_TOOL` should point at the `sysconfig_cli` script itself. A failed check ends the configuration with an error that includes the current variable value; fix the variable through the environment or `-D` as the message suggests and configure again.
