---
id: async
title: Asynchronous Task
sidebar_position: 6
---

# ASync (Asynchronous Task)

`LibXR::ASync` runs one time-consuming job asynchronously: threaded backends use a worker thread and a semaphore, threadless backends use a `Timer` task. A task or interrupt callback submits a `Job`, which runs in the background and updates the status; each instance accepts one job at a time.

> **Typical use cases**: Trigger FFT computation after SPI sampling interrupt; submit OTA verification in main loop; report events to the cloud from GPIO ISR, etc.

## Design Highlights

| Goal                  | Description                                                                                      |
|-----------------------|--------------------------------------------------------------------------------------------------|
| **Single job** | On threaded backends each instance creates one worker thread, woken by a `Semaphore` to run the `Job`. |
| **ISR-safe submission** | `AssignJobFromCallback()` can be called from interrupt or callback context using `Semaphore::PostFromCallback()` to safely wake up the thread. |
| **Queryable status** | `GetStatus()` returns `READY/BUSY/DONE`; reading `DONE` resets the status to `READY`, after which the next job can be submitted. |
| **Minimal dependency** | Uses `Thread` and `Semaphore` on threaded backends; threadless backends run the job from a `Timer` task. |
| **Callback interface** | Jobs are `Callback<ASync*>` objects created with `Job::Create()`, which allocates the callback block. |

## Core Interface

```cpp
class ASync {
public:
  enum class Status : uint32_t { READY = 0, BUSY = 1, DONE = UINT32_MAX };

  ASync(size_t stack_depth, Thread::Priority priority);

  using Job = LibXR::Callback<ASync*>;
  ErrorCode AssignJob(Job job);                       // Submit from task context
  ErrorCode  AssignJobFromCallback(Job job, bool in_isr); // Submit from ISR/callback context
  Status     GetStatus();                             // Query status; reading DONE resets it to READY
};
```

See [General Callback](../core/core-cb.md) for creating a `Job`.

### Error Codes

* `ErrorCode::OK`      Submission successful  
* `ErrorCode::BUSY`    The previous job is still running, or it finished and `GetStatus()` has not yet read `DONE`

The job callback always receives `in_isr == false`.

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

On threaded backends `ASync` relies on:

| Function      | Dependency                     |
|---------------|-------------------------------|
| Thread creation | `Thread::Create()`            |
| Task wakeup    | `Semaphore::Post/Wait`         |
| ISR-compatible | `Semaphore::PostFromCallback()`|

On threadless backends such as none and webasm, `ASync` creates no worker thread; the constructor registers a 1 ms `Timer` task instead. Submission only records the job, which runs on a later timer refresh; refreshes are driven by the wait paths of `Thread::Sleep`, `Mutex`, and `Semaphore`. A running job delays other timer tasks.

Although `Callback` design forbids blocking or delay, its interface and structure are reused here and renamed as `Job` to avoid confusion.
