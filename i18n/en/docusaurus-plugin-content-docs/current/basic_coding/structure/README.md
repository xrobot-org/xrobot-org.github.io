---
id: structure-coding
title: Data Structures
sidebar_position: 2
---

# Data Structures

This chapter covers the general-purpose data structures LibXR uses for task scheduling, data communication and resource management.

## Features

- Interfaces are platform-independent.
- Capacity is fixed at construction. `SPSCQueue`, `MPMCQueue` and `Stack` allocate their storage at construction; `Queue` and `ObjectPool` can use caller-provided storage and `DoubleBuffer` uses only caller-provided storage; nodes of `List`, `LockFreeList` and `RBTree` are owned by the caller. Reads and writes after construction do not allocate.
- `Stack`, `List` and `RBTree` use a mutex and cannot be used in interrupts; `SPSCQueue` and `LockFreeList` are lock-free; `MPMCQueue` supports multiple producers and consumers.

## Contents

- [Queue (ordinary FIFO)](./queue.md)
- [SPSCQueue](./spsc_queue.md)
- [MPMCQueue](./mpmc_queue.md)
- [Stack](./stack.md)
- [List](./list.md)
- [LockFreeList](./lockfree_list.md)
- [ObjectPool](./object_pool.md)
- [LatestSnapshot](./latest_snapshot.md)
- [RBTree](./rbt.md)
- [DoubleBuffer](./double_buffer.md)

For usage, performance comparisons, and application scenarios, see the individual pages.
