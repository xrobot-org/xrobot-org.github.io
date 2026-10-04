---
id: rbtree
title: Red-Black Tree
sidebar_position: 8
---

# RBTree (Red-Black Tree)

`LibXR::RBTree<Key>` is a generic, thread-safe red-black tree implementation that supports insertion, deletion, lookup, and traversal. It is ideal for embedded data structure scenarios involving key-value indexing, automatic sorting, and memory resource mapping.

## Key Features

- Self-balancing binary search tree with O(log n) insertion/deletion complexity
- Supports generic Key and Value types
- Provides templated node class `Node<T>` and abstract base `BaseNode`
- All operations are thread-safe via `Mutex` protection
- Supports traversal and in-order iteration
- Internally uses classic red-black tree rotations and color fix-up mechanisms

## Class Structure

- `BaseNode`: Abstract node type, includes key, color, parent/child pointers, and size info
- `Node<Data>`: Templated node type encapsulating user data
- `RBTree<Key>`: Red-black tree container supporting generic key comparison

## Interface Overview

### Constructor and Initialization

```cpp
explicit RBTree(int (*compare_fun)(const Key&, const Key&));
```

- `compare_fun` is a user-defined comparison function: `int(const Key&, const Key&)`
- `Key` must be default-constructible (`BaseNode` holds a `Key key` member).

### Insertion and Deletion

```cpp
template <typename KeyType>
void Insert(BaseNode& node, KeyType&& key);
void Delete(BaseNode& node);
```

- When inserting, assign a key and the tree will automatically balance itself
- Deletion works on any node and also rebalances the tree structure

### Search

```cpp
template <typename Data, SizeLimitMode LimitMode = SizeLimitMode::MORE>
Node<Data>* Search(const Key& key);
```

- Returns the pointer to the node with the given key, or `nullptr` if not found
- In Debug builds the node data size is asserted against `LimitMode`.

### Traversal

```cpp
template <typename Data, typename Func, SizeLimitMode LimitMode = SizeLimitMode::MORE>
ErrorCode Foreach(Func func);
```

- In-order traversal; the callback signature is `ErrorCode(Node<Data>&)`; `Foreach` does not check node sizes.
- Traversal continues while the callback returns `ErrorCode::OK`; any non-`OK` code stops traversal immediately and is returned to the caller.

### Node count

```cpp
uint32_t GetNum();
```

- Returns the current number of nodes in the tree.

### Iteration Interface

```cpp
Node<Data>* ForeachDisc(Node<Data>* node);
```

- Returns the next node in in-order sequence; pass `nullptr` to start
  - Passing `nullptr` starts from the current leftmost node in the tree.
  - Each subsequent call should pass the previously returned node; `nullptr` is returned when the in-order walk reaches the end.

### Node Usage Example

```cpp
static int cmp(const int& a, const int& b) { return (a > b) - (a < b); }

RBTree<int> tree(cmp);
RBTree<int>::Node<std::string> n1("hello");
tree.Insert(n1, 42);
```

## Notes

- All operations are thread-safe, but node lifetime is user-managed
- The public interface assumes nodes are created and owned by the caller; the tree itself does not manage node memory.
- Node type must be known and fixed before usage
- `Search` checks node data size in Debug builds; `Foreach` and `ForeachDisc` do not.

## Application Scenarios

- Ordered object storage and retrieval
- Configuration item lookup (e.g., string-to-value maps)
- Mapping structures (e.g., resource ID to object mapping)
