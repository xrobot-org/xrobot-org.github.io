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
extern "C" void libxr_fatal_error_and_print(const char *file, uint32_t line, bool in_isr);
```

On assertion failure, execution enters one of these two C entry points, neither of which returns. In thread context (`in_isr` false), both call the registered fatal callback in a loop spaced 500 ms apart (always passing `in_isr = false`):

- `libxr_fatal_error` prints nothing and is called by `REQUIRE` / `REQUIRE_FROM_CALLBACK` with `file = nullptr` and `line = 0`, so release firmware with `ASSERT` and `DEV_ASSERT` disabled omits the print path.
- `libxr_fatal_error_and_print` prints `"Fatal error at <file>:<line>"` before each callback call when `file != nullptr` and `STDIO::write_` is bound and writable, and is called by `ASSERT` / `DEV_ASSERT` (and their `_FROM_CALLBACK` forms).

With `in_isr` true, both functions write to address 0 to trigger a hardware fault without printing or running the callback. A project that defines its own `libxr_fatal_error` while enabling `ASSERT` or `DEV_ASSERT` must also define `libxr_fatal_error_and_print`.

## `LibXR::Assert` Namespace

- `using FatalCallback = LibXR::Callback<const char*, uint32_t>`
- `RegisterFatalErrorCallback(cb)`
- `FatalErrorCallback()`
- `RunFatalErrorCallback(in_isr, file, line)`

### Registering Callbacks

```cpp
LibXR::Assert::RegisterFatalErrorCallback(cb);
```

Registers a `LibXR::Assert::FatalCallback` (`LibXR::Callback<const char*, uint32_t>`) to handle fatal errors. When triggered by `REQUIRE`, the callback receives `file = nullptr` and `line = 0`.

## Macros: Assertion Checks

| Macro | Enabled when | When disabled | Purpose |
| --- | --- | --- | --- |
| `ASSERT(expr)` / `ASSERT_FROM_CALLBACK(expr, in_isr)` | `LIBXR_DEBUG_BUILD` defined; when not set explicitly it follows the build type (on for Debug), and `-DLIBXR_DEBUG_BUILD=ON/OFF` overrides it for any build type | expression still evaluated, not checked | preconditions and configuration |
| `REQUIRE(expr)` / `REQUIRE_FROM_CALLBACK(expr, in_isr)` | always | — | unrecoverable runtime errors |
| `DEV_ASSERT(expr)` / `DEV_ASSERT_FROM_CALLBACK(expr, in_isr)` | CMake option `LIBXR_DEV_ASSERT_BUILD=ON` | expression not evaluated | LibXR internal development checks |

`ASSERT` and `DEV_ASSERT` call `libxr_fatal_error_and_print(__FILE__, __LINE__, in_isr)` on failure; `REQUIRE` calls `libxr_fatal_error(nullptr, 0U, in_isr)`, and the failing site is located from the call stack in a debugger. The plain forms pass `in_isr = false`; the `_FROM_CALLBACK` forms are for callbacks or ISRs and pass `in_isr` through. A disabled `ASSERT` still evaluates its expression, so required operations belong outside the macro.

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
