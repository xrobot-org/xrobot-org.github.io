---
id: watchdog
title: Watchdog
sidebar_position: 12
---

# Watchdog

`LibXR::Watchdog` provides a general-purpose abstract interface for watchdog functionality. It supports configuring the overflow timeout, auto-feed interval, and provides control methods like start, stop, and manual feeding. It is suitable for multi-threaded environments or timer-based task scheduling systems.

In the existing backends (`STM32Watchdog`, `ESP32Watchdog`), `SetConfig()` sets the timeout and stores `feed_ms` as the auto-feed interval `auto_feed_interval_ms` (`0 < feed_ms <= timeout_ms` is required, otherwise `ARG_ERR`); `Start()` starts the watchdog and sets `auto_feed_`; `Stop()` clears `auto_feed_`. Both backend constructors already call `SetConfig()` and `Start()`.

## Interface Overview

### Configuration Structure

```cpp
struct Configuration {
  uint32_t timeout_ms;  // Watchdog overflow time (milliseconds)
  uint32_t feed_ms;     // Auto-feed interval (milliseconds)
};
```

### Constructor and Configuration

```cpp
Watchdog();
virtual ~Watchdog();

virtual ErrorCode SetConfig(const Configuration& config) = 0;
```

### Control Interface

```cpp
virtual ErrorCode Start() = 0;
virtual ErrorCode Stop() = 0;
virtual ErrorCode Feed() = 0;
```

### Auto-Feed Helper Functions

```cpp
static void ThreadFun(Watchdog* wdg);
static void TaskFun(Watchdog* wdg);
```

- `ThreadFun`: Used in threaded environments for continuous auto-feeding;
- `TaskFun`: Used in polling/timer task systems for periodic auto-feeding.

Helper behavior:

- `ThreadFun()` loops, sleeps with `LibXR::Thread::Sleep(auto_feed_interval_ms)`, and calls `Feed()` only when `auto_feed_ == true`.
- `TaskFun()` does not loop; it only checks `auto_feed_` once for the current scheduling point and decides whether to call `Feed()`.

Automatic feeding is done by a thread running `ThreadFun()` or by `TaskFun()` called periodically from `Timer`. The STM32 IWDG cannot be stopped once started; `STM32Watchdog::Stop()` returns `NOT_SUPPORT` and stops automatic feeding.

## Feature Summary

- Supports configurable overflow timeout and auto-feed interval;
- Provides manual `Feed` function and auto-feed helpers;
- Suitable for various embedded execution models such as RTOS threads or timer tasks;
- Platform-independent, allowing unified usage across different hardware;
- Easily extendable, with implementation-specific logic in derived classes.
