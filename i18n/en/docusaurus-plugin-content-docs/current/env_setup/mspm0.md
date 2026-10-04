---
id: env-setup-mspm0
title: MSPM0 Environment Setup
sidebar_position: 3
---

# MSPM0 Environment Setup

The current documented baseline uses the GNU Arm Embedded Toolchain with prefix `arm-none-eabi-`. Compatibility with TI Arm Clang has not been verified in this line.

One important boundary: current `libxr master` does **not** mean “every MSPM0 driver is already part of the default build.” According to the current `driver/mspm0/CMakeLists.txt`, the default build list includes `GPIO / PWM / Timebase / UART`, while `SPI / I2C` source files already exist in the tree but are not yet pulled into the default MSPM0 driver build path.

If you only need a quick starting point, use the MSPM0 Docker image:

- `ghcr.io/xrobot-org/docker-image-mspm0:main`

## CMake Configuration

For an external LibXR-based MSPM0 project, the usual shape is:

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER mspm0)
set(LIBXR_NO_EIGEN True)
set(MSPM0_SDK_DIR "${CMAKE_CURRENT_SOURCE_DIR}/mspm0-sdk")

include("${CMAKE_SOURCE_DIR}/cmake/LibXR.CMake")
```

Meaning:

- `LIBXR_SYSTEM None`: bare-metal integration
- `LIBXR_DRIVER mspm0`: enable the LibXR MSPM0 driver directory
- `MSPM0_SDK_DIR`: points to the TI MSPM0 SDK root
- `cmake/LibXR.CMake`: wires LibXR and the MSPM0 SDK into the project

Typical responsibility split:

- the root `CMakeLists.txt` owns the final application target, user sources, link options, and post-processing
- `cmake/LibXR.CMake` owns LibXR platform selection, SDK path checks, SysConfig output checks, and MSPM0-specific dependencies for the `xr` target

## Recommended Directory Layout

```text
.
|-- CMakeLists.txt
|-- cmake/
|   `-- LibXR.CMake
|-- libxr/
|-- mspm0-sdk/
|-- src/
`-- sysconfig/
```

Where:

- `libxr/` is the LibXR source tree
- `mspm0-sdk/` is the TI MSPM0 SDK root
- `src/` is the application source directory
- `sysconfig/` stores generated SysConfig output

If your SDK is not kept inside the repository, `MSPM0_SDK_DIR` can point somewhere else.

## SysConfig Output Requirements

MSPM0 projects typically depend on SysConfig-generated files. CMake is normally responsible only for finding and consuming them, not for invoking SysConfig automatically.

Recommended location:

```text
sysconfig/
```

CMake usually needs these files to exist:

- `ti_msp*_config.c`
- `ti_msp*_config.h`
- `device.opt`
- one `.lds` linker script, commonly named `device_linker.lds`

If the project uses automatic discovery, the root project does not need to hard-code names such as `ti_msp_dl_config.c`; it is enough to keep the generated files under `sysconfig/`.

If you modify the `.syscfg` file, regenerate these outputs before running CMake again.

## Chip-Specific Items

Even though this page is generic, several items must still track the actual chip or board:

- startup-file path
- `driverlib.a` location
- SysConfig target board / target chip
- compiler macros such as `__MSPM0xxxx__`

Many MSPM0 build issues are ultimately “chip-specific files were not switched consistently.”

## Current MSPM0 Driver Coverage in Mainline

The default MSPM0 source list contains:

- `mspm0_gpio.*`
- `mspm0_pwm.*`
- `mspm0_timebase.*`
- `mspm0_uart.*`
- `mspm0_spi.*`
- `mspm0_i2c.*`
- `mspm0_group1_shared.cpp`
- `mspm0_atomic_shim.c`

SPI/I2C are already part of the LibXR MSPM0 build, so upper projects do not need to add those sources again. The project still supplies the matching SDK, SysConfig output, and peripheral initialization.

## Toolchain Requirements

Recommended tools:

- `cmake`
- `ninja`
- `arm-none-eabi-gcc`
- `arm-none-eabi-g++`
- `arm-none-eabi-objcopy`

A typical direct build command on the host looks like this:

```powershell
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=arm-none-eabi-gcc -DCMAKE_CXX_COMPILER=arm-none-eabi-g++ -DCMAKE_ASM_COMPILER=arm-none-eabi-gcc
cmake --build build
```

## Docker Build

If you do not want to install the toolchain locally, use Docker instead.

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\docker_build.ps1
```

Bash:

```bash
bash ./tools/docker_build.sh
```

The PowerShell script supports:

```powershell
.\tools\docker_build.ps1 -Image ghcr.io/xrobot-org/docker-image-mspm0:main -BuildType Release -BuildDir build -CCompiler arm-none-eabi-gcc -CxxCompiler arm-none-eabi-g++ -AsmCompiler arm-none-eabi-gcc
```

The Bash script supports these environment variables:

- `XROBOT_MSPM0_IMAGE`
- `BUILD_TYPE`
- `BUILD_DIR`
- `C_COMPILER`
- `CXX_COMPILER`
- `ASM_COMPILER`

## Common Problems

### CMake cannot find the MSPM0 SDK

Check whether:

```text
${MSPM0_SDK_DIR}/source
```

exists. If it does not, the SDK path is wrong.

### CMake cannot find SysConfig-generated files

Check whether `sysconfig/` already contains:

- `ti_msp*_config.c`
- `ti_msp*_config.h`
- `device.opt`
- `.lds`

If files are missing, SysConfig output has not been generated yet, or the output directory no longer matches the CMake expectation.

### Link warnings such as `_write/_read/_close`

If the project uses:

```text
--specs=nano.specs
--specs=nosys.specs
```

then warnings about `_write`, `_read`, `_close`, `_isatty`, `_fstat`, and similar symbols are common. As long as the final ELF is produced successfully, bare-metal runtime behavior is usually unaffected.

## Example Project

- [MSPM0G3507 LibXR Template](https://github.com/xrobot-org/MSPM0G3507_LibXR_Template)
