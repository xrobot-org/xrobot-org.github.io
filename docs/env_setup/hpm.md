---
id: env-setup-hpm
title: HPM 环境配置
sidebar_position: 5
---

# HPM 环境配置

本页说明 LibXR 在 HPM 平台上的接入方式，不包括如何用先楫 SDK 的 GUI 工具建立工程。

如果你要快速起步，优先参考模板工程：

- [HPM5301_LibXR_Template](https://github.com/xrobot-org/HPM5301_LibXR_Template)

## 当前主线里已经有什么

按 `libxr master` 当前 `driver/hpm` 目录，已经存在这些驱动实现：

- `hpm_gpio.*`
- `hpm_i2c.*`
- `hpm_pwm.*`
- `hpm_timebase.*`

它们通过 `driver/hpm/CMakeLists.txt` 统一加入构建。和某些平台页不同，这里不是“目录里有文件，但默认构建没接进来”的状态。

## 基本集成思路

HPM 的接入方式与其他平台相同，是普通 LibXR 外部工程接入：

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER hpm)

add_subdirectory(path_to_libxr)
```

这里的前提是：

- 你的工程本身已经能通过 HPM SDK 正常编译；
- 工程已经把 HPM SDK 的头文件、启动文件、链接脚本和板级初始化接好；
- LibXR 只是在这个基础上接入 `driver/hpm` 与通用 runtime/middleware。

LibXR 不代替 HPM SDK 的项目骨架，它是在 HPM 工程已经成立之后接进去的。

## 当前文档建议的实际入口

如果你现在手上是 HPM 项目，建议按这个顺序确认：

1. 先用 HPM SDK 或模板工程把最小工程跑通。
2. 再检查工程里是否已经能正常 `add_subdirectory(libxr)`。
3. 最后再按需要接入具体外设类，例如 `HPMGPIO`、`HPMI2C`、`HPMPWM`、`HPMTimebase`。

## 当前 I2C 支持情况

`HPMI2C` 已不是简单的 blocking-only 包装，当前主线还覆盖了：

- 7-bit / 10-bit 主机寻址模式；
- sequence frame；
- transfer flags；
- 可选 DMA helper 背景路径；
- 等待策略与恢复路径。

上述能力是否在你的工程里可直接用，取决于：

- HPM SDK 头文件是否完整；
- 是否存在对应 DMA / interrupt helper；
- 目标板级时钟、引脚和总线恢复路径是否已验证。

## 当前 PWM 支持情况

`HPMPWM` 当前主线支持两类路径：

- 如果目标 SoC 提供标准 PWM 外设，则走 `hpm_pwm_drv`；
- 如果不满足该条件，代码里还有 `GPTMR` fallback 路径。

具体走哪条，取决于芯片和 SDK 宏条件。
