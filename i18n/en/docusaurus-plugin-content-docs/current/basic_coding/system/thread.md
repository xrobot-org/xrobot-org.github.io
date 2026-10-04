---
id: thread
title: Thread
sidebar_position: 3
---

# Thread

`LibXR::Thread` encapsulates **thread creation, scheduling, and time control** with a unified object-oriented interface across platforms. Implementations are provided for **POSIX, FreeRTOS, ThreadX, and bare-metal** environments. Users can maintain consistent thread logic without worrying about OS-specific APIs.

## Design Highlights

| Goal                 | Description                                                                 |
|----------------------|-----------------------------------------------------------------------------|
| **Cross-platform**    | Unified API hides `pthread`, `xTask`, `TX_THREAD`, etc.                    |
| **Lightweight**       | Depends on C++20 plus optional RTOS headers; also usable without an OS. |
| **Priority Enum**     | Uses `enum class Priority { IDLE…REALTIME }`, mapped by each port to its native priority range without exposing OS constants. |
| **Unified Timebase**  | All `Sleep` / `SleepUntil` use **milliseconds**; `GetTime()` returns milliseconds since boot. |

## Public Interface Overview

| Method                                                                                                              | Description                                      |
|---------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| `template <typename Arg> void Create(Arg arg, void (*func)(Arg), const char* name, size_t stack, Priority prio)`   | Create and start a thread. The thread function has the form `void(Arg)`; `stack` is the stack size in bytes (ignored on none and webasm); `prio` is mapped to the platform's priority range. |
| `static Thread Current()`                                                                                           | Get current thread wrapper.                     |
| `static uint32_t GetTime()`                                                                                         | Return milliseconds since system start (wraps at 32-bit). |
| `static void Sleep(uint32_t ms)`                                                                                    | Block current thread for given milliseconds.     |
| `static void SleepUntil(MillisecondTimestamp& last, uint32_t period)`                                               | Periodic delay with auto-updating `last`.        |
| `static void Yield()`                                                                                               | Yield CPU voluntarily.                          |
| `operator libxr_thread_handle()`                                                                                    | Implicitly convert to underlying thread handle.  |
| `Thread(libxr_thread_handle handle)` | Construct a thread object from a native thread handle. |
| `ErrorCode Join()` | Wait for the thread to finish; Linux and Webots backends only. |

> **Note**: If the system does not support thread priority or real-time scheduling, the adaptation layer can safely downgrade without affecting upper-layer logic.

## Typical Usage

The thread function has the form `void(ArgType)`; `arg` must have the same type as the function parameter, since `ArgType` is deduced from both. Mismatched types fail to compile.

```cpp
#include <libxr.hpp>

void Blink(int* arg) {
    auto last = LibXR::Timebase::GetMilliseconds();
    while (true) {
        ToggleLED();                          // User-defined function
        LibXR::Thread::SleepUntil(last, 500); // 500 ms interval
    }
}

int main() {
    int arg = 0;
    LibXR::Thread t;
    t.Create(&arg, Blink, "blink", 2048, LibXR::Thread::Priority::MEDIUM);
    // Main thread continues with other tasks …
    for (;;) {
        LibXR::Thread::Yield();
    }
}
```

On the none and webasm backends, `Create()` calls `Blink` directly in the current context; since `Blink` does not return, the code after `Create()` never runs.

## Platform Adaptation Overview

| Platform                | Header/Source Files           | Key Mapping                                               |
|-------------------------|-------------------------------|-----------------------------------------------------------|
| **Linux / POSIX**        | `system/linux/thread.hpp` + `thread.cpp`    | `pthread_create`, `clock_nanosleep`, `sched_yield`       |
| **FreeRTOS**             | `system/freertos/thread.hpp` + `thread.cpp` | `xTaskCreate`, `vTaskDelay`, `xTaskGetTickCount`; requires `configTICK_RATE_HZ == 1000` and `configMAX_PRIORITIES >= 6` (checked at compile time) |
| **ThreadX (Azure RTOS)** | `system/threadx/thread.hpp` + `thread.cpp`  | `tx_thread_create`, `tx_thread_sleep`, `tx_thread_relinquish` |
| **Bare-metal**           | `system/none/thread.hpp` + `thread.cpp`     | Polling `Timebase` + `Timer::RefreshTimerInIdle` for software delay |
| **Webots** | `system/webots/thread.hpp` + `thread.cpp` | `pthread_create`; `Sleep` / `SleepUntil` wait for simulation-time notifications (`pthread_cond_timedwait`) |
| **WebAssembly** | `system/webasm/thread.hpp` + `thread.cpp` | Same as bare-metal: `Create()` calls the thread function directly; delays poll `Timebase` and call `Timer::RefreshTimerInIdle` |

On a new platform, `thread.hpp` and `thread.cpp` are implemented together with the other system-layer files; the required files are listed in [Platform Porting](../../adv_coding/porting.md).

## Reference Implementation Notes

* POSIX version attempts `SCHED_FIFO` and maps `Priority` within available range; falls back to default with a warning if not supported.
* FreeRTOS/ThreadX versions calculate priority steps from `configMAX_PRIORITIES` or `TX_MAX_PRIORITIES`.
* The current `none` implementation is a single-shot direct-call placeholder: `Create()` invokes the target function immediately and enforces one creation path via an internal guard, rather than providing a real scheduler-backed thread model.
