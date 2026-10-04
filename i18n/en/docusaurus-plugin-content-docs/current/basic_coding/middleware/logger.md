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

Logs are published to `/xr/log`; when the level value is not greater than `LIBXR_LOG_OUTPUT_LEVEL` and `STDIO::write_` is set, they are also printed to the terminal.

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
