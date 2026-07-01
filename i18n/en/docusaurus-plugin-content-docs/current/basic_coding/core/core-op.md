---
id: core-op
title: Operation Model
sidebar_position: 9
---

# Operation Model

This module defines the generic template class `Operation<T>` to describe asynchronous operations with completion feedback mechanisms. It supports three modes: Callback, Blocking, and Polling, and is designed to unify completion handling in embedded I/O operations.

`ReadOperation` / `WriteOperation` are aliases of `Operation<ErrorCode>` and are commonly used by I/O ports to report completion status via `ErrorCode`.

## Operation Modes

### OperationType

```cpp
enum class OperationType : uint8_t {
  CALLBACK,  // Uses a callback function to handle completion
  BLOCK,     // Waits using a semaphore (blocking)
  POLLING,   // Uses a polling status variable
  NONE       // No completion handling
};
```

### POLLING Status Enum

```cpp
enum class OperationPollingStatus : uint8_t {
  READY,
  RUNNING,
  DONE,
  ERROR
};
```

## Constructors

```cpp
// Default constructor: type is NONE
Operation();

// Construct a blocking operation
Operation(Semaphore &sem, uint32_t timeout = UINT32_MAX);

// Construct a callback-based operation (T is the callback parameter type)
Operation(Callback<T> &cb);

// Construct a polling-based operation
Operation(OperationPollingStatus &status);
```

`Operation` can also be initialized from another `Operation` instance (copy/move semantics are equivalent to assignment).

## Status Updates

```cpp
template <typename Status>
void UpdateStatus(bool in_isr, Status&& status);

void MarkAsRunning();
```

- `UpdateStatus(...)` triggers a callback, unblocks a waiter, or updates polling state depending on the operation type:
  - CALLBACK: calls `cb.Run(in_isr, status)`, passing `status` as the completion value of type `T`.
  - BLOCK: calls `Semaphore::PostFromCallback(in_isr)` to unblock; the completion value itself is not stored inside `Operation` for the blocking waiter, and the final `ErrorCode` is currently handed off by the owning port-side state.
  - POLLING: the current implementation checks success using `status == ErrorCode::OK` and sets `DONE` or `ERROR` accordingly. In practice, this makes the polling path most natural for `Operation<ErrorCode>` in current mainline, rather than a fully generic success policy for arbitrary `T`.
- `MarkAsRunning()` sets the polling status to `RUNNING` if the type is `POLLING`.
- These functions are typically called by drivers/ports; users only need to select an `OperationType` and pass an `Operation` instance in.

## Usage Examples

### Blocking write with timeout

```cpp
Semaphore sem;
WriteOperation op_block(sem, 100);
write_port(data, op_block);
```

### Callback-based completion feedback

```cpp
auto cb = Callback<ErrorCode>::Create([](bool in_isr, int context, ErrorCode ec) {
  // Callback logic
}, 123);  // Binds context value 123

ReadOperation op_cb(cb);
read_port(buffer, op_cb);
```

### Polling to check for completion

```cpp
auto status = LibXR::ReadOperation::OperationPollingStatus::READY;
ReadOperation op_poll(status);
read_port(buffer, op_poll);

// Later check if completed
if (status == LibXR::ReadOperation::OperationPollingStatus::DONE) {
  // Completed successfully
} else if (status == LibXR::ReadOperation::OperationPollingStatus::ERROR) {
  // Completed with an error
}
```

## Additional current-mainline role: `AsyncBlockWait`

Besides `Operation<T>`, `operation.hpp` also defines an internal helper currently used by synchronous driver paths:

```cpp
class AsyncBlockWait;
```

It does not replace `Operation`; it provides a shared BLOCK waiter handoff:

- `Start(Semaphore&)`
- `Wait(timeout)`
- `TryPost(in_isr, ErrorCode)`
- `Cancel()`

Current semantics highlights:

- a timed-out waiter becomes detached from later completions;
- a late completion may still clean up the in-flight state, but the result no longer belongs to the caller that has already returned with timeout.

That is also why the BLOCK path above is described mainly as “semaphore wake-up”, not as a generic value-storing completion channel inside `Operation` itself.
