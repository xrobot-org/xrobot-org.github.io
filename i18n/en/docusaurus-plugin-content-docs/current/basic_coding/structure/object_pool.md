---
id: object_pool
title: RAII Object Pool
sidebar_position: 7
---

# ObjectPool

`object_pool.hpp` provides a fixed-slot object pool with reference counting:

```cpp
LibXR::ObjectPool<Data>
```

The number of slots is fixed at construction. One writer, shared readers: `Acquire()` yields a move-only writable `Handle`; after writing, move it into a copyable read-only `ConstHandle` to distribute the slot, and the final release returns the slot to the free stack.

---

## 1. Design points

### 1.1 Slots and payloads

The slot type is `ObjectPool<Data>::Slot`, made of a reference count, a free-stack link and a resident payload:

- payloads are constructed with the pool and destroyed with the pool; a release neither destroys nor clears the object in the slot, so the next acquirer writes its own data;
- a pool constructed with internal slots requires `Data` to be default-constructible; with external slots the caller prepares the storage, and `Slot` also has `Slot(std::in_place, args...)` to construct a payload in place;
- the slot storage is fixed at construction, and later acquisitions and releases allocate no memory.

### 1.2 Writable and read-only handles

`Handle` owns one slot exclusively and is move-only:

- it releases the slot on destruction, and `Reset()` releases it early;
- `Get()`, `operator->()` and `operator*()` access the payload, `Index()` returns the slot index and `Valid()` tells whether it owns a slot;
- copying is disabled, so one slot cannot be held by two writable handles.

`ConstHandle` shares one slot and is copyable: it is obtained by moving a `Handle` or by copying another `ConstHandle`. A copy adds a reference and destruction drops one, and the final release returns the slot to the free stack. It provides read-only access to the payload only.

### 1.3 Concurrency

Only one acquirer may use a pool at a time, and acquisitions must not overlap or reenter; debug builds check this, because overlapping acquisitions cause ABA on the free stack and hand one slot to two acquirers. Releases may run concurrently from any thread or ISR and cannot fail. Distinct handle objects may be used concurrently, while concurrent access to one handle object requires caller synchronization. Construction and destruction require quiescence and cannot run in an ISR; the pool and any external slot storage must outlive all handles. ISR use requires 32-bit atomic CAS on the target.

---

## 2. Construction

```cpp
explicit ObjectPool(size_t slot_count);
ObjectPool(size_t slot_count, Slot* slots);
```

- `ObjectPool(slot_count)`: the pool allocates the slot array and `Data` must be default-constructible;
- `ObjectPool(slot_count, slots)`: the caller provides the slot array, and the pool neither constructs nor destroys its payloads; `slots` must point to at least `slot_count` slots not used by another pool.

The pool is neither copyable nor movable.

---

## 3. Main APIs

### 3.1 Acquire and release

- `ErrorCode Acquire(Handle& handle)`
- `void Handle::Reset()`
- `void ConstHandle::Reset()`

Behavior notes:

- success returns `ErrorCode::OK`, and `ErrorCode::EMPTY` without waiting when no slot is free;
- `Acquire()` expects a handle that owns no slot (asserted in Debug builds);
- all handles must be released before the pool is destroyed (Debug builds assert `EmptySize() == Size()`).

### 3.2 Capacity queries

- `size_t EmptySize() const`: the number of free slots, approximate during concurrent acquire or release and for monitoring only;
- `size_t Size() const`: the total slot count.

### 3.3 Non-owning access

- `Data& UnsafeAt(size_t index)`
- `const Data& UnsafeAt(size_t index) const`

These APIs bypass the ownership semantics of `Acquire()` / `Handle`. They are intended for debugging, external-storage inspection, or situations where the caller already knows the slot state.

### 3.4 Reference limit

Each slot must have at most `UINT32_MAX` references.

---

## 4. Example

```cpp
#include <libxr.hpp>

struct Packet
{
  uint32_t id = 0;
  uint8_t payload[32] = {};
};

LibXR::ObjectPool<Packet> pool(16);

LibXR::ObjectPool<Packet>::Handle writer;
if (pool.Acquire(writer) == LibXR::ErrorCode::OK)
{
  writer->id = 42;
  (*writer).payload[0] = 0xAA;

  // After writing, move it into a read-only handle to distribute the slot; writer becomes empty
  LibXR::ObjectPool<Packet>::ConstHandle frame = std::move(writer);
  LibXR::ObjectPool<Packet>::ConstHandle copy = frame;
}
// frame and copy release their references when they leave scope; the last one returns the slot
```

A reference can be released early: `Handle::Reset()` returns the slot directly, and `ConstHandle::Reset()` drops one reference.

```cpp
frame.Reset();
```

---

## 5. Typical scenario

Separating acquisition from processing: the acquiring side (one interrupt or one thread) takes a slot with `Acquire()` and writes one frame of data, then hands the read-only handle to a processing thread. That thread can pass the same data on to several downstream readers, and the final release returns the slot to the free stack automatically. When no slot is free, `Acquire()` returns `ErrorCode::EMPTY` and the acquiring side does not wait, so the slot count is the number of frames in flight at once.
