---
id: env-setup-hpm
title: HPM Environment Setup
sidebar_position: 5
---

# HPM Environment Setup

This page only describes the **current LibXR mainline integration boundary on HPM**. It does not try to replace the full HPM SDK GUI-based project-creation workflow.

For a practical starting point, refer to the template project first:

- [HPM5301_LibXR_Template](https://github.com/xrobot-org/HPM5301_LibXR_Template)

## What Already Exists in Mainline

According to the current `driver/hpm` directory in `libxr master`, the tree already contains these drivers:

- `hpm_gpio.*`
- `hpm_i2c.*`
- `hpm_pwm.*`
- `hpm_timebase.*`

Unlike some other platform pages, this is not a case where files exist in the directory but are still absent from the default build. `driver/hpm/CMakeLists.txt` pulls them into the build directly.

## Basic Integration Model

The HPM line still follows the standard “external LibXR project” integration pattern:

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER hpm)

add_subdirectory(path_to_libxr)
```

The preconditions are:

- your project already builds successfully with the HPM SDK
- the project already wires in HPM SDK headers, startup files, linker scripts, and board initialization
- LibXR is added on top of that baseline to provide `driver/hpm` plus the common runtime/middleware layers

LibXR does not replace the HPM SDK project skeleton. It is integrated after the HPM project itself is already valid.

## Practical Entry Order

If you are currently working on an HPM project, a reasonable order is:

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

Whether all of that is directly usable in your concrete project still depends on:

- whether the HPM SDK headers are complete
- whether matching DMA / interrupt helpers are present
- whether the target board’s clocks, pin setup, and bus-recovery path have been validated

So this page documents “capability that exists in mainline code,” not “feature guaranteed to be fully validated for every HPM project by default.”

## Current Boundary of `PWM`

`HPMPWM` currently supports two paths in mainline:

- if the SoC provides a standard PWM peripheral, it uses `hpm_pwm_drv`
- otherwise the code still has a `GPTMR` fallback path

That means the docs should not pretend there is only one fixed HPM PWM implementation. The actual path depends on your chip and the SDK macro conditions.

## What This Page Does Not Try to Cover

This page does not attempt to replace:

- HPM SDK installation or environment-variable tutorials
- graphical project-creation steps
- board clock/pin wizard screenshots
- full IDE or GUI operator manuals from the HPM SDK side

If those steps later become tightly coupled with LibXR integration and stabilize inside a template repository, they can be documented there separately.
