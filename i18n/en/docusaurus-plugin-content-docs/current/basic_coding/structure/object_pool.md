---
id: object_pool
title: RAII Object Pool
sidebar_position: 7
---

# ObjectPool

`object_pool.hpp` provides a family of RAII slot pools built on a free-index queue. The core template is:

```cpp
LibXR::BasicObjectPool<Data, FreeQueue>
```

and three aliases:

- `LibXR::ObjectPool<Data, IndexType>`: backed by `Queue<IndexType>`
- `LibXR::SPSCObjectPool<Data, IndexType>`: backed by `SPSCQueue<IndexType>`
- `LibXR::MPMCObjectPool<Data, IndexType>`: backed by `MPMCQueue<IndexType>`

This family is built around:

- acquiring one exclusive slot through `Acquire()`
- returning that slot automatically through a move-only `Handle`
- modifying user objects in place inside the slot

---

## 1. Design points

### 1.1 Minimal queue constraint: `PoolIndexQueue`

`BasicObjectPool` does not depend on one specific queue implementation. Instead, it requires the free-index queue to provide a minimal typed interface:

- `ValueType`
- `Push(const ValueType&)`
- `Pop(ValueType&)`
- `Size()`

So the ordinary `Queue`, `SPSCQueue` and `MPMCQueue` can all serve as the free-index queue.

### 1.2 Move-only `Handle`

On successful acquisition, the pool returns a move-only `Handle` instead of a raw pointer:

- the handle returns the slot automatically on destruction
- copying is disabled, so one slot cannot be owned by multiple handles accidentally
- `Get()`, `operator->()`, and `operator*()` provide access to the object in the slot
- `Index()` returns the owned slot index
- `Reset()` returns the slot early if needed
- `Valid()` tells whether the handle owns a slot

---

## 2. Construction forms

`BasicObjectPool` supports four construction patterns:

1. internal queue + internal slots
2. internal queue + external slots
3. external queue + internal slots
4. external queue + external slots

Practical meaning:

- internal queue and internal slots: the pool allocates both
- if slot storage must live in caller-controlled memory, provide external `slots`
- to reuse or precisely control the queue, provide an external `free_queue`

When an external `free_queue` is used:

- the queue must be empty when passed in
- it must be dedicated to the pool
- its capacity must be at least `slot_count`

Constructors with internal slots require `Data` to be default-constructible; `IndexType` must be an unsigned integer type.

---

## 3. Main APIs

### 3.1 Acquire and return

- `ErrorCode Acquire(Handle& handle)`
- `void Handle::Reset()`

Behavior notes:

- success returns `ErrorCode::OK`
- when no free slot is available, the result comes from the underlying queue pop failure, commonly `ErrorCode::EMPTY`
- the slot is also returned automatically when the handle is destroyed
- `Acquire()` expects a handle that owns no slot (asserted in Debug builds)
- all handles must be returned before the pool is destroyed (Debug builds assert `EmptySize() == Size()`), so the pool must outlive its handles

### 3.2 Capacity queries

- `size_t EmptySize() const`: number of currently acquirable free slots
- `size_t Size() const`: total slot count

### 3.3 Non-owning access

- `Data& UnsafeAt(size_t index)`
- `const Data& UnsafeAt(size_t index) const`

These APIs bypass the ownership semantics of `Acquire()` / `Handle`. They are intended for debugging, external-storage inspection, or situations where the caller already knows the slot state.

---

## 4. The three common aliases

### 4.1 `ObjectPool`

```cpp
template <typename Data, typename IndexType = uint32_t>
using ObjectPool = BasicObjectPool<Data, Queue<IndexType>>;
```

Suitable for general-purpose object-pool usage in ordinary thread context when strict lock-free queue semantics are not the main concern.

### 4.2 `SPSCObjectPool`

```cpp
template <typename Data, typename IndexType = uint32_t>
using SPSCObjectPool = BasicObjectPool<Data, SPSCQueue<IndexType>>;
```

Suitable when free-slot acquisition and return clearly follow a single-producer / single-consumer path.

### 4.3 `MPMCObjectPool`

```cpp
template <typename Data, typename IndexType = uint32_t>
using MPMCObjectPool = BasicObjectPool<Data, MPMCQueue<IndexType>>;
```

Suitable for multi-producer / multi-consumer slot acquisition and return.

---

## 5. Example

```cpp
#include <libxr.hpp>

struct Packet
{
  uint32_t id = 0;
  uint8_t payload[32] = {};
};

LibXR::ObjectPool<Packet> pool(16);

LibXR::ObjectPool<Packet>::Handle handle;
if (pool.Acquire(handle) == LibXR::ErrorCode::OK)
{
  handle->id = 42;
  (*handle).payload[0] = 0xAA;
}
// the slot is returned automatically when handle leaves scope
```

To return early:

```cpp
handle.Reset();
```
