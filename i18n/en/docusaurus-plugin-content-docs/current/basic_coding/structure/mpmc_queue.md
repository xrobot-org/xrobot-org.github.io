---
id: mpmc_queue
title: MPMCQueue
sidebar_position: 3
---

# MPMCQueue

`LibXR::MPMCQueue<T>` is the current public bounded multi-producer / multi-consumer queue in mainline LibXR.

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

## Payload Requirements

Current mainline places explicit restrictions on `MPMCQueue<T>`:

- `T` must be trivially copyable;
- `T` must be trivially destructible.

This follows from the implementation strategy: the queue moves payloads as raw byte blocks and does not manage complex object lifetime internally.

## Typical Use Cases

Good fit:

- shared TX queues with multiple producers;
- public concurrent queues accessed by interrupts and threads, or by multiple threads;
- internal driver queues that need bounded concurrent behavior.

In current mainline, several CAN TX queue implementations already use `MPMCQueue<ClassicPack>` or similar payloads.

## How to Choose Between `SPSCQueue` and `MPMCQueue`

Do not treat `MPMCQueue` as the default replacement for every queue. The current codebase is moving toward topology-driven selection:

- exactly one producer and one consumer: prefer `SPSCQueue`;
- actual multiple producers or consumers: use `MPMCQueue`.

This keeps the producer/consumer topology explicit.
