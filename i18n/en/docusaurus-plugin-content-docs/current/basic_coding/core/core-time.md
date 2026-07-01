---
id: core-time
title: Timestamps and Time Differences
sidebar_position: 7
---

# Timestamps and Time Differences

This module defines microsecond- and millisecond-level timestamp types `MicrosecondTimestamp` and `MillisecondTimestamp`, which represent system clock times and can be used to compute the time difference between two points. It is suitable for scenarios such as timers, delay control, and performance analysis.

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

Time difference computations handle timestamp wrap-around (e.g., overflow), making it suitable for system clock management on embedded platforms.

To adapt to different platforms/timebases, current mainline keeps the wrap-range configuration in the `LibXR::Detail` namespace:

```cpp
uint64_t TimebaseMaxValidUs();
uint32_t TimebaseMaxValidMs();
void ConfigureTimebaseWrapRange(uint64_t max_valid_us,
                                uint32_t max_valid_ms) noexcept;
```

These interfaces / internal storages define the "maximum valid timebase value" (microseconds/milliseconds), so wrap-around difference calculations and validity checks can be performed correctly.

In other words, current mainline no longer exposes this configuration group as the older external global variables.
