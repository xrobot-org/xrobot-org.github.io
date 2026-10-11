---
id: mpmc_queue
title: MPMCQueue
sidebar_position: 3
---

# MPMCQueue

`LibXR::MPMCQueue<T>` is a bounded multi-producer / multi-consumer queue.

Compared with `SPSCQueue`, it is intended for more general concurrent topologies:

- multiple contexts may push;
- multiple contexts may pop;
- capacity is fixed;
- payloads are moved as byte blocks.

## Basic Usage

```cpp
LibXR::MPMCQueue<uint16_t> queue(32);

queue.Push(100);

uint16_t value = 0;
queue.Pop(value);
```

Main interfaces:

- `Push(const T&)`: returns `OK`, or `FULL` when full.
- `Pop(T&)` / `Pop()`: returns `OK`, or `EMPTY` when empty.
- `MaxSize()`, `EmptySize()`, `ElementSize()`.
- `Size()`: an approximate snapshot under concurrent access.

## Payload Requirements

`MPMCQueue<T>` requires:

- `T` must be trivially copyable;
- `T` must be trivially destructible.

This follows from the implementation strategy: the queue moves payloads as raw byte blocks and does not manage complex object lifetime internally.

## Typical Use Cases

Good fit:

- shared TX queues with multiple producers;
- public concurrent queues accessed by interrupts and threads, or by multiple threads;
- internal driver queues that need bounded concurrent behavior.

For example, a public queue passing data between tasks and threads where callers can wait or retry later. On a single core, when one context is preempted between claiming a cell and publishing it, other contexts observe transient FULL/EMPTY; when interrupts both read and write and a FULL can only drop data (for example a TX queue shared by an interrupt and a task), use [SlotPool](./slot_pool.md) instead.

## How to Choose Between `SPSCQueue`, `MPMCQueue` and `SlotPool`

- one producer and one consumer: use `SPSCQueue`;
- multiple producers or consumers: use `MPMCQueue`;
- interrupts read and write, a FULL can only drop data, and FULL/EMPTY should be accurate: use [SlotPool](./slot_pool.md), where an interrupted operation only occupies its own slot; a single enqueue or dequeue is O(1) on `MPMCQueue` and O(N) on `SlotPool`, so large capacities, high multi-core contention and callers that can wait or retry remain a good fit for `MPMCQueue`.
