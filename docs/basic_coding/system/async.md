---
id: async
title: 异步任务
sidebar_position: 6
---

# ASync（异步任务）

`LibXR::ASync` 为耗时操作提供单任务异步执行：有线程的后端使用一个工作线程和信号量，无线程后端使用 `Timer` 定时任务。任务或中断回调提交 `Job` 后，由后台执行并更新状态；每个实例一次只接收一个任务。

> **典型应用**：SPI 采样结束中断后触发 FFT 计算；主循环内提交 OTA 校验；GPIO ISR 内上报事件至云端等。

## 设计要点

| 目标             | 说明                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **单任务执行** | 有线程的后端中，每个实例创建 1 个工作线程，通过 `Semaphore` 唤醒执行 `Job`。 |
| **ISR 安全提交** | `AssignJobFromCallback()` 可在中断/回调环境调用，采用 `Semaphore::PostFromCallback()` 安全唤醒线程。 |
| **状态可查询** | `GetStatus()` 返回 `READY/BUSY/DONE`；读到 `DONE` 时状态复位为 `READY`，之后才能提交下一个任务。 |
| **依赖可裁剪** | 有线程时依赖 `Thread` 与 `Semaphore`；无线程后端由 `Timer` 定时任务执行。 |
| **回调接口** | 任务类型为 `Callback<ASync*>`，由 `Job::Create()` 创建（创建时分配回调块）。 |

## 核心接口

```cpp
class ASync {
public:
  enum class Status : uint32_t { READY = 0, BUSY = 1, DONE = UINT32_MAX };

  ASync(size_t stack_depth, Thread::Priority priority);

  using Job = LibXR::Callback<ASync*>;
  ErrorCode AssignJob(Job job);                       // 任务上下文提交
  ErrorCode  AssignJobFromCallback(Job job, bool in_isr); // ISR/回调上下文提交
  Status     GetStatus();                             // 查询状态；读到 DONE 时复位为 READY
};
```

`Job` 的创建方式见[通用回调](../core/core-cb.md)。

### 错误码

* `ErrorCode::OK`      提交成功
* `ErrorCode::BUSY`    上一个任务尚未执行完，或已完成但 `DONE` 尚未被 `GetStatus()` 读取

任务回调收到的 `in_isr` 总为 `false`。

## 使用示例

```cpp
#include <libxr.hpp>

LibXR::ASync async_worker(2048, LibXR::Thread::Priority::MEDIUM);

void HeavyCalc(bool, int *, LibXR::ASync*)
{
  DoFFT();   // 耗时 5‑10 ms
}

int arg = 0;
auto async_job = LibXR::ASync::Job::Create(HeavyCalc, &arg);

void SensorISR()
{
  // 采样完成后在中断中提交计算任务
  async_worker.AssignJobFromCallback(async_job, true);
}

void Loop()
{
  // ...

  if (async_worker.GetStatus()==LibXR::ASync::Status::DONE) {
    PublishResult();
  }

  // ...
}
```

## 平台适配

有线程的后端中，`ASync` 依赖以下模块：

| 功能     | 依赖                            |
| -------- | ------------------------------- |
| 线程创建 | `Thread::Create()`              |
| 任务唤醒 | `Semaphore::Post/Wait`          |
| ISR 兼容 | `Semaphore::PostFromCallback()` |

在 none、webasm 等无线程后端上，`ASync` 不创建工作线程，构造时注册一个周期 1 ms 的 `Timer` 任务。提交只登记任务，任务在之后的定时器刷新中执行；刷新由 `Thread::Sleep`、`Mutex`、`Semaphore` 等等待路径推进。任务执行期间，其他定时任务被推迟。

设计理念中Callback不允许阻塞/延时，但是此处复用了Callback的接口与数据结构，为防止混淆重命名为`Job`。
