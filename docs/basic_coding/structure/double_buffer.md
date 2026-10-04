---
id: double_buffer
title: 双缓冲区
sidebar_position: 9
---

# 双缓冲区（DoubleBuffer）

`LibXR::DoubleBuffer` 是一个嵌入式场景下的双缓冲状态管理器，主要用于 DMA、USB 等高速传输中两块半区的切换与填充控制。它负责管理 active/pending 两半缓冲区以及对应状态位，本身不负责申请或释放 backing storage。

## 核心特性

- 将一块连续内存对半切分为两个缓冲区。
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
- `raw_data` 的地址须按 `alignof(size_t)` 对齐，大小须为 `2 * alignof(size_t)` 的整数倍，否则 Debug 构建断言失败；空双缓冲允许传入 `nullptr + 0`。
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

- `FillPending()` 写入 pending 半区并记录其长度。
- `FillActive()` 只写入 active 半区字节，不更新 active 长度；上层需要长度时调用 `SetActiveLength()`。
- `EnablePending()` 只把 pending 标记为有效，不设置 pending 长度。

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
- 类本身不做动态分配；存储由调用方准备，可以是静态数组或调用方管理的动态内存，需满足上述对齐和大小要求。
- pending 已有效时 `FillPending()` 不写入并返回 `false`；pending 无效时 `GetPendingLength()` 返回 0。
- `EnablePending()` 只改 pending 状态位，不会复制数据，也不会自动同步长度字段。

## 应用场景

- USB CDC / UART 数据发送
- DMA 数据流优化
- 双缓存 ping-pong 通信机制
