---
id: intro
title: Welcome
sidebar_position: 1
---

# Welcome

This documentation covers the environment setup, basic usage and advanced usage of LibXR, CodeGenerator and XRobot. Questions can be filed as issues in the corresponding repository or raised in the QQ group 608182228.

## Getting Started

* [LibXR](../docs/basic_coding): A cross-platform C++ compatibility layer that includes peripheral drivers, data structures, communication middleware, OS abstractions, and math utilities.

* [XRUSB](../docs/xrusb): The USB protocol stack built into LibXR.

* [CodeGenerator](../docs/code_gen): generates the peripheral objects and the entry function `app_main` from an STM32CubeMX project and adds LibXR to the project's CMake build.

* [XRobot](../docs/proj_man): the Module manager and main function generator for LibXR; it fetches Modules, locks each one to a commit, and generates the main function `XRobotMain` from the configurations under `User/`.

## Learning Path and Onboarding

[XRobot Onboarding](https://xrobot.work/XRobot-Onboarding/)

![XRobot Logo](/img/XRobot.png)
