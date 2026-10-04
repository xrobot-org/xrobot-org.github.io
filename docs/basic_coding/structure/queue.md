---
id: queue
title: Queue
sidebar_position: 1
---

# Queue（普通 FIFO 队列）

`LibXR::Queue<T>` 是最基础的队列：普通固定容量 FIFO，不带并发同步，适合单线程或调用方已做好外部同步的场景。

公开的队列分为三类：

- `Queue<T>`：普通 FIFO；
- `SPSCQueue<T>`：单生产者单消费者无锁队列；
- `MPMCQueue<T>`：多生产者多消费者有界队列。

只需要单线程 FIFO 时使用 `Queue<T>`；有并发访问时按生产者和消费者数量选用 `SPSCQueue` 或 `MPMCQueue`。

## 结构分层

当前实现分两层：

- `QueueBase`：字节级环形缓冲基类；
- `Queue<T>`：在 `QueueBase` 上提供强类型接口的模板封装。

这意味着 `Queue<T>` 本质上仍是“固定大小元素的 FIFO 字节队列”，只是把 `Push/Pop/Peek` 包装成了强类型接口。

## 基本用法

```cpp
LibXR::Queue<int> queue(16);

queue.Push(42);

int value = 0;
queue.Pop(value);
```

## 主要接口

### 构造

- `explicit Queue(size_t length)`：在内部分配存储
- `Queue(size_t length, uint8_t* buffer)`：使用调用方提供的缓冲区，至少 `length * sizeof(T)` 字节

### 单个元素操作

- `Push(const T&)`
- `Pop(T&)`
- `Pop()`
- `Peek(T&)`

### 批量操作

- `PushBatch(const T* data, size_t size)`
- `PopBatch(T* data, size_t size)`
- `PeekBatch(T* data, size_t size)`

### 队列状态

- `Size()`
- `MaxSize()`
- `EmptySize()`
- `Reset()`

### 额外辅助

- `Overwrite(const T&)`
- `operator[](int32_t index)`（支持负索引）

## 当前行为边界

### 1. 固定容量

容量在构造时确定，之后不会自动扩展：

```cpp
LibXR::Queue<uint32_t> queue(5);
```

### 2. 允许容量为 1

`Queue<T>(1)` 按普通 FIFO 工作。

### 3. 支持无默认构造 payload

只要类型仍满足当前字节搬运契约，就可以使用无默认构造 payload：

```cpp
struct NoDefaultPayload
{
    explicit NoDefaultPayload(uint32_t value_in) : value(value_in) {}
    uint32_t value;
};

LibXR::Queue<NoDefaultPayload> queue(1);
```

### 4. `Overwrite()` 会直接把队列内容替换成一个新元素

`Overwrite()` 清空队列后写入这一个元素，之后 `Size()` 为 1。

## 什么时候该用 `Queue<T>`

适合：

- 单线程状态机里的 FIFO；
- 局部缓冲；
- 不涉及中断/多线程竞争的业务队列；
- 只想要普通数据结构，不想引入并发约束。

不适合：

- ISR 到线程的无锁传输；
- 两个线程并发读写；
- 多生产者共享入队。

## 和另外两类队列怎么选

| 队列 | 适用关系 | 说明 |
|------|----------|------|
| `Queue<T>` | 无并发保证 | 普通 FIFO |
| `SPSCQueue<T>` | 单生产者 / 单消费者 | lock-free，常见于 ISR/线程或线程/线程单向通道 |
| `MPMCQueue<T>` | 多生产者 / 多消费者 | 有界并发队列，要求 payload 可平凡拷贝 |
