---
id: intro
title: 欢迎
sidebar_position: 1
---

# 欢迎

本文档介绍 LibXR、CodeGenerator 和 XRobot 的环境配置、基础使用和进阶用法。问题可以在对应仓库提交 issue，或在 QQ 群 608182228 中交流。

## 引导

* [LibXR](../docs/basic_coding)：跨平台的 C++ 兼容层，包含外设驱动、数据结构、通信中间件、操作系统封装与数学工具等

* [XRUSB](../docs/xrusb)：LibXR 内置的 USB 协议栈

* [CodeGenerator](../docs/code_gen)：由 STM32CubeMX 工程生成外设对象和入口函数 `app_main`，并把 LibXR 接入工程的 CMake 构建

* [XRobot](../docs/proj_man)：LibXR 的模块管理与主函数生成工具，拉取模块、把每个模块锁定到具体的提交，并根据 `User/` 下的配置生成主函数 `XRobotMain`

## 学习路线与任务引导

[XRobot Onboarding](https://xrobot.work/XRobot-Onboarding/)

![XRobot Logo](/img/XRobot.png)
