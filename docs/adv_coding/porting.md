---
id: adv-coding-porting
title: 平台移植
sidebar_position: 5
---

# 平台移植

LibXR 的平台相关代码分为两层：系统层目录 `system/<名称>/` 实现线程、互斥锁、信号量和平台初始化，外设驱动目录 `driver/<名称>/` 实现时间基准和各外设类。工程用 CMake 变量 `LIBXR_SYSTEM`、`LIBXR_DRIVER` 选择这两个目录（见 [CMake 配置](../basic_coding/cmake.md)）。在新的操作系统上使用 LibXR 时新增系统层目录，在新的芯片上使用时新增外设驱动目录；两层可以分别沿用已有实现，例如在新芯片上运行 FreeRTOS 时只新增 `driver/<名称>/`，系统层沿用 `system/freertos/`。

本页以无操作系统的 `system/none/` 和 HPM 芯片的 `driver/hpm/` 为例。HPM5301 模板工程正是以 `LIBXR_SYSTEM None`、`LIBXR_DRIVER hpm` 接入 LibXR 的。

## 1. 目录的选择

`cmake/config.cmake` 把 `LIBXR_SYSTEM`、`LIBXR_DRIVER` 转为小写后：

- include LibXR 源码树中的 `driver/<LIBXR_DRIVER>/CMakeLists.txt` 和 `system/<LIBXR_SYSTEM>/CMakeLists.txt`，因此新目录放在 LibXR 源码树中，目录名就是变量的取值；
- 为目标 `xr` 定义公开宏 `LIBXR_SYSTEM_<名称>=True`，代码可以据此区分系统层；
- `LIBXR_SINGLE_CORE` 未设置时，linux、webots 默认 `OFF`，其他系统层默认 `ON`，它决定并发结构的对齐粒度（见[公共定义](../basic_coding/core/core-def.md)）。

交叉编译时不自动选择系统层，未设置 `LIBXR_SYSTEM` 时配置阶段报 `No system selected.`；未设置 `LIBXR_DRIVER` 时给出警告 `No driver selected.`，不加入任何外设驱动。

## 2. 系统层

现有的系统层目录都包含下面这组文件：

| 文件 | 内容 |
| --- | --- |
| `CMakeLists.txt` | 把本目录的 `.cpp` 加入 `xr`，并把本目录加入公开头文件路径 |
| `libxr_system.hpp` | 句柄类型 `libxr_mutex_handle`、`libxr_semaphore_handle`、`libxr_thread_handle`，以及 `PlatformInit()` 的声明 |
| `libxr_system.cpp` | `PlatformInit()` 的实现 |
| `thread.hpp`、`thread.cpp` | `LibXR::Thread`：`Priority` 枚举，以及 `Create()`、`Current()`、`GetTime()`、`Sleep()`、`SleepUntil()`、`Yield()` |
| `mutex.cpp` | `src/system/mutex.hpp` 中声明的 `LibXR::Mutex` 的构造、析构、`Lock()`、`TryLock()` 和 `Unlock()` |
| `semaphore.cpp` | `src/system/semaphore.hpp` 中声明的 `LibXR::Semaphore` 的构造、析构、`Post()`、`PostFromCallback()`、`Wait()` 和 `Value()` |

带参数的 `PlatformInit()` 把参数写入 `Timer::priority_` 和 `Timer::stack_depth_`，再完成本平台需要的初始化；FreeRTOS、ThreadX 的实现先用 `Timebase::IsReady()` 检查时间基准是否已经构造。各后端的签名和行为见[平台初始化](../basic_coding/system/README.md#平台初始化)。

没有线程的系统层另有两处不同。第一，`CMakeLists.txt` 定义公开宏 `LIBXR_NOT_SUPPORT_MUTI_THREAD=1`，`Timer` 和 `ASync` 据此不创建线程，`Thread::Create()` 在当前上下文直接调用线程函数（见 [Thread](../basic_coding/system/thread.md)）。以下是 `system/none/CMakeLists.txt` 的全文：

```cmake
file(
  GLOB ${PROJECT_NAME}_SYSTEM_SOURCES CONFIGURE_DEPENDS
  "${CMAKE_CURRENT_LIST_DIR}/*.cpp"
)
list(SORT ${PROJECT_NAME}_SYSTEM_SOURCES)

target_sources(${PROJECT_NAME}
  PRIVATE ${${PROJECT_NAME}_SYSTEM_SOURCES}
)

target_include_directories(${PROJECT_NAME}
  PUBLIC ${CMAKE_CURRENT_LIST_DIR}
)

target_compile_definitions(${PROJECT_NAME}
  PUBLIC LIBXR_NOT_SUPPORT_MUTI_THREAD=1
)
message(STATUS "Multi-thread support is disabled for system/none.")
```

第二，`libxr_system.cpp` 实现 `Timer::RefreshTimerInIdle()`。`Thread::Sleep()`、`Thread::SleepUntil()` 以及 `Mutex`、`Semaphore` 的等待循环调用它，时间基准每前进 1 ms，它调用一次 `Timer::Refresh()`。以下节选自 `system/none/libxr_system.cpp`：

```cpp
void LibXR::PlatformInit() {}

void LibXR::Timer::RefreshTimerInIdle()
{
  static bool in_timer = false;
  if (in_timer)
  {
    return;
  }

  static auto last_refresh_time = Timebase::GetMilliseconds();

  if (last_refresh_time == Timebase::GetMilliseconds())
  {
    return;
  }

  in_timer = true;
  last_refresh_time = (last_refresh_time + 1);
  Timer::Refresh();
  in_timer = false;
}
```

## 3. 外设驱动层

以下是 `driver/hpm/CMakeLists.txt` 的全文。它把目录中的 `.cpp`、`.c` 加入 `xr`，并把目录加入公开头文件路径：

```cmake
file(GLOB ${PROJECT_NAME}_DRIVER_CPP_SOURCES "${CMAKE_CURRENT_LIST_DIR}/*.cpp")

file(GLOB ${PROJECT_NAME}_DRIVER_C_SOURCES "${CMAKE_CURRENT_LIST_DIR}/*.c")

target_sources(
  ${PROJECT_NAME}
  PRIVATE ${${PROJECT_NAME}_DRIVER_CPP_SOURCES}
  PRIVATE ${${PROJECT_NAME}_DRIVER_C_SOURCES})

target_include_directories(${PROJECT_NAME} PUBLIC ${CMAKE_CURRENT_LIST_DIR})
```

芯片厂商 SDK 的头文件路径和编译选项由工程提供给 `xr` 目标，例如 HPM5301 模板在 `cmake/LibXR.CMake` 中把 SDK 的编译选项传给 `xr`。

外设驱动目录至少提供时间基准。时间基准类派生自 `LibXR::Timebase`，构造函数调用 `ConfigureWrapRange()` 设置时间戳的回绕范围，再调用 `SetReady()`；静态函数 `Timebase::GetMicroseconds()` 和 `Timebase::GetMilliseconds()` 也在这个源文件中实现。以下节选自 `driver/hpm/hpm_timebase.cpp`：

```cpp
HPMTimebase::HPMTimebase(MCHTMR_Type* timer, clock_name_t clock)
{
  g_timer = timer;
  g_clock_hz = clock_get_frequency(clock);
  ConfigureWrapRange(static_cast<uint64_t>(UINT32_MAX) * 1000ULL + 999ULL, UINT32_MAX);
  SetReady();
}

MicrosecondTimestamp Timebase::GetMicroseconds()
{
  const uint64_t ticks = mchtmr_get_count(g_timer);
  return MicrosecondTimestamp(ConvertTicksToTime(ticks, g_clock_hz, 1000000ULL));
}

// ...（Timebase::GetMilliseconds() 写法相同）
```

其余外设按需要实现，每个外设类派生自 `src/driver/` 中的抽象类，`driver/hpm/` 中有 `HPMGPIO`、`HPMI2C` 和 `HPMPWM`。抽象类的接口见[外设驱动](../basic_coding/driver/README.md)。串口这类经过 `ReadPort` / `WritePort` 的外设，驱动与端口之间的接口见 [IO 完成语义与 Port 状态机](./core/rw_semantics.md)，`STM32UART` 的整体结构见[串口驱动设计](./driver/uart_driver.md)；直接带 `Operation` 的 SPI、I2C 等传输，`BLOCK` 模式的等待写法见 [BLOCK 超时与完成交接](./driver/block_timeout_semantics.md)。

## 4. 在工程中使用

工程在 `add_subdirectory(libxr)` 之前把两个变量设为新目录的名称：

```cmake
set(LIBXR_SYSTEM none CACHE STRING "" FORCE)
set(LIBXR_DRIVER hpm CACHE STRING "" FORCE)
add_subdirectory(libxr)
```

启动代码先构造时间基准对象，再调用 `LibXR::PlatformInit()`，之后才使用线程、定时器和外设对象。
