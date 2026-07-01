---
id: stack
title: Stack
sidebar_position: 3
---

# Stack

`LibXR::Stack<T>` is a thread-safe, fixed-capacity stack data structure designed for embedded applications that require temporary data storage, such as command history or navigation state saving.

## Key Features

- Array-based sequential stack with thread safety ensured via `Mutex`.
- Supports standard stack operations: `Push`, `Pop`, `Peek`.
- Allows negative index access (from top downward).
- Provides insert, delete, and reset operations.
- Fixed size, capacity set during construction.

## Interface Overview

### Constructor

```cpp
Stack(uint32_t depth);
```

- Creates a stack with a fixed depth and dynamically allocates internal storage.

### Basic Operations

- `ErrorCode Push(const T&)`: Push an element onto the stack.
- `ErrorCode Pop(T&)`: Pop the top element.
- `ErrorCode Pop()`: Pop the top element (discarded).
- `ErrorCode Peek(T&)`: View the top element.

### Auxiliary Operations

- `uint32_t Size()`: Get the current number of elements.
- `uint32_t EmptySize()`: Get the remaining space.
- `T& operator[](int32_t index)`: Access elements using negative indexing.
- `ErrorCode Insert(const T&, uint32_t index)`: Insert at a specified position.
- `ErrorCode Delete(uint32_t index)`: Delete an element at the specified index.
- `void Reset()`: Clear the stack.

## Usage Example

```cpp
LibXR::Stack<int> s(8);

s.Push(1);
s.Push(2);
int value;
s.Pop(value);  // value == 2
```

## Notes

- This stack uses a mutex for protection, making it suitable for multithreaded use but not for interrupt contexts.
- For ultra-high performance needs, consider using a lock-free structure instead.
- Index-based access still requires careful bounds handling; the current `operator[](int32_t index)` negative-index rule is “offset downward from the current top”, not “index from the storage tail”.
- The current header does not add an explicit destructor around the internal `new Data[depth]` allocation, so do not assume richer ownership or cleanup behavior than the code provides.

## Typical Applications

- State recording and restoration
- Handling nested structures
- Command stack / navigation stack
