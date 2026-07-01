---
id: structure-coding
title: Data Structures
sidebar_position: 2
---

# Data Structures

This module summarizes the general-purpose data structures used in LibXR for task scheduling, data communication, and resource management.

## Features

- **Platform Independent**: All interfaces are abstracted to be platform-agnostic and portable.
- **Memory Controllable**: Most structures support external buffers or fixed capacity to avoid runtime allocation.
- **Thread/Interrupt Safe**: Some structures are designed with mutexes or lock-free algorithms, suitable for multithreading or interrupt contexts.
- **Clear Structure**: Each structure encapsulates a base node, template node, and core operation interfaces for easy extensibility.

## Contents

- [Queue (ordinary FIFO)](./queue.md)
- [SPSCQueue](./spsc_queue.md)
- [MPMCQueue](./mpmc_queue.md)
- [Stack](./stack.md)
- [List](./list.md)
- [LockFreeList](./lockfree_list.md)
- [ObjectPool](./object_pool.md)
- [LockFreePool](./lockfree_pool.md)
- [RBTree](./rbt.md)
- [DoubleBuffer](./double_buffer.md)

For usage, performance comparisons, and application scenarios, see the individual pages.
