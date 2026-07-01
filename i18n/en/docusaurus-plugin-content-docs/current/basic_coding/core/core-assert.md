---
id: core-assert
title: Assertions and Error Handling
sidebar_position: 2
---

# Assertions and Error Handling

This module provides runtime error checking and fatal-error callback management. In current mainline, the public surface is centered on the `LibXR::Assert` namespace together with the `ASSERT` / `ASSERT_FROM_CALLBACK` macros.

## Fatal Error Handling Interface

```cpp
extern "C" void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

This function is used to terminate program execution and can be called from both normal and callback contexts. It is automatically invoked on assertion failure and can be handled through callbacks registered in the `LibXR::Assert` namespace.

## `LibXR::Assert` Namespace

The current public surface mainly includes:

- `using FatalCallback = LibXR::Callback<const char*, uint32_t>`
- `RegisterFatalErrorCallback(cb)`
- `FatalErrorCallback()`
- `RunFatalErrorCallback(in_isr, file, line)`

### Registering Callbacks

```cpp
LibXR::Assert::RegisterFatalErrorCallback(cb);
```

Accepts `LibXR::Assert::FatalCallback`, that is, `LibXR::Callback<const char*, uint32_t>`, to handle fatal error events.

Note: the size-relation predicate itself is currently exposed from `libxr_def.hpp` as `constexpr bool SizeLimitCheck(...)`, rather than as a separate debug-only static class API here.

## Macros: Assertion Checks

- `ASSERT(expr)`: Regular context assertion; calls `libxr_fatal_error(...)` on failure  
- `ASSERT_FROM_CALLBACK(expr, in_isr)`: ISR context assertion

These macros are enabled or disabled by `LIBXR_DEBUG_BUILD` and are recommended for defensive programming during development.

## Usage Example

```cpp
using Arg = int;
Arg arg = 0;

auto err_cb = LibXR::Assert::FatalCallback::Create(
    [](bool in_isr, Arg arg, const char *file, uint32_t line)
    {
    (void)in_isr;
    (void)arg;
    (void)file;
    (void)line;
    // do something
    },
    arg);

LibXR::Assert::RegisterFatalErrorCallback(err_cb);
ASSERT(buffer != nullptr);
ASSERT_FROM_CALLBACK(buffer != nullptr, in_isr);
```

It is recommended to enable assertions and validations early in development.
