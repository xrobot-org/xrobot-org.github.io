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

add_executable(app main.cpp)
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

CMake 内部会把配置名称转换为小写。交叉编译时须设置 `LIBXR_SYSTEM`，未设置时配置阶段报 `No system selected.`。不交叉编译时，未设置的 `LIBXR_SYSTEM` 和 `LIBXR_DRIVER` 按主机选择：Linux 主机选择 `linux`，设置了 CMake 变量 `WEBOTS_HOME` 时选择 `webots`。Windows 主机用于 MCU 工程的交叉编译；主机程序在 WSL 或 `docker-image-linux` 镜像（见 [Docker 环境配置](../env_setup/docker.md)）的 Linux 环境中构建。在 Windows 主机上不交叉编译时，配置阶段报 `LibXR has no Windows system or driver layer.`，并给出这两种做法。

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

格式化功能还可以裁剪 64 位整数、double、科学计数、指针、显式参数索引等代码。各选项及默认值见[编译期格式化输出](./core/core-print.md)的“打印配置”一节。

## XRobot 模块

在引入 LibXR 前设置 `XROBOT_MODULES_DIR`（需要 CMake 3.19 或更新）：

```cmake
set(XROBOT_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/Modules")
add_subdirectory(libxr)
```

LibXR 随后包含该目录下由 `xrobot setup` 生成的 `CMakeLists.txt`，并检查 `User/xrobot_main.hpp`，见 XRobot 的 [CMake 集成](../proj_man/setup.md)。

更换系统、驱动、编译器或 SDK 后，建议使用新的 build 目录，避免旧 CMake cache 保留上一套探测结果。
