---
id: stm32-code-gen-timebase
title: 时钟基准
sidebar_position: 2
---

# 时钟基准

STM32CubeMX默认会将Systick作为时钟基准，也可以手动指定其他定时器。

对于裸机来说，保持时钟基准为Systick即可，但是建议将Systick的中断优先级调至最高。

对于RTOS，建议指定其他定时器作为时钟基准，并且将该定时器的中断优先级调至最高。

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
- `Timebase.Source` 为普通 `TIMx` 时，生成 `STM32TimerTimebase timebase(&htimx);`
- 当前 `STM32TimerTimebase` 构造函数只接受 `TIM_HandleTypeDef*`。generator 若从 IOC 读到 `LPTIMx / HRTIMx` 并按同一形状生成代码，该句与当前 LibXR 类型并不兼容；这两类源不能当作已适配的 timebase 使用。
- 随后 `PlatformInit(...)` 的参数是否为空、还是包含软件定时器优先级/栈深度，取决于当前 `SYSTEM`（裸机 / FreeRTOS / ThreadX）。

## 使用

```cpp
// 获取微秒级时间戳
LibXR::Timebase::GetMicroseconds();

// 获取毫秒级时间戳
LibXR::Timebase::GetMilliseconds();
```
