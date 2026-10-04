---
id: code-gen
title: 代码生成（CodeGenerator）
sidebar_position: 5
---

# 代码生成（CodeGenerator）

CodeGenerator（pip 包 `libxr`，安装见[环境配置](../env_setup/README.md)）根据 SDK 或工程描述文件生成 LibXR 的初始化代码，例如由 STM32CubeMX 的 `.ioc` 文件生成 C++ 外设对象和 `libxr_config.yaml`。本章说明代码生成器读取的工程输入、`libxr_config.yaml` 中各外设的设置和约束，以及生成的代码如何接入工程；运行期 API 见[基础编程（LibXR）](../basic_coding/README.md)。

## 章节

- [STM32 代码生成](./stm32/README.md)
- [与 XRobot 集成](./xrobot_inter.md)

STM32 部分包括 GPIO、UART、SPI、I2C、ADC、DAC、CAN、PWM、Flash、Cache、Watchdog、Timebase 和软件定时器的生成说明。
