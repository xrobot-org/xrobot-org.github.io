---
id: env-setup-hpm
title: HPM Environment Setup
sidebar_position: 5
---

# HPM Environment Setup

This page describes how LibXR integrates on HPM.

The template project is a starting point:

- [HPM5301_LibXR_Template](https://github.com/xrobot-org/HPM5301_LibXR_Template)

## What Already Exists in Mainline

According to the current `driver/hpm` directory in `libxr master`, the tree already contains these drivers:

- `hpm_gpio.*`
- `hpm_i2c.*`
- `hpm_pwm.*`
- `hpm_timebase.*`

`driver/hpm/CMakeLists.txt` pulls them into the build directly.

## Basic Integration Model

The following is an excerpt from `cmake/LibXR.CMake` of [HPM5301_LibXR_Template](https://github.com/xrobot-org/HPM5301_LibXR_Template):

```cmake
# LibXR platform/driver selection
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER hpm)
set(LIBXR_NO_EIGEN True)

# ...

# Import LibXR as a subproject
add_subdirectory("${LIBXR_DIR}" "${CMAKE_CURRENT_BINARY_DIR}/libxr")

# Make LibXR compile with the same HPM SDK compile options/includes.
if(DEFINED HPM_SDK_LIB_ITF AND TARGET ${HPM_SDK_LIB_ITF})
    target_link_libraries(xr PUBLIC ${HPM_SDK_LIB_ITF})
endif()

# Let app sources directly include LibXR headers.
if(TARGET app)
    target_link_libraries(app PUBLIC xr)
endif()

# Ensure LibXR object files are linked into the final ELF target.
if(DEFINED APP_ELF_NAME AND TARGET ${APP_ELF_NAME})
    target_link_libraries(${APP_ELF_NAME} xr)
endif()
```

`xr` links `${HPM_SDK_LIB_ITF}`, so LibXR is compiled with the same HPM SDK options and include paths as the application.

The preconditions are:

- the project already builds with the HPM SDK
- the project already wires in HPM SDK headers, startup files, linker scripts, and board initialization
- LibXR is added on top of that baseline to provide `driver/hpm` plus the common runtime/middleware layers

## Practical Entry Order

An HPM project integrates LibXR in this order:

1. get the minimal HPM SDK or template project running first
2. verify that the project can already `add_subdirectory(libxr)` cleanly
3. then bring in concrete peripherals such as `HPMGPIO`, `HPMI2C`, `HPMPWM`, or `HPMTimebase`

## Current Boundary of `I2C`

The current HPM `I2C` line is no longer just a simple blocking wrapper. According to the current headers, `HPMI2C` already covers:

- 7-bit / 10-bit master addressing modes
- sequence frames
- transfer flags
- optional DMA-helper background paths
- wait policies and recovery logic

Whether these capabilities can be used in a given project depends on:

- whether the HPM SDK headers are complete
- whether matching DMA / interrupt helpers are present
- whether the target board’s clocks, pin setup, and bus-recovery path have been validated

## Current Boundary of `PWM`

`HPMPWM` currently supports two paths in mainline:

- if the SoC provides a standard PWM peripheral, it uses `hpm_pwm_drv`
- otherwise the code still has a `GPTMR` fallback path

The path depends on the chip and the SDK macro conditions.
