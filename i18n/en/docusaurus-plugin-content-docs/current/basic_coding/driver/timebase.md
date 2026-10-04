---
id: timebase
title: Timebase
sidebar_position: 11
---

# Timebase

`LibXR::Timebase` provides the common timebase contract used by LibXR to access microsecond and millisecond timestamps. It is the foundation for timeout handling, periodic scheduling, and timestamped middleware paths such as Topic and USB-related timing.

## Interface Definition

```cpp
class Timebase {
public:
  Timebase() = default;
  Timebase(const Timebase&) = delete;
  Timebase& operator=(const Timebase&) = delete;

  static MicrosecondTimestamp GetMicroseconds();
  static MillisecondTimestamp GetMilliseconds();
  [[nodiscard]] static bool IsReady() noexcept;
  static void DelayMicroseconds(uint32_t us);

protected:
  static void SetReady(bool ready = true) noexcept;
  static void ConfigureWrapRange(uint64_t max_valid_us,
                                 uint32_t max_valid_ms) noexcept;
  [[nodiscard]] static uint64_t GetConfiguredWrapRangeUs() noexcept;
  [[nodiscard]] static uint32_t GetConfiguredWrapRangeMs() noexcept;
};
```

## Usage Notes

- `GetMicroseconds()` and `GetMilliseconds()` return `MicrosecondTimestamp` and `MillisecondTimestamp`, defined in `core/libxr_time.hpp`.
- Timestamp subtraction is wrap-aware. Backend code can set the valid wrap range with `ConfigureWrapRange(...)`.
- `IsReady()` reports whether the active platform backend has finished initialization.
- `DelayMicroseconds()` provides a small busy-wait helper built on the microsecond timebase.
- Platform backends such as `LinuxTimebase`, `STM32Timebase`, `CH32Timebase`, and `ESP32Timebase` typically initialize hardware state in their constructors, call `ConfigureWrapRange(...)`, then mark the backend ready with `SetReady()`.
- The static getters `GetMicroseconds()` and `GetMilliseconds()` are implemented in each platform's timebase source file.
