---
id: system-coding
title: Operating System
sidebar_position: 4
---

# Operating System

This chapter covers LibXR's common interface for threads, synchronization primitives, and timers. Backends: Linux, FreeRTOS, ThreadX, Webots, WebAssembly, and none (no operating system).

## Contents

- [Thread](./thread.md)
- [Mutex](./mutex.md)
- [Semaphore](./semaphore.md)
- [Async](./async.md)
- [Timer](./timer.md)

Backends differ in implementation (for example priority inheritance, and polling waits and direct thread calls on threadless backends); see each page for details.

## Platform initialization

`LibXR::PlatformInit()` is provided by the system layer. A program calls it once before using other LibXR features. It records the priority and stack depth of the `Timer` management thread and performs the initialization the backend needs. Signatures and behavior per backend:

| Backend | Signature | Behavior |
| --- | --- | --- |
| freertos, threadx | `PlatformInit(uint32_t timer_pri = 2, uint32_t timer_stack_depth = 512)` | The platform timebase object (such as `STM32TimerTimebase`) must already be constructed; otherwise an `ASSERT` fires |
| linux | `PlatformInit(uint32_t timer_pri = 2, uint32_t timer_stack_depth = 65536)` | Creates `STDIO::read_`, `STDIO::write_` and the two threads that serve them; when standard input is a terminal, disables line buffering and echo |
| webots | `PlatformInit(webots::Robot* robot = nullptr, uint32_t timer_pri = 2, uint32_t timer_stack_depth = 65536, double sim_flow_rate = 1.0)` | Constructs the Webots timebase, creates STDIO as on linux, and creates the thread that advances the simulation one step every `basicTimeStep / sim_flow_rate` milliseconds of real time; creates a `webots::Robot` when `robot` is null |
| webasm | `PlatformInit()` | Constructs the WebAssembly timebase and creates `STDIO::read_` and `STDIO::write_` |
| none | `PlatformInit()` | Does nothing |

The linux backend creates its timebase at program start; freertos, threadx and none use the timebase constructed by the board code (see [Timebase](../driver/timebase.md)).

`timer_pri` is converted with `static_cast<Thread::Priority>(timer_pri)`, and the numeric values of the `Thread::Priority` levels depend on the backend; on FreeRTOS, for example, `MEDIUM` equals `2 × LIBXR_PRIORITY_STEP`. A level is therefore passed as `static_cast<uint32_t>(...)`. The excerpt below is from the `app_main()` the code generator produces for an STM32 FreeRTOS project:

```cpp
static STM32TimerTimebase timebase(&htim3);
PlatformInit(static_cast<uint32_t>(Thread::Priority::MEDIUM), 1024);
```

## Porting

Using LibXR on a new operating system or chip requires a new system-layer directory or a new driver directory; see [Platform Porting](../../adv_coding/porting.md).
