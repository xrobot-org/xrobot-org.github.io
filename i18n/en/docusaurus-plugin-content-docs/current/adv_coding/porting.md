---
id: adv-coding-porting
title: Platform Porting
sidebar_position: 5
---

# Platform Porting

LibXR's platform code is split into two layers: the system-layer directory `system/<name>/` implements threads, mutexes, semaphores and platform initialization, and the driver directory `driver/<name>/` implements the timebase and the peripheral classes. A project selects the two directories with the CMake variables `LIBXR_SYSTEM` and `LIBXR_DRIVER` (see [CMake Configuration](../basic_coding/cmake.md)). Using LibXR on a new operating system needs a new system-layer directory; using it on a new chip needs a new driver directory. Each layer can reuse an existing implementation: running FreeRTOS on a new chip, for example, only needs a new `driver/<name>/` and keeps `system/freertos/`.

This page uses `system/none/` (no operating system) and `driver/hpm/` (HPM chips) as examples. The HPM5301 template project brings in LibXR with exactly `LIBXR_SYSTEM None` and `LIBXR_DRIVER hpm`.

## 1. Directory selection

`cmake/config.cmake` converts `LIBXR_SYSTEM` and `LIBXR_DRIVER` to lowercase and then:

- includes `driver/<LIBXR_DRIVER>/CMakeLists.txt` and `system/<LIBXR_SYSTEM>/CMakeLists.txt` from the LibXR source tree, so a new directory goes into the LibXR source tree and its name is the value of the variable;
- defines the public macro `LIBXR_SYSTEM_<name>=True` on the target `xr`, which code can use to tell system layers apart;
- when `LIBXR_SINGLE_CORE` is not set, defaults it to `OFF` on linux and webots and to `ON` on the other system layers; it sets the alignment granularity of concurrent structures (see [Common Definitions](../basic_coding/core/core-def.md)).

Cross compilation selects no system layer automatically: without `LIBXR_SYSTEM`, configuration stops with `No system selected.`; without `LIBXR_DRIVER`, it warns `No driver selected.` and adds no peripheral driver.

## 2. System layer

Every existing system-layer directory contains the following files:

| File | Contents |
| --- | --- |
| `CMakeLists.txt` | Adds the directory's `.cpp` files to `xr` and adds the directory to the public include path |
| `libxr_system.hpp` | The handle types `libxr_mutex_handle`, `libxr_semaphore_handle` and `libxr_thread_handle`, and the declaration of `PlatformInit()` |
| `libxr_system.cpp` | The implementation of `PlatformInit()` |
| `thread.hpp`, `thread.cpp` | `LibXR::Thread`: the `Priority` enumeration and `Create()`, `Current()`, `GetTime()`, `Sleep()`, `SleepUntil()`, `Yield()` |
| `mutex.cpp` | The constructor, destructor, `Lock()`, `TryLock()` and `Unlock()` of `LibXR::Mutex`, declared in `src/system/mutex.hpp` |
| `semaphore.cpp` | The constructor, destructor, `Post()`, `PostFromCallback()`, `Wait()` and `Value()` of `LibXR::Semaphore`, declared in `src/system/semaphore.hpp` |

A `PlatformInit()` that takes parameters stores them in `Timer::priority_` and `Timer::stack_depth_` and then performs the initialization the platform needs; the FreeRTOS and ThreadX implementations first check with `Timebase::IsReady()` that the timebase has been constructed. The signatures and behavior per backend are in [Platform initialization](../basic_coding/system/README.md#platform-initialization).

A system layer without threads differs in two places. First, its `CMakeLists.txt` defines the public macro `LIBXR_NOT_SUPPORT_MUTI_THREAD=1`; `Timer` and `ASync` then create no threads, and `Thread::Create()` calls the thread function directly in the current context (see [Thread](../basic_coding/system/thread.md)). The full `system/none/CMakeLists.txt`:

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

Second, its `libxr_system.cpp` implements `Timer::RefreshTimerInIdle()`. `Thread::Sleep()`, `Thread::SleepUntil()` and the wait loops of `Mutex` and `Semaphore` call it, and it calls `Timer::Refresh()` once for every millisecond the timebase advances. Excerpt from `system/none/libxr_system.cpp`:

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

## 3. Driver layer

The full `driver/hpm/CMakeLists.txt` is shown below. It adds the directory's `.cpp` and `.c` files to `xr` and adds the directory to the public include path:

```cmake
file(GLOB ${PROJECT_NAME}_DRIVER_CPP_SOURCES "${CMAKE_CURRENT_LIST_DIR}/*.cpp")

file(GLOB ${PROJECT_NAME}_DRIVER_C_SOURCES "${CMAKE_CURRENT_LIST_DIR}/*.c")

target_sources(
  ${PROJECT_NAME}
  PRIVATE ${${PROJECT_NAME}_DRIVER_CPP_SOURCES}
  PRIVATE ${${PROJECT_NAME}_DRIVER_C_SOURCES})

target_include_directories(${PROJECT_NAME} PUBLIC ${CMAKE_CURRENT_LIST_DIR})
```

The project supplies the vendor SDK's include paths and compile options to the `xr` target; the HPM5301 template, for example, passes the SDK compile options to `xr` in `cmake/LibXR.CMake`.

A driver directory provides at least the timebase. The timebase class derives from `LibXR::Timebase`; its constructor calls `ConfigureWrapRange()` to set the wrap range of the timestamps and then `SetReady()`, and the static functions `Timebase::GetMicroseconds()` and `Timebase::GetMilliseconds()` are implemented in the same source file. Excerpt from `driver/hpm/hpm_timebase.cpp`:

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

// ... (Timebase::GetMilliseconds() is written the same way)
```

Other peripherals are implemented as needed; each peripheral class derives from an abstract class in `src/driver/`, and `driver/hpm/` contains `HPMGPIO`, `HPMI2C` and `HPMPWM`. The abstract interfaces are described in [Device Drivers](../basic_coding/driver/README.md). For peripherals that go through `ReadPort` / `WritePort`, such as a UART, the interface between driver and port is in [I/O Completion Semantics and Port State Machines](./core/rw_semantics.md) and the overall structure of `STM32UART` is in [UART Driver Design](./driver/uart_driver.md); for transfers that take an `Operation` directly, such as SPI and I2C, the `BLOCK` wait is described in [BLOCK Timeout and Completion Handoff](./driver/block_timeout_semantics.md).

## 4. Using it in a project

Before `add_subdirectory(libxr)`, the project sets the two variables to the names of the new directories:

```cmake
set(LIBXR_SYSTEM none CACHE STRING "" FORCE)
set(LIBXR_DRIVER hpm CACHE STRING "" FORCE)
add_subdirectory(libxr)
```

The startup code constructs the timebase object first, then calls `LibXR::PlatformInit()`, and only then uses threads, timers and peripheral objects.
