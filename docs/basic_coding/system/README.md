---
id: system-coding
title: 操作系统
sidebar_position: 4
---

# 操作系统

本章介绍 LibXR 对线程、同步原语和定时器的统一接口，后端有 Linux、FreeRTOS、ThreadX、Webots、WebAssembly 和无操作系统（none）。

## 目录

- [Thread（线程）](./thread.md)
- [Mutex（互斥锁）](./mutex.md)
- [Semaphore（信号量）](./semaphore.md)
- [Async（异步任务）](./async.md)
- [Timer（定时器）](./timer.md)

各后端的实现方式不同（例如优先级继承、无线程后端的轮询等待和线程直调），具体行为见各页面。

## 平台初始化

`LibXR::PlatformInit()` 由系统层提供，程序在使用 LibXR 的其他功能之前调用一次。它记录 `Timer` 管理线程的优先级和栈深度，并完成所在后端需要的初始化。各后端的签名和行为如下：

| 后端 | 签名 | 行为 |
| --- | --- | --- |
| freertos、threadx | `PlatformInit(uint32_t timer_pri = 2, uint32_t timer_stack_depth = 512)` | 调用前须已构造平台的时间基准对象（如 `STM32TimerTimebase`），否则触发 `ASSERT` |
| linux | `PlatformInit(uint32_t timer_pri = 2, uint32_t timer_stack_depth = 65536)` | 创建 `STDIO::read_`、`STDIO::write_` 及读写它们的两个线程；标准输入是终端时关闭行缓冲和回显 |
| webots | `PlatformInit(webots::Robot* robot = nullptr, uint32_t timer_pri = 2, uint32_t timer_stack_depth = 65536, double sim_flow_rate = 1.0)` | 构造 Webots 时间基准，按 linux 的方式创建 STDIO，并创建推进仿真的线程，每隔 `basicTimeStep / sim_flow_rate` 毫秒的实际时间推进一步；`robot` 为空时创建 `webots::Robot` |
| webasm | `PlatformInit()` | 构造 WebAssembly 时间基准，创建 `STDIO::read_` 和 `STDIO::write_` |
| none | `PlatformInit()` | 不执行任何操作 |

linux 后端的时间基准在程序启动时创建，freertos、threadx 和 none 使用板级代码构造的时间基准（见 [Timebase](../driver/timebase.md)）。

`timer_pri` 按 `static_cast<Thread::Priority>(timer_pri)` 转换为线程优先级，而 `Thread::Priority` 各等级的数值随后端变化，例如 FreeRTOS 上 `MEDIUM` 等于 `2 × LIBXR_PRIORITY_STEP`。因此按等级传入时写成 `static_cast<uint32_t>(...)`。以下节选自代码生成器为 STM32 FreeRTOS 工程生成的 `app_main()`：

```cpp
static STM32TimerTimebase timebase(&htim3);
PlatformInit(static_cast<uint32_t>(Thread::Priority::MEDIUM), 1024);
```

## 移植

在新的操作系统或芯片上使用 LibXR 时，需要新增系统层目录或外设驱动目录，见 [平台移植](../../adv_coding/porting.md)。
