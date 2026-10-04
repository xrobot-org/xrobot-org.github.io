---
id: logger
title: Logger System
sidebar_position: 2
---

# Logger System

The LibXR logger publishes each log record to the Topic `/xr/log`. It supports five log levels, formatted text, and terminal output colored by level.

## Features

- Five log levels: Debug, Info, Pass, Warn, Error.
- Every log record is published to `/xr/log`, where other code can subscribe and forward it.
- Terminal output is colored by log level.
- `LIBXR_LOG_LEVEL` selects which log macros are compiled and published to `/xr/log`; `LIBXR_LOG_OUTPUT_LEVEL` selects which records are printed to `STDIO::write_`.

---

## Usage

```cpp
XR_LOG_DEBUG("Debug value: %d", value);
XR_LOG_INFO("System started");
XR_LOG_PASS("Test passed");
XR_LOG_WARN("Low battery");
XR_LOG_ERROR("Sensor failure");
```

Logs are published to `/xr/log`; when the level value is not greater than `LIBXR_LOG_OUTPUT_LEVEL` and `STDIO::write_` is set, they are also printed to the terminal. On Linux, `STDIO::write_` is created by `PlatformInit()`; on an MCU the application sets it, for example `LibXR::STDIO::write_ = uart.write_port_;` (see the STDIO section of [IO Read/Write Abstraction](../core/core-rw.md)).

---

## Format strings and output format

The log macros expand to `LibXR::Logger::Publish<fmt>(...)` and the format string is parsed at compile time, so it must be a string literal. It can use printf style (`%d`) or brace style (`{}`); the macro picks one from the literal and the arguments. When both styles are valid for the same literal, compilation fails with:

```text
static assertion failed: LibXR::Logger: literal is ambiguous between brace and printf frontends; use XR_FMT(...) or XR_PRINTF(...)
```

In that case the literal is wrapped in `XR_FMT("...")` or `XR_PRINTF("...")` to select brace style or printf style. The available format specifiers and the format features that must be enabled separately are described in [Compile-Time Formatting](../core/core-print.md).

The formatted text is written to `LogData::message`, whose buffer length is `XR_LOG_MESSAGE_MAX_LEN` (including the terminating `\0`); longer text is truncated. The default length is 64, and 256 on the linux, webots and webasm system layers; it can be changed with `set()` before `add_subdirectory(libxr)`.

On the terminal, each log line consists of the color control characters, the level letter (`D`, `I`, `P`, `W`, `E`), the millisecond timestamp in square brackets, the file name and line number in parentheses, and the message text, ending with `\r\n`. The program below runs on Linux:

```cpp
LibXR::PlatformInit();
int value = 7;
XR_LOG_DEBUG("Debug value: %d", value);
XR_LOG_INFO("brace value: {}", value);
XR_LOG_WARN(XR_PRINTF("pct %d {}"), value);
XR_LOG_PASS("Test passed");
```

Terminal output (color control characters omitted):

```text
D [0](./logger_doc.cpp:7) Debug value: 7
I [0](./logger_doc.cpp:8) brace value: 7
W [0](./logger_doc.cpp:9) pct 7 {}
P [0](./logger_doc.cpp:10) Test passed
```

---

## Macro Level Control

The CMake variable `LIBXR_LOG_LEVEL` selects which log macros are compiled, and `LIBXR_LOG_OUTPUT_LEVEL` selects which logs are printed to `STDIO::write_`. Both take the values below, default to 4, and are set with `set()` before `add_subdirectory(libxr)`:

| Level | Value | Macro Example         |
|-------|--------|------------------------|
| ERROR | 0      | `XR_LOG_ERROR(...)`    |
| WARN  | 1      | `XR_LOG_WARN(...)`     |
| PASS  | 2      | `XR_LOG_PASS(...)`     |
| INFO  | 3      | `XR_LOG_INFO(...)`     |
| DEBUG | 4      | `XR_LOG_DEBUG(...)`    |

Log macros whose level value is greater than `LIBXR_LOG_LEVEL` expand to nothing, and their arguments are not evaluated.

---

## Publishing Mechanism & Terminal Echo

- All logs are encapsulated in the `LogData` structure and published via `Logger::Publish()`.
- Registered callback functions automatically format and print logs to the terminal via `STDIO::write_`.
- Log macros serialize publishing to `/xr/log` with a mutex, and the first call creates the topic and allocates memory; they are called from thread context only, not from interrupts.

---

## Integration with Other Middleware

Logs are published on `/xr/log` (type `LibXR::LogData`); other code can subscribe to that Topic to forward logs to other links. It is commonly used with Terminal/RamFS for CLI debugging.

---

For more details, refer to the `logger.hpp` and `logger.cpp` source files.
