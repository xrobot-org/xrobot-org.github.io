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

日志发布到 `/xr/log`；等级值不大于 `LIBXR_LOG_OUTPUT_LEVEL` 且 `STDIO::write_` 已设置时，同时打印到终端。Linux 上 `STDIO::write_` 由 `PlatformInit()` 创建；MCU 上由应用指定，例如 `LibXR::STDIO::write_ = uart.write_port_;`（见 [IO 读写抽象](../core/core-rw.md) 的 STDIO 一节）。

---

## 格式串与输出格式

日志宏展开为 `LibXR::Logger::Publish<fmt>(...)`，格式串在编译期解析，因此必须是字符串字面量。格式串可以使用 printf 风格（`%d`）或 brace 风格（`{}`），宏根据字面量和参数选择其中一种。两种写法在同一个字面量中都成立时，编译报错：

```text
static assertion failed: LibXR::Logger: literal is ambiguous between brace and printf frontends; use XR_FMT(...) or XR_PRINTF(...)
```

这时用 `XR_FMT("...")` 或 `XR_PRINTF("...")` 包住字面量，指定使用 brace 风格或 printf 风格。可用的格式说明符和需要单独开启的格式特性见[编译期格式化输出](../core/core-print.md)。

格式化后的文本写入 `LogData::message`，缓冲区长度为 `XR_LOG_MESSAGE_MAX_LEN`（含结尾的 `\0`），超出部分被截断。默认长度为 64，linux、webots、webasm 系统层为 256，可在 `add_subdirectory(libxr)` 之前用 `set()` 修改。

打印到终端时，每条日志依次输出颜色控制字符、等级字母（`D`、`I`、`P`、`W`、`E`）、方括号中的毫秒时间戳、括号中的文件名和行号、消息文本，以 `\r\n` 结尾。以下程序在 Linux 上运行：

```cpp
LibXR::PlatformInit();
int value = 7;
XR_LOG_DEBUG("Debug value: %d", value);
XR_LOG_INFO("brace value: {}", value);
XR_LOG_WARN(XR_PRINTF("pct %d {}"), value);
XR_LOG_PASS("Test passed");
```

终端输出如下（省略颜色控制字符）：

```text
D [0](./logger_doc.cpp:7) Debug value: 7
I [0](./logger_doc.cpp:8) brace value: 7
W [0](./logger_doc.cpp:9) pct 7 {}
P [0](./logger_doc.cpp:10) Test passed
```

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
