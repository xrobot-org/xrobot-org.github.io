---
id: semaphore
title: Semaphore
sidebar_position: 5
---

# Semaphore

`LibXR::Semaphore` provides **counting semaphores** to coordinate access to shared resources between multiple tasks or ISRs. It supports blocking waits (`Wait`) in thread context and safe releases (`PostFromCallback`) in interrupt context. Current implementations cover a **Linux futex-backed** host path, **FreeRTOS Counting Semaphore**, **ThreadX `TX_SEMAPHORE`**, and `none / webasm` polling-style variants built around a scalar count plus `Timer::RefreshTimerInIdle()` while waiting.

## Design Highlights

| Goal             | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Cross-platform** | Abstracts over Linux futex wait/wake, `SemaphoreHandle_t`, `TX_SEMAPHORE`, and similar primitives. |
| **ISR-friendly** | Provides `PostFromCallback(bool in_isr)` to safely release from ISR/DMA callbacks with task switching. |
| **Timeout support** | `Wait(timeout_ms)` supports millisecond-level timeout.                    |
| **Lightweight**  | Depends on C++20 and optionally on RTOS headers. |
| **Observability** | `Value()` returns the current count, useful for debugging and performance monitoring. |

## Core Interface

```cpp
class Semaphore {
public:
  Semaphore(uint32_t init_count = 0);
  ~Semaphore();

  void     Post();                    // Release from thread context
  void     PostFromCallback(bool in_isr);// Release from ISR/callback context
  ErrorCode Wait(uint32_t timeout=UINT32_MAX); // Blocking wait
  size_t   Value();                   // Current count
};
```

### Error Codes

* `ErrorCode::OK`       Operation successful  
* `ErrorCode::TIMEOUT`  Wait timed out  
* `ErrorCode::FAILED`  The underlying wait failed (Linux, ThreadX)

> **⚠️ Note**: `Wait()` **must not** be called from an ISR.
