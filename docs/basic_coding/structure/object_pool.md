---
id: object_pool
title: RAII 对象池
sidebar_position: 7
---

# ObjectPool

`object_pool.hpp` 提供带引用计数的固定槽对象池：

```cpp
LibXR::ObjectPool<Data>
```

槽位数量在构造时确定。写独占、读共享：`Acquire()` 得到一个只能移动的可写 `Handle`，写完数据后移动为可复制的只读 `ConstHandle` 分发出去，最后一个引用释放时槽位回到空闲栈。

---

## 1. 设计要点

### 1.1 槽位与负载

槽位类型是 `ObjectPool<Data>::Slot`，由引用计数、空闲栈链接和常驻负载组成：

- 负载随池构造、随池析构；引用释放时既不析构也不清空槽内对象，下一个申请方直接写入自己的数据；
- 用内部槽数组构造的池要求 `Data` 可默认构造；外部槽数组由调用方准备，`Slot` 另有 `Slot(std::in_place, args...)` 用于就地构造负载；
- 槽数组在构造时确定，其后的申请与释放不再分配内存。

### 1.2 可写句柄与只读句柄

`Handle` 独占一个槽位，只能移动：

- 析构时释放槽位，`Reset()` 可以提前释放；
- `Get()`、`operator->()`、`operator*()` 访问槽内负载，`Index()` 返回槽位索引，`Valid()` 判断是否持有槽位；
- 禁止拷贝，避免同一个槽位被多个可写句柄持有。

`ConstHandle` 共享一个槽位，可以复制：由 `Handle` 移动得到，或由另一个 `ConstHandle` 复制得到。复制增加引用，析构减少引用，最后一个引用释放时槽位回到空闲栈。它只提供负载的只读访问。

### 1.3 并发约束

同一池同一时刻只能有一个申请方，申请不得重叠或重入，Debug 构建会检查；重叠申请会让空闲栈出现 ABA，把同一个槽位交给两个申请方。释放可以在任意线程或 ISR 中并发进行，这条路径没有失败分支。不同句柄对象可以并发使用，同一句柄对象的并发访问须由调用方同步。构造和析构须在静止状态下进行，不能在 ISR 中执行；池与外部槽存储必须比全部句柄活得更久。在 ISR 中使用要求目标平台提供 32 位原子 CAS。

---

## 2. 构造方式

```cpp
explicit ObjectPool(size_t slot_count);
ObjectPool(size_t slot_count, Slot* slots);
```

- `ObjectPool(slot_count)`：槽数组由池分配，要求 `Data` 可默认构造；
- `ObjectPool(slot_count, slots)`：槽数组由调用方提供，池既不构造也不析构其中的负载，`slots` 须指向至少 `slot_count` 个未被其他池使用的槽。

池不可拷贝、不可移动。

---

## 3. 主要接口

### 3.1 获取与释放

- `ErrorCode Acquire(Handle& handle)`
- `void Handle::Reset()`
- `void ConstHandle::Reset()`

行为要点：

- 成功时返回 `ErrorCode::OK`，没有空闲槽位时返回 `ErrorCode::EMPTY`，不等待；
- `Acquire()` 要求传入的 `handle` 未持有槽位（Debug 构建下断言）；
- 池析构前所有句柄必须已释放（Debug 构建下断言 `EmptySize() == Size()`）。

### 3.2 容量查询

- `size_t EmptySize() const`：当前的空闲槽位数，有并发申请或释放时为近似值，只用于监控；
- `size_t Size() const`：槽位总数。

### 3.3 非所有权访问

- `Data& UnsafeAt(size_t index)`
- `const Data& UnsafeAt(size_t index) const`

这两个接口会绕过 `Acquire()` / `Handle` 的所有权语义，只适合调试、检查外部存储区，或调用方明确知道槽位状态的场景。

### 3.4 引用计数上限

每个槽位的引用数不得超过 `UINT32_MAX`。

---

## 4. 使用示例

```cpp
#include <libxr.hpp>

struct Packet
{
  uint32_t id = 0;
  uint8_t payload[32] = {};
};

LibXR::ObjectPool<Packet> pool(16);

LibXR::ObjectPool<Packet>::Handle writer;
if (pool.Acquire(writer) == LibXR::ErrorCode::OK)
{
  writer->id = 42;
  (*writer).payload[0] = 0xAA;

  // 写完数据后移动为只读句柄分发，writer 变空
  LibXR::ObjectPool<Packet>::ConstHandle frame = std::move(writer);
  LibXR::ObjectPool<Packet>::ConstHandle copy = frame;
}
// frame 与 copy 离开作用域后释放引用，最后一个引用归还槽位
```

引用可以提前释放：`Handle::Reset()` 直接归还槽位，`ConstHandle::Reset()` 减少一次引用。

```cpp
frame.Reset();
```

---

## 5. 典型场景

采集与处理分离：采集端（一个中断或一个线程）用 `Acquire()` 取得槽位并写入一帧数据，再把只读句柄交给处理线程。处理线程可以把同一份数据再分发给多个下游，最后一个引用释放时槽位自动回到空闲栈。空闲槽位用完时 `Acquire()` 返回 `ErrorCode::EMPTY`，采集端不等待，槽位总数即同时在途的帧数上限。
