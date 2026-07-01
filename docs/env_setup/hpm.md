---
id: env-setup-hpm
title: HPM 环境配置
sidebar_position: 5
---

# HPM 环境配置

这一页只说明 **当前 LibXR 主线在 HPM 平台上的接入边界**，不展开先楫 SDK 的完整 GUI 建工程流程。

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

HPM 这条线仍然是普通 LibXR 外部工程接入方式：

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

## 关于 `I2C` 的当前边界

HPM `I2C` 这一条现在已经不是简单 blocking-only 包装。按当前主线头文件，`HPMI2C` 还覆盖了：

- 7-bit / 10-bit 主机寻址模式；
- sequence frame；
- transfer flags；
- 可选 DMA helper 背景路径；
- 等待策略与恢复路径。

但这类能力是否在你的具体工程上可直接用，仍取决于：

- HPM SDK 头文件是否完整；
- 是否存在对应 DMA / interrupt helper；
- 目标板级时钟、引脚和总线恢复路径是否已验证。

所以这页只把它定义成“主线代码已存在的能力边界”，不把它直接写成“所有 HPM 项目默认可用并已充分验证”。

## 关于 `PWM` 的当前边界

`HPMPWM` 当前主线支持两类路径：

- 如果目标 SoC 提供标准 PWM 外设，则走 `hpm_pwm_drv`；
- 如果不满足该条件，代码里还有 `GPTMR` fallback 路径。

这意味着文档里不能简单写成“只有某一种固定 PWM 方案”。具体走哪条线，要看你的芯片和 SDK 宏条件。

## 这页不做什么

这页不打算替代这些内容：

- HPM SDK 本身的安装和环境变量教程；
- 图形化建工程步骤；
- 板级时钟/引脚向导截图；
- 先楫 IDE 或 GUI 工具的完整操作手册。

如果这些步骤已经和 LibXR 接入强相关，并且后面在模板仓库里形成了稳定做法，再单独补到模板或项目文档里更合适。
