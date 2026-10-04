---
id: object_pool
title: RAII 对象池
sidebar_position: 7
---

# ObjectPool

`object_pool.hpp` 提供一组基于空闲索引队列的 RAII 槽池接口，核心模板为：

```cpp
LibXR::BasicObjectPool<Data, FreeQueue>
```

以及三个别名：

- `LibXR::ObjectPool<Data, IndexType>`：底层使用 `Queue<IndexType>`
- `LibXR::SPSCObjectPool<Data, IndexType>`：底层使用 `SPSCQueue<IndexType>`
- `LibXR::MPMCObjectPool<Data, IndexType>`：底层使用 `MPMCQueue<IndexType>`

这一组对象池的特点是：

- 通过 `Acquire()` 获取一个独占槽位；
- 通过 move-only `Handle` 在析构时自动归还槽位；
- 上层直接在槽位对象上原地构造和修改业务数据。

---

## 1. 设计要点

### 1.1 最小队列约束 `PoolIndexQueue`

`BasicObjectPool` 不依赖某一个具体队列类型，而是要求底层空闲索引队列满足最小强类型接口：

- `ValueType`
- `Push(const ValueType&)`
- `Pop(ValueType&)`
- `Size()`

因此普通 `Queue`、`SPSCQueue`、`MPMCQueue` 都可以作为空闲索引队列。

### 1.2 Move-only `Handle`

成功获取槽位后，对象池不会直接返回裸指针，而是返回一个 move-only `Handle`：

- `Handle` 析构时会自动把槽位索引归还给对象池；
- 禁止拷贝，避免同一个槽位被多个句柄同时持有；
- 支持 `Get()`、`operator->()`、`operator*()` 访问槽内对象；
- 支持 `Index()` 查询当前槽位索引；
- 支持 `Reset()` 主动提前归还；
- 支持 `Valid()` 判断句柄是否持有槽位。

这也是“RAII 对象池”这个名称的来源。

---

## 2. 构造方式

`BasicObjectPool` 支持四类构造方式：

1. 内部 queue + 内部 slots
2. 内部 queue + 外部 slots
3. 外部 queue + 内部 slots
4. 外部 queue + 外部 slots

选择含义：

- 槽位和队列都由对象池分配：使用内部 queue / 内部 slots。
- 需要把槽位放在调用方控制的存储区：使用外部 `slots`。
- 需要复用已有队列实现或精确控制队列行为：使用外部 `free_queue`。

使用外部 `free_queue` 时：

- 队列在传入时必须为空；
- 队列只供当前 pool 独占使用；
- 队列容量至少能容纳 `slot_count` 个索引。

此外，使用内部 slots 的构造要求 `Data` 可默认构造；`IndexType` 须为无符号整数类型。

---

## 3. 主要接口

### 3.1 获取与归还

- `ErrorCode Acquire(Handle& handle)`
- `void Handle::Reset()`

行为要点：

- 成功时返回 `ErrorCode::OK`；
- 无空闲槽位时返回底层队列的弹出失败结果，当前常见表现为 `ErrorCode::EMPTY`；
- `Handle` 析构时会自动归还槽位，不必手工把索引放回队列；
- `Acquire()` 要求传入的 `handle` 未持有槽位（Debug 构建下断言）；
- 对象池析构前所有 `Handle` 必须已归还（Debug 构建下断言 `EmptySize() == Size()`），因此 pool 须比 handle 后析构。

### 3.2 容量查询

- `size_t EmptySize() const`：当前仍可获取的空闲槽位数
- `size_t Size() const`：对象池总槽位数

### 3.3 非所有权访问

- `Data& UnsafeAt(size_t index)`
- `const Data& UnsafeAt(size_t index) const`

这两个接口会绕过 `Acquire()` / `Handle` 的所有权语义，只适合调试、检查外部存储区，或调用方明确知道槽位状态的场景。

---

## 4. 三个常用别名

### 4.1 `ObjectPool`

```cpp
template <typename Data, typename IndexType = uint32_t>
using ObjectPool = BasicObjectPool<Data, Queue<IndexType>>;
```

适合普通线程上下文中、对锁自由度没有额外要求的通用对象池场景。

### 4.2 `SPSCObjectPool`

```cpp
template <typename Data, typename IndexType = uint32_t>
using SPSCObjectPool = BasicObjectPool<Data, SPSCQueue<IndexType>>;
```

适合明确是单生产者 / 单消费者的空闲槽位管理路径。

### 4.3 `MPMCObjectPool`

```cpp
template <typename Data, typename IndexType = uint32_t>
using MPMCObjectPool = BasicObjectPool<Data, MPMCQueue<IndexType>>;
```

适合多生产者 / 多消费者并发获取与归还槽位的场景。

---

## 5. 使用示例

```cpp
#include <libxr.hpp>

struct Packet
{
  uint32_t id = 0;
  uint8_t payload[32] = {};
};

LibXR::ObjectPool<Packet> pool(16);

LibXR::ObjectPool<Packet>::Handle handle;
if (pool.Acquire(handle) == LibXR::ErrorCode::OK)
{
  handle->id = 42;
  (*handle).payload[0] = 0xAA;
}
// handle 离开作用域后自动归还槽位
```

如果需要提前归还：

```cpp
handle.Reset();
```
