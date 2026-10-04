---
id: structure-coding
title: 数据结构
sidebar_position: 2
---

# 数据结构

本章介绍 LibXR 中用于任务调度、数据通信、资源管理等场景的通用数据结构。

## 特点

- 接口与平台无关。
- 容量在构造时确定。`SPSCQueue`、`MPMCQueue`、`Stack` 在构造时分配内部存储；`Queue`、`ObjectPool` 可使用调用方提供的存储，`DoubleBuffer` 只使用调用方提供的存储；`List`、`LockFreeList`、`RBTree` 的节点由调用方持有。构造之后的读写不再分配内存。
- `Stack`、`List`、`RBTree` 使用互斥锁，不能在中断中使用；`SPSCQueue`、`LockFreeList` 为无锁结构；`MPMCQueue` 支持多生产者多消费者并发访问。

## 目录

- [Queue（普通 FIFO 队列）](./queue.md)
- [SPSCQueue（单生产者单消费者无锁队列）](./spsc_queue.md)
- [MPMCQueue（多生产者多消费者有界队列）](./mpmc_queue.md)
- [Stack（栈）](./stack.md)
- [List（链表）](./list.md)
- [LockFreeList（无锁链表）](./lockfree_list.md)
- [ObjectPool（RAII 对象池）](./object_pool.md)
- [RBTree（红黑树）](./rbt.md)
- [DoubleBuffer（双缓冲区）](./double_buffer.md)

更多使用方式、性能差异与适用场景见各页面。
