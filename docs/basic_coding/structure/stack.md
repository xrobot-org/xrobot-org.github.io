---
id: stack
title: 栈
sidebar_position: 3
---

# 栈（Stack）

`LibXR::Stack<T>` 是一个线程安全的固定容量栈数据结构，适用于需要临时保存数据的嵌入式应用场景，例如命令记录、导航状态保存等。

## 核心特性

- 基于数组的顺序栈，使用 `Mutex` 实现线程安全。
- 支持标准操作：`Push`, `Pop`, `Peek`。
- 支持负索引访问（从栈顶向下）。
- 提供插入、删除、重置等扩展操作。
- 栈大小固定，构造时指定容量。

## 接口说明

### 构造函数

```cpp
Stack(uint32_t depth);
```

- 创建固定深度的栈，动态分配内部数组。

### 基本操作

- `ErrorCode Push(const T&)`：推入元素。
- `ErrorCode Pop(T&)`：弹出元素。
- `ErrorCode Pop()`：弹出元素（忽略返回）。
- `ErrorCode Peek(T&)`：查看栈顶元素。

### 辅助操作

- `uint32_t Size()`：获取当前元素数量。
- `uint32_t EmptySize()`：剩余空间。
- `T& operator[](int32_t index)`：支持负索引。
- `ErrorCode Insert(const T&, uint32_t index)`：在指定位置插入。
- `ErrorCode Delete(uint32_t index)`：删除指定位置元素。
- `void Reset()`：清空栈。

## 使用示例

```cpp
LibXR::Stack<int> s(8);

s.Push(1);
s.Push(2);
int value;
s.Pop(value);  // value == 2
```

## 注意事项

- 本栈采用互斥锁保护，适合多线程使用，但不适用于中断上下文。
- 若对性能有极致要求，可考虑使用无锁结构代替。
- 所有索引操作需注意边界条件；当前 `operator[](int32_t index)` 的负索引语义是“相对当前栈顶向下偏移”，而不是“相对容量尾端索引”。
- 当前实现没有显式析构函数，内部 `new Data[depth]` 的生命周期与对象本身绑定，该头文件未对外提供更多资源管理语义。

## 典型应用

- 状态记录与恢复
- 嵌套结构处理
- 命令栈/导航栈
