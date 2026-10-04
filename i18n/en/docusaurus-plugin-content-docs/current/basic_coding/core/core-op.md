---
id: core-op
title: Operation Model
sidebar_position: 11
---

# Operation Model

`operation.hpp` defines the generic `Operation<T>` template, which describes how the caller is notified when an asynchronous operation completes: callback (CALLBACK), blocking (BLOCK) or polling (POLLING).

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
enum class OperationPollingStatus : uint32_t {
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
Operation(std::atomic<OperationPollingStatus> &status);
```

An `Operation` can be copied and moved; copies refer to the same callback, semaphore or polling status.

## Status Updates

```cpp
template <typename Status>
void UpdateStatus(bool in_isr, Status&& status);

void MarkAsRunning();
```

- `UpdateStatus(...)` triggers a callback, unblocks a waiter, or updates polling state depending on the operation type:
  - CALLBACK: calls `cb.Run(in_isr, status)`, passing `status` as the completion value of type `T`.
  - BLOCK: calls `PostFromCallback(in_isr)` on the semaphore to wake the waiter; the final `ErrorCode` is kept by the port and returned by the blocking call.
  - POLLING: stores (release) `DONE` when `status == ErrorCode::OK` and `ERROR` otherwise, so it fits operations whose completion value is an `ErrorCode`.
- `MarkAsRunning()` sets the polling status to `RUNNING` if the type is `POLLING`.
- Ports or drivers call these two functions; users only construct the `Operation` and pass it in.
- An `Operation` only borrows its callback, semaphore or polling status; the caller keeps them valid until the operation ends.
- A semaphore serves one BLOCK call at a time; BLOCK calls are thread-only.
- Callbacks run inline in the context that completes the I/O, possibly an ISR; read the polling status with `load(std::memory_order_acquire)`.

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
std::atomic<LibXR::ReadOperation::OperationPollingStatus> status{
    LibXR::ReadOperation::OperationPollingStatus::READY};
ReadOperation op_poll(status);
read_port(buffer, op_poll);

// Later check if completed
auto now = status.load(std::memory_order_acquire);
if (now == LibXR::ReadOperation::OperationPollingStatus::DONE) {
  // Completed successfully
} else if (now == LibXR::ReadOperation::OperationPollingStatus::ERROR) {
  // Completed with an error
}
```

## `AsyncBlockWait`

`operation.hpp` also defines a helper used by synchronous drivers:

```cpp
class AsyncBlockWait;
```

Synchronous drivers use it to wait for one asynchronous completion:

- `Start(Semaphore&)`
- `Wait(timeout)`
- `TryPost(in_isr, ErrorCode)`
- `Cancel()`

Key semantics:

- a waiter that returned on timeout is detached from later completions;
- a late completion only clears the internal wait state and does not wake the caller that already timed out.
