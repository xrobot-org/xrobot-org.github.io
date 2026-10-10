---
id: slot_pool
title: SlotPool
sidebar_position: 11
---

# SlotPool (Message Slot Pool)

`LibXR::SlotPool<T>` is a small message slot pool shared between tasks and interrupts: each slot carries one atomic state, and fully written slots dequeue in publication order.

Take a CAN TX queue as an example: tasks and interrupt callbacks call `AddMessage()` to enqueue, and the TX service dequeues in a task or in the TX-complete interrupt. A task may be interrupted halfway through an enqueue or a dequeue; `MPMCQueue` then returns a transient FULL/EMPTY (spurious full/empty), while `SlotPool` guarantees that an interrupted operation only occupies its own slot, so the FULL/EMPTY observed from an interrupt reflects the true state at that moment.

## Core features

- Each slot carries one atomic state: free, writing, ready, or reading. Every transition is a CAS, so at any moment a slot belongs to exactly one execution context;
- `Publish()` takes a globally increasing publish sequence, and `Take()` picks the ready slot with the smallest sequence: the dequeue order is publish-completion order, and the order inside one publisher is preserved;
- `Acquire()`/`Take()` scan the whole slot array and skip slots owned by other contexts, so a slot that has not been written yet never blocks the others;
- the release counter and the publish counter drive a bounded rescan of at most one extra pass; sequence numbers are compared with signed deltas, so wraparound is allowed;
- the slots are allocated at construction and never at run time; the object is neither copyable nor movable;
- the pool targets small capacities of a few to a few dozen slots, where the O(N) scans of `Acquire()`/`Take()` are cheap.

## Common APIs

```cpp
template <typename T>
class SlotPool
{
 public:
  explicit SlotPool(size_t slot_count);

  ErrorCode Acquire(size_t& index);   // free -> writing; FULL when no slot is free
  void Publish(size_t index);         // writing -> ready, and takes a publish sequence
  ErrorCode Take(size_t& index);      // smallest-sequence ready slot -> reading; EMPTY when none is ready
  void Release(size_t index);         // writing or reading -> free; cannot fail
  T& At(size_t index);                // access an owned slot

  ErrorCode Put(const T& value);      // Acquire + copy + Publish
  ErrorCode Get(T& value);            // Take + copy + Release

  size_t Size() const;                // total number of slots
};
```

- `Acquire()`, `Publish()`, `Take()` and `Release()` are the low-level interface; the data is written and read in place through `At()`, which fits the pattern of writing in the slot, sending from the slot, and releasing after the send completes;
- `Put()`/`Get()` are the convenience interface and complete an enqueue or a dequeue in one call; they require `T` to be trivially copyable;
- using only `Acquire()`/`Release()`, the pool serves as a fixed-capacity allocator, and abandoning a slot that was acquired but not published is also valid.

## Concurrency constraints

- any number of producers and consumers may run concurrently; calls are allowed from tasks and normal interrupts, but not from NMI;
- on a single core, low-priority contexts cannot change the slots while an interrupt is scanning, so the FULL/EMPTY an interrupt observes reflects the true state at that moment; a slot held by an interrupted operation counts as occupied;
- the dequeue order is publish-completion order: the order inside one publisher is preserved, and no global cross-publisher FIFO is guaranteed;
- the callers of `Publish()` and `Release()` must own the slot; double publishing or releasing a slot owned by another context is a caller error.

## Example

```cpp
LibXR::SlotPool<LibXR::CAN::ClassicPack> tx_pool(8);

// Submit a frame from a task or an interrupt; FULL means no free slot
void AddMessage(const LibXR::CAN::ClassicPack& pack)
{
  if (tx_pool.Put(pack) != LibXR::ErrorCode::OK)
  {
    // Pool full: this frame was not enqueued
  }
}

// Take one frame in the TX service and hand it to the hardware
void TxService()
{
  LibXR::CAN::ClassicPack pack{};
  if (tx_pool.Get(pack) == LibXR::ErrorCode::OK)
  {
    // pack has been copied out, the slot is released, ready for the hardware
  }
}
```

## Choosing between the structures

- when interrupts both read and write and a FULL can only drop data (for example a TX queue shared by an interrupt and a task): use `SlotPool`; an interrupted operation only occupies its own slot, and FULL/EMPTY are accurate;
- when callers can wait or retry later, or with large capacities and high multi-core contention: use `MPMCQueue`; a single enqueue or dequeue is O(1), while `SlotPool` is O(N);
- one producer and one consumer: `SPSCQueue`;
- only the latest complete value matters: `LatestSnapshot`;
- reusable objects instead of messages: `ObjectPool`.
