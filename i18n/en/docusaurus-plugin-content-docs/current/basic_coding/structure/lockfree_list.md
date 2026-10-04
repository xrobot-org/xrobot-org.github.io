---
id: lockfree_list
title: Lock-Free List
sidebar_position: 6
---

# LockFreeList

`LibXR::LockFreeList` is a thread-safe lock-free linked list container implemented with atomic operations. It is suitable for high-concurrency scenarios such as event registration, callback management, and resource tracking.

## Key Features

- Singly linked list implemented using C++11 atomic operations.
- All nodes inherit from `BaseNode`, with uniform structure and size identification.
- Supports arbitrary data types using the `Node<T>` template wrapper.
- Lock-free insertion and safe traversal (no deletion supported).
- Automatically verifies structure size during traversal to ensure type safety.
- No dynamic memory allocation involved; nodes are managed by the user.

## Class Structure

- `BaseNode`: Abstract node type providing `next_` atomic pointer and `size_` member.
- `Node<T>`: Template node class embedding user data as `data_`.
- `LockFreeList`: The container providing `Add` and `Foreach` interfaces.

## Interface Overview

### Add Node

```cpp
void Add(BaseNode& node);
```

- Inserts a new node at the head of the list (LIFO order), thread-safe.

### Traverse Nodes

```cpp
template <typename Data, typename Func, SizeLimitMode LimitMode = MORE>
ErrorCode Foreach(Func func);
```

- Traverses all nodes in the list and calls `func(Data&)` on the data.
- Uses `SizeLimitMode` to check data type match.
  - Traversal continues while the callback returns `ErrorCode::OK`; any non-`OK` code stops traversal immediately and is returned to the caller.

### Get Size

```cpp
uint32_t Size();
```

- Returns the number of nodes currently in the list.

### Usage Example

```cpp
LibXR::LockFreeList::Node<int> node1(123);
LibXR::LockFreeList list;
list.Add(node1);

list.Foreach<int>([](int& val) {
  // Access val
  return LibXR::ErrorCode::OK;
});
```

## Notes

- This list does not support node deletion, making it ideal for "add-only" scenarios.
- Node lifetime is managed by the user; avoid duplicate additions or premature destruction.
- The current `BaseNode` destructor asserts that the node has already been detached from the list. If a node object may be destroyed before the list itself, the caller must ensure the list has already been torn down or the node is no longer linked.
- Do not modify the list structure during traversal.

## Typical Use Cases

- Asynchronous callbacks registered from ISR/task contexts
- Module registration and state tracking
- Immutable or append-only registry structures
