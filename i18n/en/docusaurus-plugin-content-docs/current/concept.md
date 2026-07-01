---
id: concept
title: Design Concept
sidebar_position: 2
---

# Design Concept

## `Lock-free Data Structures and ISR-Driven Data Flow`

In LibXR, all I/O is built on lock-free queues and ring buffers, with no reliance on mutexes or interrupt-masking critical sections during runtime, thereby ensuring deterministic transfer paths and controllable latency. Device events are driven entirely by hardware interrupts; the ISR is limited to necessary tasks such as double-buffer switching and state machine transitions, without additional logic. As a result, data flow is strictly paced by hardware rather than operating system scheduling.

To prevent callbacks from recursively re-entering and growing the stack when events trigger each other and form a loop (for example A → B → C → A), the callback mechanism includes a reentrancy guard: if the same callback is already executing, re-triggering it does not create a new nested stack frame, but is instead merged/deferred so the call depth stays bounded. This keeps stack usage stable and makes worst-case latency analysis easier.

## `Runtime memory allocation in embedded systems is a design flaw`

In embedded systems, runtime memory allocation should be regarded as a design flaw. All resources in the system should be allocated and configured as much as possible during the construction or initialization phase. This not only improves system predictability and stability, but also makes memory usage analysis and resource planning easier.

This principle does not mean banning dynamic memory allocation (such as `malloc`, `new`), but rather emphasizes that **the timing of dynamic memory allocation** must be during the system's initialization phase. After entering the main loop or starting task scheduling, no new memory allocation operations should occur. Otherwise, it introduces:

- Unknown delays (such as fragmentation, etc.)
- Hard-to-track memory leaks or boundary errors
- Potential memory allocation failures

In other words, **"dynamic allocation is allowed, but must be used at a static time."**  
Under this premise, you can even implement memory allocation with a write-only stack, making it very easy to monitor memory usage.

## `All callbacks/interrupts must be non-blocking`

Callbacks are execution points across contexts. Whether triggered by interrupts, schedulers, or asynchronous cross-thread mechanisms, their responsibility should be extremely restrained. **The design purpose of a callback is not to "handle", but to "handoff".**

In LibXR, all callbacks are only allowed to perform the following two classes of operations:

1. **Notify threads**: set state, release semaphores, publish events;
2. **Push data**: write into lock-free queues, cache structures, or other pre-allocated data areas.

All other behaviors are strictly prohibited:

- Blocking wait (such as semaphores, locks, sleep)  
- Business logic processing or invoking upper-layer interfaces  
- Dynamic memory allocation  
- Calling any function with unpredictable latency

## `Execution context (thread/isr) must be explicitly passed into callbacks`

- All callbacks must receive a `bool in_isr` parameter  
- OS-wrapped APIs are clearly split into `Api()` / `ApiFromCallback(in_isr)`  
- Users do not need to determine the current context; just propagate `in_isr` upward  
- Ensures all callbacks, task switching, and signaling interactions work safely under ISR / Thread modes  
- You never need to guess whether you're running inside an interrupt

## `Every I/O operation must bind a defined completion behavior`

The key to I/O operations is not "issuing a request", but rather **how to know when it completes, and how to handle the result afterward**.

LibXR models I/O behaviors using the `Operation` type, binding the response mechanism at the time the operation is initiated:

| Mode     | Type       | Description                                |
| -------- | ---------- | ------------------------------------------ |
| Callback | `CALLBACK` | Callback function triggered upon finish    |
| Blocking | `BLOCK`    | Current task blocks until complete/timeout |
| Polling  | `POLLING`  | User actively checks completion status     |
| Ignore   | `NONE`     | Fire and forget, no feedback expected      |

```cpp
WriteOperation op_cb(callback);     // Async callback
WriteOperation op_block(sem, 100);  // Blocking wait
WriteOperation op_poll(status);     // Polling
WriteOperation op_none;             // Ignore result

uart1.Write("Hello, world!", op_block);
```

An operation without a bound completion behavior is uncontrollable.

## `No platform-specific types should appear in interfaces`

Users should never see platform-specific structs or dependencies in any interface. For example:

- STM32's `UART_HandleTypeDef*`
- ESP-IDF's `uart_port_t`
- Linux's `termios`
- FreeRTOS's `TaskHandle_t`, `SemaphoreHandle_t`

These types must only exist inside platform-specific implementations and should never appear in interface declarations, parameters, or return values.

Interfaces must remain platform-agnostic to ensure:

- Swappability across different platforms  
- Testability and simulability of behavior  
- Code elimination for unused platform implementations  

If a platform type appears in an interface, then that interface becomes non-reusable, unmaintainable, and causes upper-layer logic to depend on concrete implementations.

