---
id: stm32-code-gen-pwm
title: PWM
sidebar_position: 7
---

# PWM

The generator parses all timer channels configured for PWM output and emits one independent `STM32PWM` instance per channel.

## Example

When the third argument is `true`, the complementary output of that timer channel is used.

```cpp
STM32PWM pwm_timX_chX(&htimX, TIM_CHANNEL_X, false);
```

## Current generator coverage

In current `GeneratorCodeSTM32.py`, the PWM generation path mainly does the following:

- iterate over PWM-enabled channels under each TIM peripheral in the CubeMX project;
- generate an object name such as `pwm_tim1_ch1` from the channel name;
- if the channel configuration contains `Complementary = true`, emit `true` as the third constructor argument; otherwise emit `false`.
