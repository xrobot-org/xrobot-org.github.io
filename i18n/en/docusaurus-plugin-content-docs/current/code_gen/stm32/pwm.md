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
static STM32PWM pwm_tim1_ch1(&htim1, TIM_CHANNEL_1, false);
```

## Generation Rules

- every channel configured for PWM under a TIM peripheral of the CubeMX project gets one object;
- objects are named `pwm_<timer>_ch<channel>`, such as `pwm_tim1_ch1`;
- a complementary output channel (`CHxN` in CubeMX) gets an object name ending in `n` (such as `pwm_tim1_ch1n`) and uses `TIM_CHANNEL_x` with `true` as the third constructor argument; other channels pass `false`.
