---
id: watchdog
title: Watchdog
sidebar_position: 12
---

# Watchdog

`LibXR::Watchdog` provides a general-purpose abstract interface for watchdog functionality. It supports configuring the overflow timeout, auto-feed interval, and provides control methods like start, stop, and manual feeding. It is suitable for multi-threaded environments or timer-based task scheduling systems.

In current mainline, hardware configuration and auto-feed scheduling are split into two layers:

- `SetConfig(...)` only passes `timeout_ms / feed_ms` into the concrete platform implementation;
- whether `ThreadFun()` / `TaskFun()` actually perform automatic feeding still depends on the public runtime members `auto_feed_` and `auto_feed_interval_ms`.

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

Actual current helper semantics:

- `ThreadFun()` loops, sleeps with `LibXR::Thread::Sleep(auto_feed_interval_ms)`, and calls `Feed()` only when `auto_feed_ == true`.
- `TaskFun()` does not loop; it only checks `auto_feed_` once for the current scheduling point and decides whether to call `Feed()`.

So automatic feeding is not enabled by `SetConfig()` alone. The upper layer still needs to arrange a thread or periodic task and set `auto_feed_` / `auto_feed_interval_ms` explicitly.

## Feature Summary

- Supports configurable overflow timeout and auto-feed interval;
- Provides manual `Feed` function and auto-feed helpers;
- Suitable for various embedded execution models such as RTOS threads or timer tasks;
- Platform-independent, allowing unified usage across different hardware;
- Easily extendable, with implementation-specific logic in derived classes.
