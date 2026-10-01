---
id: code-gen
title: 代码生成（CodeGenerator）
sidebar_position: 5
---

# 代码生成（CodeGenerator）

CodeGenerator 的核心作用，是根据 SDK 或工程描述文件生成 LibXR 侧的初始化与适配代码。例如依靠 STM32CubeMX 的 IOC 文件，生成对应的 C++ 外设初始化代码与 `libxr_config.yaml` 配置骨架。

本章介绍：

- 如何让代码生成器识别工程输入；
- 如何通过 YAML 配置生成结果；
- 不同外设 / 平台在代码生成阶段的参数项和约束；
- 生成的代码如何与工程集成。

不包含具体运行期 API 的详细使用说明；运行期语义请回到 `basic_coding` 和对应平台页查看。

## 章节

- [STM32 代码生成](./stm32/README.md)
- [XRobot 集成代码生成](./xrobot_inter.md)

STM32 部分包括 GPIO、UART、SPI、I2C、ADC、DAC、CAN、PWM、Flash、Cache、Watchdog、Timebase 和软件定时器的生成说明。
