---
id: timebase
title: 时间基准
sidebar_position: 11
---

# Timebase（时间基准）

`LibXR::Timebase` 提供 LibXR 统一使用的时间基准契约，用于访问微秒级和毫秒级时间戳。它是超时处理、周期调度，以及 Topic、USB 等带时间语义的组件的基础。

## 接口定义

```cpp
class Timebase {
public:
  Timebase() = default;
  Timebase(const Timebase&) = delete;
  Timebase& operator=(const Timebase&) = delete;

  // 获取当前时间（微秒）
  static MicrosecondTimestamp GetMicroseconds();

  // 获取当前时间（毫秒）
  static MillisecondTimestamp GetMilliseconds();

  // 检查后端是否已完成初始化
  [[nodiscard]] static bool IsReady() noexcept;

  // 微秒级忙等待
  static void DelayMicroseconds(uint32_t us);

protected:
  static void SetReady(bool ready = true) noexcept;
  static void ConfigureWrapRange(uint64_t max_valid_us,
                                 uint32_t max_valid_ms) noexcept;
  [[nodiscard]] static uint64_t GetConfiguredWrapRangeUs() noexcept;
  [[nodiscard]] static uint32_t GetConfiguredWrapRangeMs() noexcept;
};
```

## 使用说明

- `GetMicroseconds()` 与 `GetMilliseconds()` 返回 `MicrosecondTimestamp`、`MillisecondTimestamp`，其定义位于 `core/libxr_time.hpp`。
- 时间戳做减法时会按当前配置的回绕范围处理；后端可通过 `ConfigureWrapRange(...)` 指定有效上界。
- `IsReady()` 用于检查当前平台时间基后端是否已经初始化完成。
- `DelayMicroseconds()` 提供基于微秒时间基的忙等待辅助函数。
- `LinuxTimebase`、`STM32Timebase`、`CH32Timebase`、`ESP32Timebase` 等平台后端通常在构造时完成硬件相关初始化、设置回绕范围，并通过 `SetReady()` 标记就绪。
- 静态取时接口 `GetMicroseconds()`、`GetMilliseconds()` 由各平台的时基源文件实现。
