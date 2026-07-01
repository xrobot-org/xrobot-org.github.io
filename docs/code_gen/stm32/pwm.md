---
id: stm32-code-gen-pwm
title: PWM
sidebar_position: 7
---

# PWM

代码生成工具会解析所有配置为 PWM 输出的定时器通道，并为每个通道生成一个独立的 `STM32PWM` 实例。

## 示例

第三个参数为`true`时，使用此定时器通道的互补输出。

```cpp
STM32PWM pwm_timX_chX(&htimX, TIM_CHANNEL_X, false);
```

## 当前 generator 覆盖范围

就当前 `GeneratorCodeSTM32.py` 而言，PWM 这一项的主要职责是：

- 遍历 CubeMX 工程里每个 TIM 外设下配置为 PWM 的通道；
- 根据通道名生成对象名，例如 `pwm_tim1_ch1`；
- 若通道配置含 `Complementary = true`，则第三个构造参数生成为 `true`；否则为 `false`。
