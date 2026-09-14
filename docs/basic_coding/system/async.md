---
id: async
title: 异步任务
sidebar_position: 6
---

# ASync（异步任务）

`LibXR::ASync` 提供单任务异步提交接口。有线程的平台通过专用工作线程和信号量执行 `Job`；无线程平台把任务挂到软件 `Timer`，在后续刷新中执行。一个实例同一时刻只接受一个任务。

> **典型应用**：SPI 采样结束中断后触发 FFT 计算；主循环内提交 OTA 校验；GPIO ISR 内上报事件至云端等。

## 设计要点

| 目标             | 说明                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **线程独占执行** | 每个 `ASync` 实例内部创建 1 个工作线程，通过 `Semaphore` 唤醒执行 `Job`，避免任务间竞态。            |
| **ISR 安全提交** | `AssignJobFromCallback()` 可在中断/回调环境调用，采用 `Semaphore::PostFromCallback()` 安全唤醒线程。 |
| **状态可查询**   | `GetStatus()` 返回 `READY/BUSY/DONE`，任务完成后自动复位，可用于轮询或超时检测。                     |
| **依赖可裁剪**   | 有线程时依赖 `Thread` / `Semaphore`；裸机使用软件 `Timer` 延后执行。     |
| **极简接口**     | 不引入模板队列或动态分配，接口面向回调 `Callback<ASync*>`，易于绑定成员函数或自由函数。              |

## 核心接口

```cpp
class ASync {
public:
  enum class Status : uint32_t { READY = 0, BUSY = 1, DONE = UINT32_MAX };

  ASync(size_t stack_depth, Thread::Priority priority);

  using Job = LibXR::Callback<ASync*>;
  ErrorCode AssignJob(Job job);                       // 任务上下文提交
  ErrorCode  AssignJobFromCallback(Job job, bool in_isr);// ISR/回调上下文提交
  Status     GetStatus();                             // 查询状态并自动复位
};
```

### 错误码

* `ErrorCode::OK`      提交成功
* `ErrorCode::BUSY`    已有任务在执行

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

`ASync` 本身不依赖特定 OS，所有平台差异已由 `Thread` 与 `Semaphore` 层吸收：

| 功能     | 依赖模块                        |
| -------- | ------------------------------- |
| 线程创建 | `Thread::Create()`              |
| 任务唤醒 | `Semaphore::Post/Wait`          |
| ISR 兼容 | `Semaphore::PostFromCallback()` |

在裸机等无线程实现里，`AssignJob()` 只把任务标记为 pending；构造时注册的 1 ms 软件 `Timer` 在后续刷新中调用任务。它没有独立线程，因此长任务会占用 Timer 刷新上下文。

设计理念中Callback不允许阻塞/延时，但是此处复用了Callback的接口与数据结构，为防止混淆重命名为`Job`。
