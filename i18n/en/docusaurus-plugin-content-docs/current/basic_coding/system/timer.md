---
id: timer
title: Timer
sidebar_position: 7
---

# Timer

`LibXR::Timer` implements **cross-platform periodic task scheduling**, supporting high-precision timed execution across multiple tasks. It provides unified interfaces for creating, starting, stopping, adding, and adjusting timers. Internally, it uses `Thread::SleepUntil` for precise scheduling, working in both multithreaded and bare-metal environments. It is suitable for timed callbacks, periodic control, asynchronous tasks, and more.

## Design Highlights

| Goal                | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| **Cross-platform**   | Timer decouples scheduling from OS and supports both multithreaded and bare-metal systems. |
| **Multitasking**     | Supports concurrent periodic tasks with independent registration and control. |
| **1 ms tick** | The manager thread refreshes tasks every 1 ms with `Thread::SleepUntil`. |
| **Flexible Interface** | Supports dynamic period changes and full task lifecycle operations.         |
| **Thread-safe and Optional** | Manages its own thread in RTOS; in bare-metal, refresh hooks are integrated into Thread/Mutex/Semaphore wait paths. |

## Public Interface Overview

| Method                                                                                                 | Description                                         |
|--------------------------------------------------------------------------------------------------------|-----------------------------------------------------|
| `template <typename Arg> static TimerHandle CreateTask(void (*fun)(Arg), Arg arg, uint32_t cycle)`     | Create periodic task (in ms), returns handle.       |
| `static void Start(TimerHandle handle)`                                                                | Start specified task.                               |
| `static void Stop(TimerHandle handle)`                                                                 | Stop specified task.                                |
| `static void SetCycle(TimerHandle handle, uint32_t cycle)`                                             | Modify task cycle.                                  |
| `static void Add(TimerHandle handle)`                                                                  | Add task to the scheduler; in multithreaded builds, the first add also creates the manager thread. |
| `static void Refresh()`                                                                                | Advances one 1 ms tick: each enabled task's counter is incremented and the task runs when it reaches its cycle. Called every millisecond by the manager thread in multithreaded builds and by `RefreshTimerInIdle()` in threadless builds; application code normally does not call it. |
| `static void RefreshTimerInIdle()`                                                                     | In bare-metal: auto-called during Thread/Mutex/Semaphore waits. |

> **Note**: All timer periods are in **milliseconds**. Timers are scheduled automatically by a management thread in multithreaded systems. In bare-metal scenarios, timer refresh is integrated into `Thread` delays and current `Mutex` / `Semaphore` wait paths.

## Typical Usage

```cpp
#include <timer.hpp>
#include <cstdio>

void PrintHello(int* value) {
    printf("Hello, value = %d\n", *value);
}

int main() {
    int arg = 123;
    // Create a periodic task to call PrintHello every 1000 ms
    auto handle = LibXR::Timer::CreateTask(PrintHello, &arg, 1000);

    LibXR::Timer::Add(handle);    // Add to scheduler and auto-start
    LibXR::Timer::Start(handle);  // Start the task

    while (1) {
        // Main loop; no need to manually refresh timer in bare-metal
        // In multithreaded systems, other tasks can execute here
        LibXR::Thread::Sleep(UINT32_MAX);
    }
}
```

## Platform Adaptation Overview

| Scenario        | Key Implementation             | Scheduling Details                                       |
|------------------|-------------------------------|----------------------------------------------------------|
| Multithread/RTOS | Thread::SleepUntil + manager  | Automatically spawns manager thread; 1ms-precision loop. |
| Bare-metal       | Auto call RefreshTimerInIdle  | Refreshed automatically during Thread/Mutex/Semaphore wait. |

The priority and stack depth of the management thread are set by the arguments of `PlatformInit()`; see [Platform initialization](./README.md#platform-initialization). The Timer implementation is the same on every platform: each platform provides the Thread and Timebase it depends on, and threadless backends also provide `RefreshTimerInIdle()`; see [Platform Porting](../../adv_coding/porting.md).

## Implementation Notes

* Each task is wrapped in a ControlBlock, managed via a List.
* `CreateTask` supports argument-bound callbacks with type safety.
* First `Add` auto-creates task list and management thread (in RTOS).
* Each `Refresh` call increments the counter of every enabled task and runs the task when the counter reaches its cycle.
* In bare-metal mode, delay/wait calls auto-refresh timers.
* Supports dynamic cycle change plus task start/stop during runtime.
* Asserts guard against invalid operations such as adding the same task handle more than once.
