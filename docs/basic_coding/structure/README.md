---
id: structure-coding
title: 数据结构
sidebar_position: 2
---

# 数据结构

本模块汇总了 LibXR 中用于任务调度、数据通信、资源管理等场景的通用数据结构。

## 特点

- **平台独立**：所有接口均采用平台无关的抽象，支持移植。
- **内存可控**：多数结构支持外部缓冲或固定容量，避免运行时分配。
- **线程/中断安全**：部分结构使用互斥锁或无锁算法设计，适配多线程/中断上下文。
- **结构清晰**：每种结构均封装基础节点、模板节点与核心操作接口，易于扩展。

## 目录

- [Queue（普通 FIFO 队列）](./queue.md)
- [SPSCQueue（单生产者单消费者无锁队列）](./spsc_queue.md)
- [MPMCQueue（多生产者多消费者有界队列）](./mpmc_queue.md)
- [Stack（栈）](./stack.md)
- [List（链表）](./list.md)
- [LockFreeList（无锁链表）](./lockfree_list.md)
- [ObjectPool（RAII 对象池）](./object_pool.md)
- [LockFreePool（无锁无序槽池）](./lockfree_pool.md)
- [RBTree（红黑树）](./rbt.md)
- [DoubleBuffer（双缓冲区）](./double_buffer.md)

更多使用方式、性能差异与适用场景见各页面。
