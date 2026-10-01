---
id: stm32-code-gen-timebase
title: Time Base
sidebar_position: 2
---

# Time Base

STM32CubeMX uses SysTick as the default time base, but other timers can also be selected manually.

Set the time base (SYS > Timebase Source) to a general-purpose timer such as TIM6, and give its interrupt the highest preemption priority (0) in NVIC. `libxr parse` warns when the time base is still SysTick, or when the preemption priority of the timer interrupt is not 0.

## Example

According to the CubeMX clock configuration, the generator emits the timebase object before `PlatformInit()`:

```cpp
// SysTick as the time base
static STM32Timebase timebase;
```

```cpp
// A timer as the time base, for example TIM2
static STM32TimerTimebase timebase(&htim2);
```

## Generation Rules

- with SysTick as the time base, `STM32Timebase` is generated;
- with a TIM, LPTIM or HRTIM as the time base, `STM32TimerTimebase` on that timer is generated;
- the following `PlatformInit()` takes no arguments in bare-metal projects, and the priority and stack depth of the software timer in FreeRTOS and ThreadX projects, see [Software Timer](./timer.md).

## Usage

```cpp
// Get microsecond timestamps
LibXR::Timebase::GetMicroseconds();

// Get millisecond timestamps
LibXR::Timebase::GetMilliseconds();
```
