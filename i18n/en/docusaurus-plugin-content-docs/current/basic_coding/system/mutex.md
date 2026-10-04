---
id: mutex
title: Mutex
sidebar_position: 4
---

# Mutex (Mutual Exclusion Lock)

`LibXR::Mutex` provides a lightweight, cross-platform **thread mutual exclusion** mechanism for protecting critical sections in a multitasking environment. It currently supports **POSIX pthread**, **FreeRTOS**, and **ThreadX**. In bare-metal-style `none` / `webasm` paths, the current implementation degrades into a minimal busy-wait lock around a scalar handle and periodically calls `Timer::RefreshTimerInIdle()` while waiting.

> **⚠️ Note**: Mutex **must only** be used in thread context. It is **not supported** in interrupt service routines (ISRs).

## Design Highlights

| Goal               | Description                                                                 |
|--------------------|-----------------------------------------------------------------------------|
| **Cross-platform** | Hides differences like `pthread_mutex`, `xSemaphoreHandle`, `TX_MUTEX`, etc.|
| **RAII-friendly**  | Built-in `LockGuard` to prevent forgetting `Unlock()`.                      |
| **RTOS Mutex Semantics** | Current FreeRTOS path uses the kernel mutex type with priority inheritance, while the current ThreadX path is created with `TX_NO_INHERIT`. |
| **Lightweight**    | Call path is close to low-level system calls for minimal overhead.          |

## Core Interface

```cpp
class Mutex {
public:
  Mutex();
  ~Mutex();

  ErrorCode Lock();     // Blocking lock
  [[nodiscard]] ErrorCode TryLock();  // Non-blocking attempt
  void Unlock();        // Unlock

  class LockGuard {
  public:
    LockGuard(Mutex& mutex);
    ~LockGuard();
  };
};
```

`Lock()` returns `OK` on success; when the underlying lock fails, Linux and ThreadX return `FAILED`, FreeRTOS and Webots return `BUSY`. `TryLock()` returns `BUSY` when the mutex is held.

## Usage Example

```cpp
LibXR::Mutex m;
int shared = 0;

void Worker()
{
  LibXR::Mutex::LockGuard lock(m);  // Locks on construction
  shared++;                         // Safe access
}                                    // Unlocks on destruction
```
