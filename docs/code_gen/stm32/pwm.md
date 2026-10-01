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
static STM32PWM pwm_tim1_ch1(&htim1, TIM_CHANNEL_1, false);
```

## 生成规则

- CubeMX 工程中每个 TIM 外设下配置为 PWM 的通道各生成一个对象；
- 对象名为 `pwm_<定时器>_ch<通道>`，例如 `pwm_tim1_ch1`；
- 互补输出通道（CubeMX 中的 `CHxN`）的对象名带 `n`（如 `pwm_tim1_ch1n`），使用 `TIM_CHANNEL_x`，第三个构造参数为 `true`；其他通道为 `false`。
