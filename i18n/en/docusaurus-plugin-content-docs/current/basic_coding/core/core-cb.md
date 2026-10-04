---
id: core-callback
title: General Callback
sidebar_position: 3
---

# General Callback

`libxr_cb.hpp` provides the generic callback `Callback`, built on `CallbackBlock` and the optional `GuardedCallbackBlock`, for asynchronous notifications, event handling and error callbacks.

## CallbackBlock

```cpp
template <typename ArgType, typename... Args>
class CallbackBlock;
```

Encapsulates a concrete callback function together with its first bound argument, and provides the erased invocation entry used from ISR or task contexts:

- `FunctionType`: Callback function signature: `void(bool in_isr, ArgType arg, Args... args)`.

The function and argument are bound at construction. `CallbackBlock` is not copyable; copies of a `Callback` share one block.

### Reentrancy Guard Semantics of `GuardedCallbackBlock`

`GuardedCallbackBlock` adds reentrancy protection to `CallbackBlock`; the user-facing entry is:

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

> `Create` allocates a `CallbackBlock<BoundArgType, Args...>` with `new` and the block is never freed; call `Create()` / `CreateGuarded()` during initialization and keep the callback long-lived.

Guarded variant:

```cpp
LibXR::Callback<Args...> cb = LibXR::Callback<Args...>::CreateGuarded(fun, bound_arg);
```

That path allocates `GuardedCallbackBlock<...>`. The guard flattens recursion on one call chain; concurrent triggering from several threads or ISRs needs external synchronization.

### Running a callback

```cpp
cb.Run(in_isr, arg1, arg2, ...);
```

Any number of additional arguments can be passed. `in_isr` indicates if the call is within an interrupt context. Calling `Run` on an empty callback is a safe no-op.

### Other interfaces

- `Empty()`: Checks whether the callback is empty.
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

- Only callbacks created by `CreateGuarded(...)` have the reentrancy guard; `Create(...)` builds a plain `CallbackBlock`.
- `Run()` may be called from an ISR and passes `in_isr` to the callback; whether the callback body may run in an ISR depends on the callback. `Create()` / `CreateGuarded()` allocate memory and belong to initialization.
- Argument types are fixed by the template parameters and checked at compile time.
- Used for callbacks in IO, timers, event publishing and similar paths.
