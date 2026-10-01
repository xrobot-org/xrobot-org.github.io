---
id: stm32-code-gen-watchdog
title: Watchdog
sidebar_position: 12
---

# Watchdog

LibXR supports automatic management of the STM32 independent watchdog (`IWDG`), including either timer-task feeding or a dedicated thread. Enabling a hardware watchdog is generally recommended for production firmware.

## Basic Notes

- supports automatic code generation and configuration for enabled IWDG instances
- optional auto-feed mode: **timer task** or **dedicated thread**, suitable for bare-metal or RTOS-based projects
- watchdog period, thread stack, and thread priority can be configured through YAML

## Example Generated Code

```cpp
// Create and initialize the watchdog instance
STM32Watchdog iwdg1(&hiwdg1, 1000, 250); // 1 s timeout, 250 ms feed interval

// Auto-feed option 1: timer task, suitable for bare-metal or simple polling
auto iwdg1_task = Timer::CreateTask(iwdg1.TaskFun, reinterpret_cast<LibXR::Watchdog *>(&iwdg1), 250);
Timer::Add(iwdg1_task);
Timer::Start(iwdg1_task);

// Auto-feed option 2: dedicated thread, suitable for RTOS
LibXR::Thread iwdg1_thread;
iwdg1_thread.Create(reinterpret_cast<LibXR::Watchdog *>(&iwdg1), iwdg1.ThreadFun, "iwdg1_wdg", 1024,
                   static_cast<LibXR::Thread::Priority>(3));
```

## Configuration File

The watchdog behavior is controlled through configuration such as:

```yaml
# IWDG peripheral enablement and instance parameters
IWDG:
  iwdg1:
    timeout_ms: 1000
    feed_interval_ms: 250

# Global watchdog behavior
Watchdog:
  run_as_thread: true
  thread_stack_depth: 1024
  thread_priority: 3
  feed_interval_ms: 250
```

> If `run_as_thread: true`, each enabled IWDG gets a generated thread and uses the global thread parameters.
>
> If `run_as_thread: false`, the generator emits the timer-task feeding pattern instead.

## Current generator coverage

In current `GeneratorCodeSTM32.py`, the watchdog generation path mainly does the following:

- generate one `STM32Watchdog` instance for each enabled `IWDG`;
- read constructor parameters from `IWDG.<instance>.timeout_ms` and `feed_interval_ms`;
- choose thread-based or timer-task-based feeding according to the global `Watchdog.run_as_thread` flag.

Specifically:

- thread mode uses global `thread_stack_depth` and `thread_priority`;
- non-thread mode uses the global `feed_interval_ms` as the period passed to `Timer::CreateTask(...)`.

## Regeneration Command

After editing `libxr_config.yaml`, regenerate with:

```bash
libxr gen -i ./.config.yaml -o ./User/app_main.cpp
```

## Notes

STM32CubeMX-generated `MX_IWDG_Init()` usually enables the watchdog immediately, and the hardware cannot then be disabled or reconfigured except by reset. If needed, disable generation/invocation of that function in CubeMX under `Project Manager -> Advanced Settings`.
