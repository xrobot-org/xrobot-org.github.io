---
id: mutex
title: 互斥锁
sidebar_position: 4
---

# Mutex（互斥锁）

`LibXR::Mutex` 提供轻量级、跨平台的 **线程互斥** 机制，用于保护多任务环境中的临界区。当前支持 **POSIX pthread** 与 **FreeRTOS/ThreadX** 实现；在 `none / webasm` 这类无线程路径里，当前实现会退化为围绕标量句柄的最小 busy-wait 锁，并在等待期间周期调用 `Timer::RefreshTimerInIdle()`。

> **⚠️ 注意**：互斥锁 **只能** 在任务（线程）上下文调用，**不支持** 在中断服务程序（ISR）中加/解锁。

## 设计要点

| 目标 | 说明 |
| ---- | ---- |
| **跨平台** | 隐藏 `pthread_mutex`, `xSemaphoreHandle`, `TX_MUTEX` 等差异。|
| **RAII 友好** | 内置 `LockGuard`，避免忘记 Unlock。|
| **RTOS 互斥语义** | 当前 FreeRTOS 路径使用带优先级继承的内核互斥量，而当前 ThreadX 路径明确以 `TX_NO_INHERIT` 创建。|
| **轻量低开销** | 调用路径贴近底层系统调用。|

## 核心接口

```cpp
class Mutex {
public:
  Mutex();
  ~Mutex();

  ErrorCode Lock();     // 阻塞加锁
  [[nodiscard]] ErrorCode TryLock();  // 非阻塞尝试
  void Unlock();        // 解锁

  class LockGuard {
  public:
    LockGuard(Mutex& mutex);
    ~LockGuard();
  };
};
```

`Lock()` 成功返回 `OK`；底层加锁失败时，Linux、ThreadX 返回 `FAILED`，FreeRTOS、Webots 返回 `BUSY`。`TryLock()` 在锁已被占用时返回 `BUSY`。

## 使用示例

```cpp
LibXR::Mutex m;
int shared = 0;

void Worker()
{
  LibXR::Mutex::LockGuard lock(m);  // 构造时加锁
  shared++;                         // 安全访问
}                                    // 析构时自动解锁
```
