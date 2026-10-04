---
id: queue
title: Queue
sidebar_position: 1
---

# Queue (ordinary FIFO queue)

`LibXR::Queue<T>` is the most basic queue: a fixed-capacity FIFO without built-in concurrency semantics. It is suitable for single-threaded code or for cases where synchronization is already handled externally.

The public queue types are:

- `Queue<T>`: ordinary FIFO;
- `SPSCQueue<T>`: single-producer / single-consumer lock-free queue;
- `MPMCQueue<T>`: bounded multi-producer / multi-consumer queue.

Use `Queue<T>` for single-threaded FIFOs; with concurrent access choose `SPSCQueue` or `MPMCQueue` by the number of producers and consumers.

## Structure Layers

The implementation is split into two layers:

- `QueueBase`: the byte-level ring buffer base;
- `Queue<T>`: the typed wrapper built on top of `QueueBase`.

So `Queue<T>` is still fundamentally a fixed-size FIFO byte queue with typed `Push/Pop/Peek` helpers.

## Basic Usage

```cpp
LibXR::Queue<int> queue(16);

queue.Push(42);

int value = 0;
queue.Pop(value);
```

## Main Interfaces

### Construction

- `explicit Queue(size_t length)`: allocates internal storage
- `Queue(size_t length, uint8_t* buffer)`: uses a caller-provided buffer of at least `length * sizeof(T)` bytes

### Single-item operations

- `Push(const T&)`
- `Pop(T&)`
- `Pop()`
- `Peek(T&)`

### Batch operations

- `PushBatch(const T* data, size_t size)`
- `PopBatch(T* data, size_t size)`
- `PeekBatch(T* data, size_t size)`

### Queue state

- `Size()`
- `MaxSize()`
- `EmptySize()`
- `Reset()`

### Extra helpers

- `Overwrite(const T&)`
- `operator[](int32_t index)` with negative indexing support

## Current Behavior Boundaries

### 1. Fixed capacity

Capacity is decided at construction time and does not grow automatically:

```cpp
LibXR::Queue<uint32_t> queue(5);
```

### 2. Capacity 1 is valid

`Queue<T>(1)` works as an ordinary FIFO.

### 3. Non-default-constructible payloads are supported

As long as the payload still fits the current byte-moving queue contract, it can work without a default constructor:

```cpp
struct NoDefaultPayload
{
    explicit NoDefaultPayload(uint32_t value_in) : value(value_in) {}
    uint32_t value;
};

LibXR::Queue<NoDefaultPayload> queue(1);
```

### 4. `Overwrite()` replaces the queue contents with exactly one new element

`Overwrite()` clears the queue and stores this one element, so `Size()` becomes 1.

## When to Use `Queue<T>`

Good fit:

- single-threaded state machines;
- local FIFO buffering;
- business queues without interrupt or multi-thread contention;
- plain data structures without concurrency semantics.

Not a good fit:

- ISR-to-thread lock-free transfer;
- two threads concurrently pushing/popping;
- shared multi-producer ingress.

## How to Choose Between the Queue Types

| Queue | Concurrency shape | Notes |
|------|-------------------|------|
| `Queue<T>` | none | ordinary FIFO |
| `SPSCQueue<T>` | one producer / one consumer | lock-free; common for ISR-to-thread or thread-to-thread one-way channels |
| `MPMCQueue<T>` | multiple producers / multiple consumers | bounded concurrent queue; payload must be trivially copyable |
