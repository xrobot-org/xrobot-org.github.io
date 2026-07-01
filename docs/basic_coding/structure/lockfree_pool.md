---
id: lockfree_pool
title: 无锁无序槽池
sidebar_position: 8
---

# LockFreePool

`LibXR::LockFreePool<Data>` 实现了一个**固定容量、无序（unordered）**的无锁对象/数据槽池。支持多线程（或中断上下文）并发 `Put` 与 `Get`，每个槽独立管理，无严格入/出顺序，适合高并发、低延迟的缓存与对象复用场景。

## 类结构与原理

- 槽池由 `SLOT_COUNT` 个槽组成，每个槽为 cache line 对齐的 `Slot` 联合体，包含：
  - `std::atomic<SlotState> state`：槽状态机（`FREE → BUSY → READY → RECYCLE`）。
  - `Data data`：槽内实际数据。
- 通过 `compare_exchange_strong` 与 C++11 原子内存序（acquire/release/relaxed）实现无锁并发，保证可见性与有界时序。
- 操作粒度为“单槽”，不同槽之间互不阻塞，冲突仅在同一槽上局部化。
- `Put/Get` 可选择**起始槽索引**（`start_index`），用于分散热点并减少线性探测开销。

## 接口函数

### 构造与销毁

- `LockFreePool(uint32_t slot_count)`
- `~LockFreePool()`

### 写入（Put）

- `ErrorCode Put(const Data& data)`
- `ErrorCode Put(const Data& data, uint32_t& start_index)`
- `ErrorCode PutToSlot(const Data& data, uint32_t index)`

### 读取（Get）

- `ErrorCode Get(Data& data)`
- `ErrorCode Get(Data& data, uint32_t& start_index)`
- `ErrorCode GetFromSlot(Data& data, uint32_t index)`

### 回收

- `ErrorCode RecycleSlot(uint32_t index)`

### 查询/工具

- `size_t Size() const`：当前 `READY` 槽数量
- `size_t EmptySize()`：当前可写槽数量（`FREE` 或 `RECYCLE`）
- `uint32_t SlotCount() const`：槽总数

> 返回码约定：
>
> - `ErrorCode::OK`：成功
> - `ErrorCode::FULL`：无可写槽
> - `ErrorCode::EMPTY`：无可读槽

## 说明

- 当前 `Put(const Data&, uint32_t& start_index)` / `Get(Data&, uint32_t& start_index)` 都只从给定起始槽位向后线性扫描；若想重新从头找，需要调用方自己把 `start_index` 重新置回 `0`。
- `RecycleSlot(index)` 当前只在槽状态为 `READY` 时成功；如果槽位已经被 `Get*()` 取走并进入 `RECYCLE`，再次调用 `RecycleSlot()` 不会成功。
- 这类池的核心语义是“无序 slot state machine”，不是 FIFO 队列；因此不应把它当成顺序传输或顺序公平性的抽象。

## 使用示例

### 基本存取

```cpp
LibXR::LockFreePool<int> pool(64);

// 写入
if (pool.Put(42) == LibXR::ErrorCode::OK) {
  // 写入成功
}

// 读取
int value = 0;
if (pool.Get(value) == LibXR::ErrorCode::OK) {
  // 使用 value
}
```
