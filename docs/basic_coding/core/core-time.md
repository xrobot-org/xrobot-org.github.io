---
id: core-time
title: 时间戳与时间差
sidebar_position: 9
---

# 时间戳与时间差

`libxr_time.hpp` 定义微秒级和毫秒级时间戳 `MicrosecondTimestamp`、`MillisecondTimestamp` 及其时间差 `Duration`。当前时间由 [Timebase](../driver/timebase.md) 的 `GetMicroseconds()` / `GetMilliseconds()` 取得。

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

表示微秒级时间戳，支持隐式转换为 `uint64_t`，可计算时间差。

### Duration

`MicrosecondTimestamp::Duration` 表示两个 `MicrosecondTimestamp` 之间的差值，单位为微秒。支持以秒/毫秒返回差值。

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

表示毫秒级时间戳，支持隐式转换为 `uint32_t`，可计算时间差。

### Duration

`MillisecondTimestamp::Duration` 表示两个 `MillisecondTimestamp` 之间的差值，单位为毫秒。支持以秒/微秒返回差值。

## 溢出处理

新时间戳小于旧时间戳时，减法按一次回绕计算；差值超过回绕上界时 Debug 构建断言失败。

回绕上界保存在 `LibXR::Detail` 命名空间中：

```cpp
uint64_t TimebaseMaxValidUs();
uint32_t TimebaseMaxValidMs();
void ConfigureTimebaseWrapRange(uint64_t max_valid_us,
                                uint32_t max_valid_ms) noexcept;
```

平台的 Timebase 后端在构造时调用 `Timebase::ConfigureWrapRange()` 设置上界，该函数转发到 `Detail::ConfigureTimebaseWrapRange()`；未设置时上界为 `UINT64_MAX` / `UINT32_MAX`。应用代码通常不直接调用 `Detail` 中的函数。
