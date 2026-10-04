---
id: basic-cmake
title: CMake Configuration
sidebar_position: 0
---

# CMake Configuration

LibXR exports the CMake target `xr` and uses C++20. The upper project supplies the toolchain, startup code, linker script and vendor SDK; LibXR selects its system layer, peripheral backend and feature options.

## Basic integration

A Linux project can select the host system and driver directly:

```cmake
cmake_minimum_required(VERSION 3.12)
project(example LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LIBXR_SYSTEM linux CACHE STRING "" FORCE)
set(LIBXR_DRIVER linux CACHE STRING "" FORCE)
add_subdirectory(libxr)

add_executable(app main.cpp)
target_link_libraries(app PRIVATE xr)
```

Cross-compiled projects set `LIBXR_SYSTEM` and `LIBXR_DRIVER` before adding LibXR. STM32 + FreeRTOS, for example:

```cmake
set(LIBXR_SYSTEM freertos CACHE STRING "" FORCE)
set(LIBXR_DRIVER st CACHE STRING "" FORCE)
add_subdirectory(libxr)
```

## Systems and drivers

Current `system/` implementations are:

- `freertos`
- `linux`
- `none`
- `threadx`
- `webasm`
- `webots`

Current `driver/` backends are:

- `st`
- `ch`
- `esp`
- `hpm`
- `linux`
- `mspm0`
- `webasm`
- `webots`

Names are normalized to lowercase internally. Windows can host MCU cross-compilation and documentation work. The current tree has no `system/windows` or `driver/windows`, so there is no native Windows LibXR backend.

## Common options

| Option | Purpose |
| --- | --- |
| `LIBXR_NO_EIGEN` | Exclude Eigen-dependent geometry and kinematics |
| `LIBXR_DEFAULT_SCALAR` | Default math scalar, `double` by default |
| `LIBXR_SINGLE_CORE` | Single-core concurrency alignment policy |
| `LIBXR_DEV_ASSERT_BUILD` | Enable maintainer assertions; OFF by default |
| `LIBXR_TEST_BUILD` | Build repository tests |
| `LIBXR_STATIC_BUILD` | Build a static library |
| `LIBXR_SHARED_BUILD` | Build a shared library |
| `LIBXR_OBJECT_BUILD` | Build an object library |

The default library kind is static. Debug builds define `LIBXR_DEBUG_BUILD`; `LIBXR_DEV_ASSERT_BUILD` separately controls `DEV_ASSERT`.

## Logging and formatting

These variables become public compile definitions:

```cmake
LIBXR_LOG_LEVEL
LIBXR_LOG_OUTPUT_LEVEL
XR_LOG_MESSAGE_MAX_LEN
LIBXR_DEFAULT_SCALAR
```

Formatting support can also be trimmed for 64-bit integers, double, scientific notation, pointers, explicit argument indexing and related features. See `cmake/config.cmake` for the complete option list.

## XRobot modules

Set `XROBOT_MODULES_DIR` before adding LibXR (CMake 3.19 or newer is required):

```cmake
set(XROBOT_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/Modules")
add_subdirectory(libxr)
```

LibXR then includes the `CMakeLists.txt` that `xrobot setup` generates in that directory and checks `User/xrobot_main.hpp`; see the XRobot [CMake integration](../proj_man/setup.md).

Use a fresh build directory after changing the system, driver, compiler or SDK so the previous CMake cache does not carry over detection results.
