---
id: stm32-code-gen-timebase
title: 时钟基准
sidebar_position: 2
---

# 时钟基准

STM32CubeMX默认会将Systick作为时钟基准，也可以手动指定其他定时器。

建议在 SYS 中把时钟基准（Timebase Source）改为普通定时器（例如 TIM6），并在 NVIC 中把该定时器中断的抢占优先级设为最高（0）。时钟基准仍是 SysTick，或定时器中断的抢占优先级不是 0 时，`libxr parse` 会给出警告。

## 示例

代码生成工具会根据STM32CubeMX的时钟配置，在 `PlatformInit()` 之前生成时基对象:

```cpp
// Systick 作为时钟基准
static STM32Timebase timebase;
```

```cpp
// 定时器作为时钟基准，例如 TIM2
static STM32TimerTimebase timebase(&htim2);
```

## 生成规则

- 时钟基准为 SysTick 时生成 `STM32Timebase`；
- 时钟基准为定时器时生成该定时器的 `STM32TimerTimebase`。`STM32TimerTimebase` 的构造函数只接受 `TIM_HandleTypeDef*`，LPTIM 或 HRTIM 作为时钟基准时生成的代码无法编译，因此时钟基准应选用 TIM；
- 随后的 `PlatformInit()` 在裸机工程中不带参数，在 FreeRTOS 和 ThreadX 工程中带软件定时器的优先级和栈深度，见[软件定时器](./timer.md)。

## 使用

```cpp
// 获取微秒级时间戳
LibXR::Timebase::GetMicroseconds();

// 获取毫秒级时间戳
LibXR::Timebase::GetMilliseconds();
```
