---
id: core-time
title: 时间戳与时间差
sidebar_position: 7
---

# 时间戳与时间差

本模块定义了微秒级和毫秒级的时间戳类型 `MicrosecondTimestamp` 和 `MillisecondTimestamp`，用于表示系统时钟时间，并可计算两个时间点之间的时间差。适用于定时器、延迟控制、性能分析等场景。

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

时间差计算中已考虑时间戳回绕（如溢出），可用于嵌入式平台上的系统时钟处理。

为适配不同平台/时间基，当前主线在 `LibXR::Detail` 命名空间中维护时间基回绕上界配置：

```cpp
uint64_t TimebaseMaxValidUs();
uint32_t TimebaseMaxValidMs();
void ConfigureTimebaseWrapRange(uint64_t max_valid_us,
                                uint32_t max_valid_ms) noexcept;
```

这些接口/内部存储用于指定“时间基最大有效值”（微秒/毫秒），以便在回绕场景下进行差值计算与合法性判定。

当前主线已经不再通过旧式的外部全局变量暴露这一组配置量。
