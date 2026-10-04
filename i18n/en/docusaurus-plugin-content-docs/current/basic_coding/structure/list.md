---
id: list
title: List
sidebar_position: 5
---

# List

`LibXR::List` is a thread-safe generic linked list container that supports dynamic addition, deletion, and traversal of nodes. Each node inherits from `BaseNode` and can encapsulate arbitrary data types via the `Node<T>` template. It is suitable for flexible data structures such as event callbacks and resource management.

## Key Features

- All nodes inherit from `BaseNode`, ensuring a unified structure.
- The `Node<T>` template class encapsulates user data.
- Supports thread-safe add, delete, and traversal operations.
- Internally uses a circular linked list to avoid null pointer issues.
- Traversal supports structure size verification to ensure type safety.

## Class Structure

- `BaseNode`: Base class for all nodes, stores size and next pointer.
- `Node<T>`: Template node class that wraps user data.
- `List`: The container itself, provides Add / Delete / Foreach interfaces.

## Interface Description

### Node Classes

```cpp
class BaseNode {
  BaseNode* next_;
  size_t size_;
};

template <typename T>
class Node : public BaseNode {
  T data_;
};
```

### Constructor and Destructor

- `List()`: Initializes the circular list head.
- `~List()`: Destroys the list and clears all node pointers.

### Insertion and Deletion

- `void Add(BaseNode& node)`: Adds the node to the front of the list.
- `ErrorCode Delete(BaseNode& node)`: Removes the specified node from the list.
  - If the node is not currently linked in the list, the implementation returns `ErrorCode::NOT_FOUND`.

### Query and Traversal

- `uint32_t Size()`: Gets the number of nodes in the list.
- `ErrorCode Foreach(Func func)`: Traverses all nodes and applies the callback.
  - Traversal continues while the callback returns `ErrorCode::OK`; any non-`OK` code stops traversal immediately and is returned to the caller.

### Foreach Usage Example

```cpp
LibXR::List::Node<int> node1(42);
LibXR::List list;
list.Add(node1);

list.Foreach<int>([](int& data) {
  // Access each node's data
  return LibXR::ErrorCode::OK;
});
```

## Notes

- Nodes must be allocated and freed by the user. `List` does not manage memory.
- Each node can only exist in one list at a time, and should not be added again while it is still linked.
- The current `BaseNode` destructor asserts that the node has already been detached from any list. If a node object may be destroyed before the list itself, remove it explicitly with `Delete()` first.
- `Foreach` includes structure validation to ensure type matching.

## Typical Use Cases

- Dynamically registered callback lists
- Plugin or module management
- System resource tracking
