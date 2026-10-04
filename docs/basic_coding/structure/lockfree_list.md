---
id: lockfree_list
title: 无锁链表
sidebar_position: 6
---

# LockFreeList（无锁链表）

`LibXR::LockFreeList` 是一个线程安全的无锁链表容器，基于原子操作实现，适用于高并发场景下的事件注册、回调管理、资源追踪等。

## 核心特性

- 使用 C++11 原子操作实现的单向链表。
- 所有节点继承自 `BaseNode`，具有统一结构与大小标识。
- 支持任意数据类型节点：通过模板 `Node<T>` 封装。
- 支持无锁添加与安全遍历（不可删除）。
- 遍历时自动进行结构大小检查，确保类型安全。
- 不涉及动态内存分配，节点由用户管理。

## 类结构

- `BaseNode`：抽象节点类型，提供 `next_` 原子指针和 `size_` 成员。
- `Node<T>`：模板节点类，内嵌用户数据成员 `data_`。
- `LockFreeList`：容器本体，提供 `Add` 和 `Foreach` 接口。

## 接口说明

### 添加节点

```cpp
void Add(BaseNode& node);
```

- 将新节点插入链表头部（LIFO 顺序），线程安全。

### 遍历节点

```cpp
template <typename Data, typename Func, SizeLimitMode LimitMode = MORE>
ErrorCode Foreach(Func func);
```

- 遍历链表中所有节点，对数据调用回调 `func(Data&)`。
- 使用 `SizeLimitMode` 模式检查节点数据类型。
  - 回调返回 `ErrorCode::OK` 时继续遍历；返回任意非 `OK` 错误码时立即中断并把该错误码返回给调用方。

### 获取大小

```cpp
uint32_t Size();
```

- 返回链表中当前节点个数。

### 使用示例

```cpp
LibXR::LockFreeList::Node<int> node1(123);
LibXR::LockFreeList list;
list.Add(node1);

list.Foreach<int>([](int& val) {
  // 访问 val
  return LibXR::ErrorCode::OK;
});
```

## 注意事项

- 本链表不支持删除节点，适合“只增不删”的注册场景。
- 节点生命周期由用户控制，需避免重复添加或早期析构。
- 当前 `BaseNode` 析构时会断言该节点已从链表脱离；如果节点对象可能先于链表析构，调用方需要保证链表整体已销毁或节点已不再处于链接状态。
- 遍历过程中不可修改链表结构。

## 典型应用

- 中断/任务中注册的异步回调
- 模块注册与状态追踪
- 不可变注册表或只增表结构
