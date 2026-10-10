---
id: core-assert
title: Assertions and Error Handling
sidebar_position: 2
---

# Assertions and Error Handling

`libxr_assert.hpp` provides runtime checks and fatal-error callback management: the fatal-callback functions in the `LibXR::Assert` namespace and the `ASSERT` / `REQUIRE` check macros.

## Fatal Error Handling Interface

```cpp
extern "C" void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

`libxr_fatal_error()` is called when an assertion fails and does not return. In thread context (`in_isr` false) it prints `"Fatal error at <file>:<line>"` when `STDIO::write_` is bound and writable, runs the registered fatal callback with `in_isr` set to false, sleeps 500 ms and repeats, so the callback runs repeatedly. With `in_isr` true it only writes to address 0 to trigger a hardware fault and does not run the callback.

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

## Macros: Assertion Checks

| Macro | Enabled when | When disabled | Purpose |
| --- | --- | --- | --- |
| `ASSERT(expr)` / `ASSERT_FROM_CALLBACK(expr, in_isr)` | `LIBXR_DEBUG_BUILD` defined; when not set explicitly it follows the build type (on for Debug), and `-DLIBXR_DEBUG_BUILD=ON/OFF` overrides it for any build type | expression still evaluated, not checked | preconditions and configuration |
| `REQUIRE(expr)` / `REQUIRE_FROM_CALLBACK(expr, in_isr)` | always | — | unrecoverable runtime errors |
| `DEV_ASSERT(expr)` / `DEV_ASSERT_FROM_CALLBACK(expr, in_isr)` | CMake option `LIBXR_DEV_ASSERT_BUILD=ON` | expression not evaluated | LibXR internal development checks |

On failure the macro calls `libxr_fatal_error(__FILE__, __LINE__, in_isr)`. The plain forms pass `in_isr = false`; the `_FROM_CALLBACK` forms are for callbacks or ISRs and pass `in_isr` through. A disabled `ASSERT` still evaluates its expression, so required operations belong outside the macro.

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
// buffer and in_isr come from the calling context
ASSERT(buffer != nullptr);
ASSERT_FROM_CALLBACK(buffer != nullptr, in_isr);
```
