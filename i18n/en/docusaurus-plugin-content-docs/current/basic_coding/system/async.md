---
id: async
title: Asynchronous Task
sidebar_position: 6
---

# ASync (Asynchronous Task)

`LibXR::ASync` provides a simple and low-overhead asynchronous execution capability for time-consuming operations using a **dedicated worker thread + counting semaphore**. Users can assign `Job` callbacks within tasks or interrupt handlers. The framework sequentially executes these in a background thread and updates status, without requiring users to manage thread lifecycles or complex queues.

> **Typical use cases**: Trigger FFT computation after SPI sampling interrupt; submit OTA verification in main loop; report events to the cloud from GPIO ISR, etc.

## Design Highlights

| Goal                  | Description                                                                                      |
|-----------------------|--------------------------------------------------------------------------------------------------|
| **Thread-exclusive**  | Each `ASync` instance creates one worker thread and wakes it up using a `Semaphore` to run `Job`, avoiding race conditions between tasks. |
| **ISR-safe submission** | `AssignJobFromCallback()` can be called from interrupt or callback context using `Semaphore::PostFromCallback()` to safely wake up the thread. |
| **Status queryable**  | `GetStatus()` returns `READY/BUSY/DONE`. After a task completes, the state auto-resets—suitable for polling or timeout detection. |
| **Minimal dependency** | Only depends on `Thread` and `Semaphore`; can degrade into synchronous execution in bare-metal mode. |
| **Minimal interface** | No use of templated queues or dynamic allocation. Uses `Callback<ASync*>` for `Job`, making it easy to bind member or free functions. |

## Core Interface

```cpp
class ASync {
public:
  enum class Status : uint32_t { READY = 0, BUSY = 1, DONE = UINT32_MAX };

  ASync(size_t stack_depth, Thread::Priority priority);

  using Job = LibXR::Callback<ASync*>;
  ErrorCode AssignJob(Job job);                       // Submit from task context
  ErrorCode  AssignJobFromCallback(Job job, bool in_isr);// Submit from ISR/callback context
  Status     GetStatus();                             // Query status and auto-reset
};
```

### Error Codes

* `ErrorCode::OK`      Submission successful  
* `ErrorCode::BUSY`    A task is already running  

## Usage Example

```cpp
#include <libxr.hpp>

LibXR::ASync async_worker(2048, LibXR::Thread::Priority::MEDIUM);

void HeavyCalc(bool, int *, LibXR::ASync*)
{
  DoFFT();   // Time-consuming: 5‑10 ms
}

int arg = 0;
auto async_job = LibXR::ASync::Job::Create(HeavyCalc, &arg);

void SensorISR()
{
  // Submit task in interrupt after sampling is done
  async_worker.AssignJobFromCallback(async_job, true);
}

void Loop()
{
  // ...

  if (async_worker.GetStatus() == LibXR::ASync::Status::DONE) {
    PublishResult();
  }

  // ...
}
```

## Platform Adaptation

`ASync` itself is OS-agnostic. All platform-specific differences are abstracted by `Thread` and `Semaphore` layers:

| Function      | Dependency Module              |
|---------------|-------------------------------|
| Thread creation | `Thread::Create()`            |
| Task wakeup    | `Semaphore::Post/Wait`         |
| ISR-compatible | `Semaphore::PostFromCallback()`|

In bare-metal mode, `AssignJob()` marks the job pending and the software `Timer` executes it on a later refresh. There is no independent worker thread, so a long job occupies the Timer refresh context.

Although `Callback` design forbids blocking or delay, its interface and structure are reused here and renamed as `Job` to avoid confusion.
