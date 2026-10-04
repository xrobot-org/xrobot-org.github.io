---
id: intro
title: 欢迎
sidebar_position: 1
---

# 欢迎

本文档介绍 LibXR、CodeGenerator 和 XRobot 的环境配置、基础使用和进阶用法。问题可以在对应仓库提交 issue，或在 QQ 群 608182228 中交流。

## 三个项目

LibXR 是跨平台的 C++ 兼容层，包含外设驱动、数据结构、通信中间件、操作系统封装、数学工具和 USB 协议栈 XRUSB，可以单独用于裸机、RTOS 和 Linux 工程。CodeGenerator 和 XRobot 是配合 LibXR 使用的两个命令行工具。

以一块 STM32 板子为例：在 STM32CubeMX 中配置好外设后，CodeGenerator 读取 `.ioc` 文件，生成外设对象和入口函数 `app_main`，并把 LibXR 接入工程的 CMake 构建；XRobot 再拉取 IMU 驱动、姿态解算等模块，把每个模块锁定到具体的提交，并根据 `User/` 下的配置生成主函数 `XRobotMain`，由它按顺序构造模块实例。只使用 LibXR 的工程不需要这两个工具；在 Linux 等不使用 STM32CubeMX 的平台上，BSP 只需要 XRobot。

| 项目 | 作用 | 发布形式 | 命令 | 文档 |
| --- | --- | --- | --- | --- |
| LibXR | 跨平台的 C++ 库 | Git 仓库，通常作为子模块加入工程 | 无 | [基础编程](./basic_coding/README.md) |
| CodeGenerator | 由 STM32CubeMX 工程生成外设对象、`app_main` 和 CMake 接入 | pip 包 `libxr` | `libxr` | [代码生成](./code_gen/README.md) |
| XRobot | 模块管理与主函数生成 | pip 包 `xrobot` | `xrobot` | [项目管理](./proj_man/README.md) |

## 阅读顺序

[快速开始](./quick_start.md) 从安装工具到构建出第一个程序。之后按工程类型阅读：

- 只使用 LibXR 的工程：[环境配置](./env_setup/README.md) 中对应平台的页面，然后是 [基础编程](./basic_coding/README.md)；
- STM32CubeMX 工程：[STM32 环境配置](./env_setup/stm32.md) 和 [代码生成](./code_gen/README.md)，LibXR 的接口按需查阅基础编程；
- XRobot BSP：[项目管理](./proj_man/README.md)，编写模块见其中的 [编写模块](./proj_man/create_mod.md)。

调试接口、XRUSB、进阶编程、设计思想和性能测试排在这些章节之后，按需阅读。

## 学习路线与任务引导

[XRobot Onboarding](https://xrobot.work/XRobot-Onboarding/)

![XRobot Logo](/img/XRobot.png)
