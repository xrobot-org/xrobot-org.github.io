---
id: intro
title: Welcome
sidebar_position: 1
---

# Welcome

This documentation covers the environment setup, basic usage and advanced usage of LibXR, CodeGenerator and XRobot. Questions can be filed as issues in the corresponding repository or raised in the QQ group 608182228.

## The Three Projects

LibXR is a cross-platform C++ compatibility layer with peripheral drivers, data structures, communication middleware, OS abstractions, math utilities and the USB stack XRUSB; it can be used on its own in bare-metal, RTOS and Linux projects. CodeGenerator and XRobot are two command-line tools used with LibXR.

Take an STM32 board as an example: once the peripherals are configured in STM32CubeMX, CodeGenerator reads the `.ioc` file, generates the peripheral objects and the entry function `app_main`, and adds LibXR to the project's CMake build; XRobot then fetches Modules such as an IMU driver and an attitude estimator, locks each Module to a commit, and generates the main function `XRobotMain` from the configurations under `User/`, which constructs the Module instances in order. A project that uses only LibXR needs neither tool; on Linux and other platforms without STM32CubeMX, a BSP needs only XRobot.

| Project | Role | Distributed as | Command | Documentation |
| --- | --- | --- | --- | --- |
| LibXR | Cross-platform C++ library | Git repository, usually added to a project as a submodule | none | [Basic Programming](./basic_coding/README.md) |
| CodeGenerator | Generates the peripheral objects, `app_main` and the CMake integration from an STM32CubeMX project | pip package `libxr` | `libxr` | [Code Generation](./code_gen/README.md) |
| XRobot | Module management and main function generation | pip package `xrobot` | `xrobot` | [Project Management](./proj_man/README.md) |

## Reading Order

[Quick Start](./quick_start.md) goes from installing the tools to building a first program. After that, read by project type:

- a project that uses only LibXR: the page for its platform in [Environment Setup](./env_setup/README.md), then [Basic Programming](./basic_coding/README.md);
- an STM32CubeMX project: [STM32 Environment Setup](./env_setup/stm32.md) and [Code Generation](./code_gen/README.md), with the LibXR interfaces looked up in Basic Programming as needed;
- an XRobot BSP: [Project Management](./proj_man/README.md); writing Modules is covered in its [Writing a Module](./proj_man/create_mod.md).

The debug interfaces, XRUSB, advanced programming, design concepts and performance tests come after these chapters and are read as needed.

## Learning Path and Onboarding

[XRobot Onboarding](https://xrobot.work/XRobot-Onboarding/) (Chinese)

![XRobot Logo](/img/XRobot.png)
