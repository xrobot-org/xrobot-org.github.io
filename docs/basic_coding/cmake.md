---
id: basic-cmake
title: CMake 配置
sidebar_position: 0
---

# CMake 配置

LibXR 的 CMake 目标名为 `xr`，使用 C++20。上层工程负责工具链、启动代码、链接脚本和厂商 SDK；LibXR 负责选择系统层、外设后端和自身功能选项。

## 基本接入

Linux 工程可以直接选择系统和驱动：

```cmake
cmake_minimum_required(VERSION 3.12)
project(example LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(LIBXR_SYSTEM linux CACHE STRING "" FORCE)
set(LIBXR_DRIVER linux CACHE STRING "" FORCE)
add_subdirectory(libxr)

target_link_libraries(app PRIVATE xr)
```

交叉编译工程同样先设置 `LIBXR_SYSTEM` 和 `LIBXR_DRIVER`，再 `add_subdirectory(libxr)`。例如 STM32 + FreeRTOS 使用：

```cmake
set(LIBXR_SYSTEM freertos CACHE STRING "" FORCE)
set(LIBXR_DRIVER st CACHE STRING "" FORCE)
add_subdirectory(libxr)
```

## 系统与驱动

系统实现位于 `system/`，当前包括：

- `freertos`
- `linux`
- `none`
- `threadx`
- `webasm`
- `webots`

外设后端位于 `driver/`，当前包括：

- `st`
- `ch`
- `esp`
- `hpm`
- `linux`
- `mspm0`
- `webasm`
- `webots`

CMake 内部会把配置名称转换为小写。Windows 可以作为 MCU 交叉编译和文档开发主机；当前仓库没有 `system/windows` 与 `driver/windows`，因此没有原生 Windows LibXR 后端。

## 常用选项

| 选项 | 作用 |
| --- | --- |
| `LIBXR_NO_EIGEN` | 不编译依赖 Eigen 的几何与运动学部分 |
| `LIBXR_DEFAULT_SCALAR` | 默认数学标量类型，默认 `double` |
| `LIBXR_SINGLE_CORE` | 单核并发对齐策略 |
| `LIBXR_DEV_ASSERT_BUILD` | 启用维护者断言，默认关闭 |
| `LIBXR_TEST_BUILD` | 构建仓库测试 |
| `LIBXR_STATIC_BUILD` | 构建静态库 |
| `LIBXR_SHARED_BUILD` | 构建共享库 |
| `LIBXR_OBJECT_BUILD` | 构建对象库 |

未指定库类型时默认构建静态库。Debug 构建定义 `LIBXR_DEBUG_BUILD`；`LIBXR_DEV_ASSERT_BUILD` 独立控制 `DEV_ASSERT`。

## 日志与格式化

以下变量会变成公开编译定义：

```cmake
LIBXR_LOG_LEVEL
LIBXR_LOG_OUTPUT_LEVEL
XR_LOG_MESSAGE_MAX_LEN
LIBXR_DEFAULT_SCALAR
```

格式化功能还可以裁剪 64 位整数、double、科学计数、指针、显式参数索引等代码。具体选项见 `cmake/config.cmake`。

## XRobot 模块

在引入 LibXR 前设置 `XROBOT_MODULES_DIR`：

```cmake
set(XROBOT_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/Modules")
add_subdirectory(libxr)
```

LibXR 会检查该目录下各模块的 `CMakeLists.txt` 并依次包含。

更换系统、驱动、编译器或 SDK 后，建议使用新的 build 目录，避免旧 CMake cache 保留上一套探测结果。
