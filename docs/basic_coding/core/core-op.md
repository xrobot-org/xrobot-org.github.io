---
id: core-op
title: Operation 操作模型
sidebar_position: 9
---

# Operation 操作模型

本模块定义通用的 `Operation<T>` 模板类，用于描述具有完成反馈机制的异步操作。支持回调（Callback）、阻塞（Block）、轮询（Polling）三种模式，适用于嵌入式 I/O 操作中的统一完成处理。

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
enum class OperationPollingStatus : uint8_t {
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

另外，`Operation` 支持从另一个 `Operation` 实例初始化（复制/移动语义等价于赋值）。

## 状态更新

```cpp
template <typename Status>
void UpdateStatus(bool in_isr, Status&& status);

void MarkAsRunning();
```

- `UpdateStatus(...)` 会根据操作类型触发回调、解除阻塞或更新轮询状态：
  - CALLBACK：调用 `cb.Run(in_isr, status)`，其中 `status` 作为 `T` 类型的完成状态传递给回调。
  - BLOCK：调用信号量的 `PostFromCallback(in_isr)` 解除阻塞等待；当前完成值本身不会通过 `Operation` 内部保存给阻塞等待者，具体最终 `ErrorCode` 由拥有该 `Operation` 的端口侧 handoff 状态保存。
  - POLLING：当前实现直接按 `status == ErrorCode::OK` 判断成功并置为 `DONE`，否则置为 `ERROR`。因此这条路径在当前主线里实际上是面向 `Operation<ErrorCode>` 使用最自然的；若把它推广到其它 `T`，并不能自动得到一套独立于 `ErrorCode` 的通用成功判定语义。
- `MarkAsRunning()` 在 POLLING 模式下设置状态为 `RUNNING`。
- 这两个函数通常由驱动/端口在合适的时机调用；用户侧只需选择合适的 `OperationType` 并传入即可。


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
if (status.load(std::memory_order_acquire) ==
    LibXR::ReadOperation::OperationPollingStatus::DONE) {
  // 成功完成
} else if (status.load(std::memory_order_acquire) ==
           LibXR::ReadOperation::OperationPollingStatus::ERROR) {
  // 完成但发生错误
}
```

---

`Operation` 是 LibXR I/O 操作的基础机制，适用于串口、网络、定时器等模块，统一管理完成行为，确保线程与中断上下文均安全。

## 当前主线中的补充角色：`AsyncBlockWait`

在 `operation.hpp` 中，`Operation<T>` 之外还定义了一个当前主线内部使用的辅助类：

```cpp
class AsyncBlockWait;
```

它的职责不是替代 `Operation`，而是为同步驱动路径提供一个共享的 BLOCK waiter handoff：

- `Start(Semaphore&)`
- `Wait(timeout)`
- `TryPost(in_isr, ErrorCode)`
- `Cancel()`

当前语义要点：

- 超时等待者会与后续迟到完成脱钩（detached）；
- 迟到完成仍然可以把内部 in-flight 状态清干净，但结果不再属于那个已经超时返回的调用方。

这也是为什么上文 BLOCK 路径只强调“信号量唤醒”，而不把最终错误码归因到 `Operation` 自身内部存储。
