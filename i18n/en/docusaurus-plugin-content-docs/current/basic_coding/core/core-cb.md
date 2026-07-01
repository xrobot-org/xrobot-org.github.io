---
id: core-callback
title: General Callback
sidebar_position: 3
---

# General Callback

This module provides a lightweight and ISR-safe general callback system. The main public interface is `Callback`; its implementation is built on `CallbackBlock` plus the optional `GuardedCallbackBlock`, and is commonly used for asynchronous notifications, event handling, and error callbacks.

## CallbackBlock

```cpp
template <typename ArgType, typename... Args>
class CallbackBlock;
```

Encapsulates a concrete callback function together with its first bound argument, and provides the erased invocation entry used from ISR or task contexts:

- `FunctionType`: Callback function signature: `void(bool in_isr, ArgType arg, Args... args)`.
- Actual invocation is routed through the internal `InvokeThunk(...)` / `Invoke(...)` path.

Binding is completed during construction. Copy is explicitly disabled, and the block should not be treated as a small ordinary value object.

### Reentrancy Guard Semantics of `GuardedCallbackBlock`

In current mainline, reentrancy protection is not enabled by default in `CallbackBlock`. It is implemented by `GuardedCallbackBlock`, and the user-facing entry is:

```cpp
LibXR::Callback<Args...>::CreateGuarded(fun, bound_arg);
```

This guard prevents callback chains from blowing up the stack when they form loops (for example A → B → C → A, re-triggering the same callback while it is still running).

If the same guarded callback is triggered again while it is executing:

- No new nested stack frame is created (the callback is **not** invoked recursively).
- Only one pending request is cached (a snapshot of the latest arguments overwrites previous pending arguments).
- Once the current invocation finishes, the pending request is replayed at the same call site via a trampoline-style loop until no pending call remains.

> To cache the pending arguments, the implementation stores `Args...` as `std::decay_t` copies internally.

## Callback

```cpp
template <typename... Args>
class Callback;
```

A further abstraction over the underlying callback blocks, providing a unified interface, type erasure, and factory methods.

### Creating a callback

```cpp
LibXR::Callback<Args...> cb = LibXR::Callback<Args...>::Create(fun, bound_arg);
```

- `fun`: Callback function in the form `void(bool, BoundArgType, Args...)` and **must be convertible to a function pointer** (plain functions, static member functions, capture-less lambdas, etc.).
- `bound_arg`: The first argument bound to the callback

> `Create` currently performs `new CallbackBlock<BoundArgType, Args...>`, so it **allocates dynamically** and `Callback` itself does not manage deallocation.

If you need the guarded variant:

```cpp
LibXR::Callback<Args...> cb = LibXR::Callback<Args...>::CreateGuarded(fun, bound_arg);
```

That path currently allocates `GuardedCallbackBlock<...>`.

### Running a callback

```cpp
cb.Run(in_isr, arg1, arg2, ...);
```

Any number of additional arguments can be passed. `in_isr` indicates if the call is within an interrupt context. Calling `Run` on an empty callback is a safe no-op.

### Other interfaces

- `Empty()`: Checks if the callback is empty (current implementation: `cb_block_ == &empty_cb_block_`).
- Supports default constructor, copy constructor, move constructor, and assignment.
  - Copying is shallow: multiple `Callback` instances share the same block pointer and entry point.

## Example Usage

```cpp
void OnEvent(bool in_isr, int context, const char* msg) {
  printf("ISR=%d context=%d msg=%s\n", in_isr, context, msg);
}

auto cb = LibXR::Callback<const char*>::Create(OnEvent, 42);
cb.Run(false, "Hello");
```

Output:

```bash
ISR=0 context=42 msg=Hello
```

## Design Features

- **Optional reentrancy guard**: trampoline-style flattening is enabled only on the `CreateGuarded(...)` path; ordinary `Create(...)` builds a plain `CallbackBlock`.
- **ISR-friendly**: Every interface explicitly carries `in_isr`, making it safe to run inside interrupts.
- **Type-safe encapsulation**: Templates and type deduction perform binding and invocation in a type-safe manner.
- **Lightweight & embeddable**: Minimal structure suitable for IO, timers, event buses, and other callback-based modules.
