---
id: double_buffer
title: 双缓冲区
sidebar_position: 8
---

# 双缓冲区（DoubleBuffer）

`LibXR::DoubleBuffer` 是一个嵌入式场景下的双缓冲状态管理器，主要用于 DMA、USB 等高速传输中两块半区的切换与填充控制。它负责管理 active/pending 两半缓冲区以及对应状态位，本身不负责申请或释放 backing storage。

## 核心特性

- 将一块连续内存按当前实现要求对半切分为两个缓冲区。
- 支持主动缓冲（active）与备用缓冲（pending）之间切换。
- 提供对两个缓冲区的直接访问与数据填充接口。
- 支持默认构造后再通过 `Init()` 绑定 backing storage。
- 可查询 pending 状态与 active/pending 的辅助长度字段。

## 接口概览

### 构造与初始化

```cpp
DoubleBuffer() = default;
explicit DoubleBuffer(const LibXR::RawData& raw_data);
void Init(const LibXR::RawData& raw_data);
void Reset();
```

- `DoubleBuffer(raw_data)` 与 `Init(raw_data)` 走同一套初始化路径。
- `raw_data` 需要满足当前实现的对半切分约束；空双缓冲允许传入 `nullptr + 0`。
- `Reset()` 只清运行时状态，不解绑已绑定的两半缓冲区。

### 数据操作接口

- `uint8_t* ActiveBuffer()`：获取当前使用的缓冲区。
- `uint8_t* PendingBuffer()`：获取备用缓冲区。
- `uint8_t* Buffer(int block)`：按固定编号访问第 `0/1` 半区。
- `bool FillActive(const uint8_t* data, size_t len)`：写入当前缓冲区。
- `bool FillPending(const uint8_t* data, size_t len)`：写入备用缓冲区。
- `void EnablePending()`：手动把当前 pending 状态位置为有效；该接口**不复制数据，也不切换 active block**。
- `bool HasPending() const`：是否存在准备切换的缓冲区。
- `void Switch()`：若 pending 有效，则切换 active block 并清掉 pending 有效位。
- `size_t GetPendingLength() const`：获取备用缓冲中的有效数据长度。
- `size_t GetActiveLength() const`：获取 active 缓冲的辅助长度字段。
- `void SetPendingLength(size_t length)`：设置备用缓冲的辅助长度字段。
- `void SetActiveLength(size_t length)`：设置 active 缓冲的辅助长度字段。
- `int ActiveBlock() const` / `void SetActiveBlock(bool)` / `void FlipActiveBlock()`：直接控制 active block 编号。
- `size_t Size() const`：每个缓冲区的容量。

补充说明：

- `FillPending()` 在当前实现中会同时写入 pending 半区并更新 `pending_len_`。
- `FillActive()` 只写入 active 半区字节，不会自动更新 `active_len_`；如果上层还要读取长度信息，需要自行配合 `SetActiveLength()`。
- `EnablePending()` 只改变 `pending_valid_`，不会自动设置 `pending_len_`。

## 使用示例

```cpp
alignas(size_t) uint8_t mem[512] = {};
LibXR::RawData raw(mem, sizeof(mem));
LibXR::DoubleBuffer buf;
buf.Init(raw);

// 把数据写入当前 pending 半区，并标记为可切换
buf.FillPending(data1, len1);
if (buf.HasPending()) {
    buf.Switch();  // 切换为新的 active 缓冲
}
```

如果上层是“自己写半区字节，再手动宣布 pending 有效”的模式，则通常要显式补长度字段：

```cpp
std::memcpy(buf.PendingBuffer(), data2, len2);
buf.SetPendingLength(len2);
buf.EnablePending();
```

## 注意事项

- 填充备用区后需调用 `Switch()` 才能激活其数据。
- 当前类本身不做动态分配；backing storage 由调用方准备，既可以是静态数组，也可以是调用方自行管理的动态内存，只要满足当前实现的对齐和大小约束。
- `FillPending` 不可重入，调用前应确认 pending 状态为 false。
- `EnablePending()` 只改 pending 状态位，不会复制数据，也不会自动同步长度字段。

## 应用场景

- USB CDC / UART 数据发送
- DMA 数据流优化
- 双缓存 ping-pong 通信机制
