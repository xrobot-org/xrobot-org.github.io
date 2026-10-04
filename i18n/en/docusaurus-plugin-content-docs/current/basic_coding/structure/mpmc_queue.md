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

For example, the CAN drivers use `MPMCQueue<ClassicPack>` for their TX queues.

## How to Choose Between `SPSCQueue` and `MPMCQueue`

- one producer and one consumer: use `SPSCQueue`;
- multiple producers or consumers: use `MPMCQueue`.
