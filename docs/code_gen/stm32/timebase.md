---
id: stm32-code-gen-timebase
title: 时钟基准
sidebar_position: 2
---

# 时钟基准

STM32CubeMX默认会将Systick作为时钟基准，也可以手动指定其他定时器。

建议在 SYS 中把时钟基准（Timebase Source）改为普通定时器（例如 TIM6），并在 NVIC 中把该定时器中断的抢占优先级设为最高（0）。时钟基准仍是 SysTick，或定时器中断的抢占优先级不是 0 时，`libxr parse` 会给出警告。

从当前 generator 的角度，这一页真正决定的主要是 `PlatformInit(...)` 前那一行 timebase 实例构造形状。

## 示例

代码生成工具会根据STM32CubeMX的时钟配置生成如下代码:

```cpp
// Systick 作为时钟基准
STM32Timebase timebase;
```

```cpp
// 定时器作为时钟基准
STM32TimerTimebase timebase(&htimX); // X 为时钟基准的定时器
```

## 当前 generator 覆盖范围

当前 `GeneratorCodeSTM32.py` 在 timebase 这一项的主要行为是：

- `Timebase.Source == SysTick` 时生成 `STM32Timebase timebase;`
- `Timebase.Source` 为 `TIMx / LPTIMx / HRTIMx` 时，生成 `STM32TimerTimebase timebase(&hxxx);`
- 随后 `PlatformInit(...)` 的参数是否为空、还是包含软件定时器优先级/栈深度，取决于当前 `SYSTEM`（裸机 / FreeRTOS / ThreadX）。

## 使用

```cpp
// 获取微秒级时间戳
LibXR::Timebase::GetMicroseconds();

// 获取毫秒级时间戳
LibXR::Timebase::GetMilliseconds();
```
