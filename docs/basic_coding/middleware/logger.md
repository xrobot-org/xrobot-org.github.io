---
id: logger
title: 日志系统
sidebar_position: 2
---

# Logger 日志系统

LibXR 的日志系统把每条日志发布到 Topic `/xr/log`，支持五个日志等级、格式化文本和按等级着色的终端输出。

## 功能

- 五个日志等级：Debug、Info、Pass、Warn、Error。
- 所有日志发布到 `/xr/log`，其他代码可以订阅并转发。
- 终端输出按日志等级选择颜色。
- `LIBXR_LOG_LEVEL` 决定哪些日志宏参与编译并发布到 `/xr/log`，`LIBXR_LOG_OUTPUT_LEVEL` 决定哪些日志打印到 `STDIO::write_`。

---

## 使用方式

```cpp
XR_LOG_DEBUG("Debug value: %d", value);
XR_LOG_INFO("System started");
XR_LOG_PASS("Test passed");
XR_LOG_WARN("Low battery");
XR_LOG_ERROR("Sensor failure");
```

日志发布到 `/xr/log`；等级值不大于 `LIBXR_LOG_OUTPUT_LEVEL` 且 `STDIO::write_` 已设置时，同时打印到终端。

---

## 宏定义等级控制

CMake 变量 `LIBXR_LOG_LEVEL` 决定编译时保留的日志宏，`LIBXR_LOG_OUTPUT_LEVEL` 决定打印到 `STDIO::write_` 的日志。两者取值如下表，默认都是 4，在 `add_subdirectory(libxr)` 之前用 `set()` 设置：

| 等级 | 宏值 | 宏示例         |
|------|------|----------------|
| ERROR | 0  | `XR_LOG_ERROR(...)` |
| WARN  | 1  | `XR_LOG_WARN(...)`  |
| PASS  | 2  | `XR_LOG_PASS(...)`  |
| INFO  | 3  | `XR_LOG_INFO(...)`  |
| DEBUG | 4  | `XR_LOG_DEBUG(...)` |

等级值大于 `LIBXR_LOG_LEVEL` 的日志宏展开为空，参数不会被求值。

---

## 发布机制与终端回显

- 所有日志封装为 `LogData` 结构体，通过 `Logger::Publish()` 发布。
- 注册的回调函数会自动将日志输出到终端 `STDIO::write_`。
- 日志宏用互斥量串行化 `/xr/log` 的发布，第一次调用时还会创建该 Topic 并分配内存，因此只在线程上下文中调用，不在中断中使用。

---

## 与其他中间件的集成

日志发布在 `/xr/log`（类型 `LibXR::LogData`），其他代码可以订阅该 Topic，把日志转发到其他链路。常与 Terminal/RamFS 联合用于 CLI 系统调试。

---

更多信息请参考 `logger.hpp` 与 `logger.cpp` 源文件。
