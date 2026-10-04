---
id: list
title: 链表
sidebar_position: 5
---

# 链表（List）

`LibXR::List` 是一个线程安全的通用链表容器，支持动态添加、删除和遍历节点。每个节点均继承自 `BaseNode`，可以通过模板 `Node<T>` 封装任意数据类型。适用于事件回调、资源管理等灵活数据结构需求。

## 核心特性

- 所有节点继承自 `BaseNode`，统一结构。
- 提供 `Node<T>` 模板类封装数据。
- 支持线程安全的添加、删除和遍历。
- 内部使用循环链表结构，避免空指针问题。
- Debug 构建下，`Foreach` 断言节点数据大小满足 `LimitMode`（默认不小于 `sizeof(Data)`）。

## 类结构

- `BaseNode`：所有节点基类，记录大小与指针。
- `Node<T>`：模板节点类，封装用户数据。
- `List`：容器本体，提供 Add / Delete / Foreach 接口。

## 接口说明

### 节点类

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

### 构造与析构

- `List()`：初始化循环链表头。
- `~List()`：销毁链表并清空所有节点指针。

### 插入与删除

- `void Add(BaseNode& node)`：将节点加入链表头部。
- `ErrorCode Delete(BaseNode& node)`：从链表中移除指定节点。
  - 若节点不在当前链表中，当前实现返回 `ErrorCode::NOT_FOUND`。

### 查询与遍历

- `uint32_t Size()`：获取链表中节点数。
- `ErrorCode Foreach(Func func)`：遍历所有节点并调用函数。
  - 回调返回 `ErrorCode::OK` 时继续遍历；返回任意非 `OK` 错误码时立即中断并把该错误码返回给调用方。

### Foreach 使用示例

```cpp
LibXR::List::Node<int> node1(42);
LibXR::List list;
list.Add(node1);

list.Foreach<int>([](int& data) {
  // 访问每个节点数据
  return LibXR::ErrorCode::OK;
});
```

## 注意事项

- 节点由用户申请与释放，`List` 不负责内存管理。
- 每个节点只能同时存在于一个链表中，也不应在仍处于链接状态时重复 `Add()` 到任意链表。
- 当前 `BaseNode` 析构时会断言该节点已经从链表中脱离；如果节点对象比链表更早析构，调用方应先显式 `Delete()`。
- `Foreach<Data>` 的 `Data` 须与节点实际类型一致；Debug 构建下只检查大小。

## 典型应用

- 动态注册的回调列表
- 插件或模块管理
- 系统资源追踪
