---
id: core-time
title: Timestamps and Time Differences
sidebar_position: 9
---

# Timestamps and Time Differences

`libxr_time.hpp` defines the microsecond and millisecond timestamps `MicrosecondTimestamp` and `MillisecondTimestamp` and their `Duration`. The current time comes from `GetMicroseconds()` / `GetMilliseconds()` of [Timebase](../driver/timebase.md).

## MicrosecondTimestamp

```cpp
class MicrosecondTimestamp {
 public:
  MicrosecondTimestamp();
  MicrosecondTimestamp(uint64_t microsecond);
  operator uint64_t() const;

  class Duration {
   public:
    Duration(uint64_t diff);
    operator uint64_t() const;
    double ToSecond() const;
    float ToSecondf() const;
    uint64_t ToMicrosecond() const;
    uint32_t ToMillisecond() const;
  };

  Duration operator-(const MicrosecondTimestamp& old) const;
  MicrosecondTimestamp& operator=(const MicrosecondTimestamp& other);
};
```

Represents a microsecond-level timestamp. Supports implicit conversion to `uint64_t` and can be used to compute time differences.

### Duration

`MicrosecondTimestamp::Duration` represents the time difference between two `MicrosecondTimestamp` instances, in microseconds. Supports conversion to seconds and milliseconds.

## MillisecondTimestamp

```cpp
class MillisecondTimestamp {
 public:
  MillisecondTimestamp();
  MillisecondTimestamp(uint32_t millisecond);
  operator uint32_t() const;

  class Duration {
   public:
    Duration(uint32_t diff);
    operator uint32_t() const;
    double ToSecond() const;
    float ToSecondf() const;
    uint32_t ToMillisecond() const;
    uint64_t ToMicrosecond() const;
  };

  Duration operator-(const MillisecondTimestamp& old) const;
};
```

Represents a millisecond-level timestamp. Supports implicit conversion to `uint32_t` and can be used to compute time differences.

### Duration

`MillisecondTimestamp::Duration` represents the time difference between two `MillisecondTimestamp` instances, in milliseconds. Supports conversion to seconds and microseconds.

## Overflow Handling

When the newer timestamp is smaller, subtraction assumes one wrap-around; a difference beyond the wrap limit fails an assertion in Debug builds.

The wrap limits live in the `LibXR::Detail` namespace:

```cpp
uint64_t TimebaseMaxValidUs();
uint32_t TimebaseMaxValidMs();
void ConfigureTimebaseWrapRange(uint64_t max_valid_us,
                                uint32_t max_valid_ms) noexcept;
```

Each platform Timebase backend calls `Timebase::ConfigureWrapRange()` in its constructor, which forwards to `Detail::ConfigureTimebaseWrapRange()`; without it the limits are `UINT64_MAX` / `UINT32_MAX`. Application code normally does not call the `Detail` functions.
