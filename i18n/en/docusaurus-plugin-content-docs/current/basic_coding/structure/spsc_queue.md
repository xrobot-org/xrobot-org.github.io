---
id: spsc_queue
title: SPSCQueue
sidebar_position: 2
---

# SPSCQueue

`LibXR::SPSCQueue<T>` is a single-producer / single-consumer lock-free queue for clearly one-way channels such as:

- ISR -> thread;
- producer thread -> consumer thread;
- `Topic::QueuedSubscriber` -> one consumer.

## Basic Usage

```cpp
LibXR::SPSCQueue<uint32_t> queue(16);

queue.Push(10);

uint32_t value = 0;
queue.Pop(value);
```

## Current Characteristics

- the template layer maps `T` to a fixed-size byte payload;
- the implementation reuses `SPSCQueueBase`;
- the queue does not manage complex object lifetime internally;
- it supports `Push/Pop/Peek` and batch helpers;
- it also exposes `PushWithWriter()` / `PopWithReader()` for callback-style batched access.

## Common Interfaces

### Single-item operations

- `Push(const T&)`
- `Pop(T&)`
- `Peek(T&)`
- `Pop()` (discards the front element)

### Batch operations

- `PushBatch(const T* data, size_t size)`
- `PopBatch(T* data, size_t size)`
- `PeekBatch(T* data, size_t size)`

### Callback-style batched access

- `PushWithWriter(Writer&& writer)`
- `PushWithWriter(size_t size, Writer&& writer)`
- `PopWithReader(Reader&& reader)`
- `PopWithReader(size_t size, Reader&& reader)`
- `ProduceWithWriter(size_t limit, Writer&& writer)`: callback signature `size_t(T*, size_t, T*, size_t)`; two free spans of the ring in one callback; returns the number of elements written
- `ConsumeWithReader(size_t limit, Reader&& reader)`: callback signature `size_t(const T*, size_t, const T*, size_t)`; returns the number of elements taken

These two require `T` to be trivially copyable and trivially destructible; `SPSCQueue<T>` does not support alignment above `alignof(std::max_align_t)`.

### Other helpers

- `Size()`
- `MaxSize()`
- `EmptySize()`
- `Reset()`

## Role in the Message System

Current `Topic::QueuedSubscriber` uses `SPSCQueue`:

```cpp
auto topic = LibXR::Topic::CreateTopic<float>("temperature");
LibXR::SPSCQueue<float> queue(8);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);
```

It can also queue timestamped `Topic::Message<T>`:

```cpp
LibXR::SPSCQueue<LibXR::Topic::Message<float>> queue(8);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);
```

If the queue is full, that publish is dropped immediately instead of blocking the publisher.

## Selection Rule

Use `SPSCQueue` when all of the following are true:

- there is exactly one producer;
- there is exactly one consumer;
- the one-way topology should be explicit in the type.

If either side has more than one context, use `MPMCQueue`.
