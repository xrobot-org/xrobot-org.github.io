---
id: core-op
title: Operation 操作模型
sidebar_position: 11
---

# Operation 操作模型

`operation.hpp` 定义通用的 `Operation<T>` 模板类，描述一次异步操作完成后如何通知调用方，支持回调（CALLBACK）、阻塞（BLOCK）、轮询（POLLING）三种方式。

其中 `ReadOperation` / `WriteOperation` 是对 `Operation<ErrorCode>` 的别名，用于 I/O 完成时回传 `ErrorCode`。

## 操作模式

### OperationType

```cpp
enum class OperationType : uint8_t {
  CALLBACK,  // 使用回调函数处理完成事件
  BLOCK,     // 使用信号量阻塞等待
  POLLING,   // 轮询状态变量
  NONE       // 不处理完成
};
```

### POLLING 状态枚举

```cpp
enum class OperationPollingStatus : uint32_t {
  READY,
  RUNNING,
  DONE,
  ERROR
};
```

## 构造方式

```cpp
// 默认构造：类型为 NONE
Operation();

// 构造阻塞操作
Operation(Semaphore &sem, uint32_t timeout = UINT32_MAX);

// 构造回调操作（T 为回调参数类型）
Operation(Callback<T> &cb);

// 构造轮询操作
Operation(std::atomic<OperationPollingStatus> &status);
```

`Operation` 可复制和移动，副本引用同一个回调、信号量或轮询状态。

## 状态更新

```cpp
template <typename Status>
void UpdateStatus(bool in_isr, Status&& status);

void MarkAsRunning();
```

- `UpdateStatus(...)` 会根据操作类型触发回调、解除阻塞或更新轮询状态：
  - CALLBACK：调用 `cb.Run(in_isr, status)`，其中 `status` 作为 `T` 类型的完成状态传递给回调。
  - BLOCK：调用信号量的 `PostFromCallback(in_isr)` 唤醒等待者；最终的 `ErrorCode` 由端口保存，并作为阻塞调用的返回值。
  - POLLING：以 release 写入，`status == ErrorCode::OK` 时置为 `DONE`，否则置为 `ERROR`，因此适用于完成值为 `ErrorCode` 的 `Operation`。
- `MarkAsRunning()` 在 POLLING 模式下设置状态为 `RUNNING`。
- 这两个函数由端口或驱动调用，用户只需构造对应的 `Operation` 并传入。
- `Operation` 只借用回调、信号量或轮询状态，调用方保证它们在操作结束前有效。
- 一个信号量同时只服务一个 BLOCK 调用；BLOCK 只能在线程中调用。
- 回调在完成读写的上下文中同步执行，可能位于 ISR 内；轮询状态读取时使用 `load(std::memory_order_acquire)`。


## 示例用法

### 阻塞等待写入完成

```cpp
Semaphore sem;
WriteOperation op_block(sem, 100);
write_port(data, op_block);
```

### 回调方式读取完成反馈

```cpp
auto cb = Callback<ErrorCode>::Create([](bool in_isr, int context, ErrorCode ec) {
  // 回调处理逻辑
}, 123);  // 绑定 context 为 123

ReadOperation op_cb(cb);
read_port(buffer, op_cb);
```

### 轮询方式查询完成状态

```cpp
std::atomic<LibXR::ReadOperation::OperationPollingStatus> status{
    LibXR::ReadOperation::OperationPollingStatus::READY};
ReadOperation op_poll(status);
read_port(buffer, op_poll);

// 后续通过 status 查询是否完成
auto now = status.load(std::memory_order_acquire);
if (now == LibXR::ReadOperation::OperationPollingStatus::DONE) {
  // 成功完成
} else if (now == LibXR::ReadOperation::OperationPollingStatus::ERROR) {
  // 完成但发生错误
}
```

## `AsyncBlockWait`

`operation.hpp` 还定义驱动内部使用的 `AsyncBlockWait`，供不经过 `ReadPort` / `WritePort` 的驱动（如部分 SPI、I2C 驱动）实现 `BLOCK` 传输的等待与超时交接，见 [BLOCK 超时与完成交接](../../adv_coding/driver/block_timeout_semantics.md)。
