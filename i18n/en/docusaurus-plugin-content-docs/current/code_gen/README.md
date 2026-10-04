---
id: code-gen
title: Code Generation
sidebar_position: 5
---

# Code Generation

CodeGenerator (the pip package `libxr`; see [Environment Setup](../env_setup/README.md) for installation) generates LibXR initialization code from SDK or project description files, for example C++ peripheral objects and `libxr_config.yaml` from an STM32CubeMX `.ioc` file. This chapter describes the project inputs the generator reads, the settings and constraints of each peripheral in `libxr_config.yaml`, and how the generated code is integrated into the project; the runtime API is described in [Basic Programming (LibXR)](../basic_coding/README.md).

## Sections

- [STM32 Code Generation](./stm32/README.md)
- [Integrate with XRobot](./xrobot_inter.md)

The STM32 section describes the generation of GPIO, UART, SPI, I2C, ADC, DAC, CAN, PWM, Flash, Cache, Watchdog, Timebase and the software timer.
