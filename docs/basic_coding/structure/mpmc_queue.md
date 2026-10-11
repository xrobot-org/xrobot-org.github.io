---
id: mpmc_queue
title: MPMCQueue
sidebar_position: 3
---

# MPMCQueue（多生产者多消费者有界队列）

`LibXR::MPMCQueue<T>` 是多生产者多消费者有界队列。

和 `SPSCQueue` 相比，它面向的是更通用的并发拓扑：

- 多个上下文都可能入队；
- 多个上下文都可能出队；
- 队列容量固定；
- payload 按字节块搬运。

## 基本用法

```cpp
LibXR::MPMCQueue<uint16_t> queue(32);

queue.Push(100);

uint16_t value = 0;
queue.Pop(value);
```

主要接口：

- `Push(const T&)`：成功返回 `OK`，队列满返回 `FULL`。
- `Pop(T&)` / `Pop()`：成功返回 `OK`，队列空返回 `EMPTY`。
- `MaxSize()`、`EmptySize()`、`ElementSize()`。
- `Size()`：并发访问下为近似快照。

## 类型要求

`MPMCQueue<T>` 对 `T` 的要求：

- `T` 必须是 `trivially copyable`；
- `T` 必须是 `trivially destructible`。

这是因为底层直接把 payload 当原始字节块搬运，不会在队列内部管理复杂对象生命周期。

## 当前适用场景

适合：

- 多个生产者共享同一发送队列；
- 中断与线程、多个线程共同访问的公共队列；
- 驱动内部需要有界并发队列的地方。

例如数据在任务和线程之间传递、调用方能等待或稍后重试的公共队列。单核上若某个操作在占槽与发布之间被抢占，其他上下文会看到瞬时的 FULL/EMPTY；中断会读写、拿到 FULL 只能丢数据的场合（例如中断与任务共享的发送队列）改用 [SlotPool](./slot_pool.md)。

## 和 `SPSCQueue`、`SlotPool` 的取舍

- 生产者和消费者各只有一个：使用 `SPSCQueue`；
- 有多个生产者或多个消费者：使用 `MPMCQueue`；
- 中断会读写、拿到 FULL 只能丢数据、希望 FULL/EMPTY 是准的：使用 [SlotPool](./slot_pool.md)，一个被打断的操作只占自己的槽；`MPMCQueue` 的单次入队出队是 O(1)，`SlotPool` 是 O(N)，大容量、多核高争用、调用方能等待或重试的场合仍然适合 `MPMCQueue`。
