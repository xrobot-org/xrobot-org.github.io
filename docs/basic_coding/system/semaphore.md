---
id: semaphore
title: 信号量
sidebar_position: 5
---

# Semaphore（信号量）

`LibXR::Semaphore` 提供**计数型信号量**以协调多任务/ISR 对共享资源的访问，支持线程上下文的阻塞等待 (`Wait`) 和中断安全的释放 (`PostFromCallback`)。当前实现覆盖基于 **Linux futex** 的主机路径、**FreeRTOS Counting Semaphore**、**ThreadX TX\_SEMAPHORE**，以及 `none / webasm` 这类基于标量计数与 `Timer::RefreshTimerInIdle()` 轮询等待的实现。

## 设计要点

| 目标         | 说明                                                                    |
| ---------- | --------------------------------------------------------------------- |
| **跨平台**    | 隐藏 Linux futex wait/wake、`SemaphoreHandle_t`、`TX_SEMAPHORE` 等差异。 |
| **ISR 友好** | 提供 `PostFromCallback(bool in_isr)`，在中断或 DMA 回调内安全释放并触发任务切换。           |
| **超时等待**   | `Wait(timeout_ms)` 支持毫秒级超时。                      |
| **轻量裁剪**   | 依赖 C++20 与可选的 RTOS 头文件。 |
| **可观测性**   | `Value()` 返回当前计数，方便调试与性能分析。                                           |

## 核心接口

```cpp
class Semaphore {
public:
  Semaphore(uint32_t init_count = 0);
  ~Semaphore();

  void     Post();                    // 线程上下文释放
  void     PostFromCallback(bool in_isr);// 中断/回调上下文释放
  ErrorCode Wait(uint32_t timeout=UINT32_MAX); // 阻塞等待
  size_t   Value();                   // 当前计数
};
```

### 错误码

* `ErrorCode::OK`       操作成功
* `ErrorCode::TIMEOUT` 等待超时
* `ErrorCode::FAILED`  底层等待出错（Linux、ThreadX）

> **⚠️ 注意**：`Wait()` **不能** 在 ISR 中调用。
