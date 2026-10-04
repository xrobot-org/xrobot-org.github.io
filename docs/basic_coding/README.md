---
id: basic-coding
title: 基础编程（LibXR）
sidebar_position: 4
---

# 基础编程（LibXR）

本章介绍 LibXR 的 CMake 配置和基础 API 的用法。基础 API 包括核心 API、数据结构、中间件、操作系统抽象、外设驱动以及数学与工具。

## 本章前提

各页的示例假定工程已按 [CMake 配置](./cmake.md) 链接 `xr`，并包含 `libxr.hpp`。外设驱动的头文件（如 `uart.hpp`、`gpio.hpp`）和部分工具头文件（如 `pid.hpp`、`cycle_value.hpp`、`serialized_service.hpp`）不在 `libxr.hpp` 中，使用时单独包含。开启 `LIBXR_NO_EIGEN` 时，`transform.hpp`、`kinematic.hpp` 和 `inertia.hpp` 的内容不参与编译。

程序先调用一次 `LibXR::PlatformInit()`，再使用 LibXR 的其他功能，各后端的参数与调用顺序见[平台初始化](./system/README.md#平台初始化)。以下是 Linux 上的最小程序，运行后输出 `Hello, 42`：

```cpp
#include "libxr.hpp"

int main()
{
  LibXR::PlatformInit();
  LibXR::STDIO::Printf<"Hello, %d\n">(42);
  LibXR::Thread::Sleep(100);  // 等待 STDIO 线程写出
  return 0;
}
```

## 目录

- [CMake 配置](./cmake.md)
- [核心 API](/docs/basic_coding/core)
- [数据结构](/docs/basic_coding/structure)
- [中间件](/docs/basic_coding/middleware)
- [操作系统](/docs/basic_coding/system)
- [外设驱动](/docs/basic_coding/driver)
- [数学与工具](/docs/basic_coding/utils)
