---
id: rbtree
title: 红黑树
sidebar_position: 8
---

# 红黑树（RBTree）

`LibXR::RBTree<Key>` 是一个泛型、线程安全的红黑树实现，支持插入、删除、查找、遍历操作，适用于键值索引、自动排序、内存资源映射等嵌入式数据结构场景。

## 核心特性

- 自平衡二叉查找树，插入/删除复杂度 O(log n)
- 支持泛型 Key 和 Value
- 提供模板化节点类 `Node<T>` 和抽象 `BaseNode`
- 所有操作使用 `Mutex` 保护，线程安全
- 可遍历与中序迭代支持
- 内部使用传统红黑树旋转与颜色修复机制

## 类结构

- `BaseNode`：抽象节点类型，包含 key、颜色、父子指针、大小信息
- `Node<Data>`：模板节点类型，封装用户数据
- `RBTree<Key>`：红黑树容器，支持泛型 Key 比较

## 接口说明

### 构造与初始化

```cpp
explicit RBTree(int (*compare_fun)(const Key&, const Key&));
```

- `compare_fun` 为自定义比较函数指针 `int(const Key&, const Key&)`
- `Key` 须可默认构造（`BaseNode` 含 `Key key` 成员）。

### 插入与删除

```cpp
template <typename KeyType>
void Insert(BaseNode& node, KeyType&& key);
void Delete(BaseNode& node);
```

- 插入节点时需设定 Key，自动修复树平衡
- 删除节点支持任意节点位置，自动修复树结构

### 查找节点

```cpp
template <typename Data, SizeLimitMode LimitMode = SizeLimitMode::MORE>
Node<Data>* Search(const Key& key);
```

- 返回键为 `key` 的节点指针，若无则为 nullptr
- Debug 构建下按 `LimitMode` 断言节点数据大小。

### 遍历节点

```cpp
template <typename Data, typename Func, SizeLimitMode LimitMode = SizeLimitMode::MORE>
ErrorCode Foreach(Func func);
```

- 中序遍历，回调签名为 `ErrorCode(Node<Data>&)`；`Foreach` 不检查节点大小。
- 回调返回 `ErrorCode::OK` 时继续遍历；返回任意非 `OK` 错误码时立即中断并把该错误码返回给调用方。

### 节点数量

```cpp
uint32_t GetNum();
```

- 返回当前树中的节点数量。

### 迭代接口

```cpp
Node<Data>* ForeachDisc(Node<Data>* node);
```

- 依次返回中序下一个节点，初始调用时传入 nullptr
  - 传入 `nullptr` 时，从当前树中的最左节点开始。
  - 之后每次传入上一次返回的节点，得到中序下一个节点；遍历结束时返回 `nullptr`。

### 节点定义示例

```cpp
static int cmp(const int& a, const int& b) { return (a > b) - (a < b); }

RBTree<int> tree(cmp);
RBTree<int>::Node<std::string> n1("hello");
tree.Insert(n1, 42);
```

## 注意事项

- 所有操作为线程安全，但需注意节点生命周期由用户控制
- 当前公开接口假定节点由用户创建并持有；树本身不负责节点内存管理。
- 节点类型需固定在使用前明确
- `Search` 在 Debug 构建下检查节点数据大小，`Foreach` 与 `ForeachDisc` 不检查。

## 应用场景

- 有序对象存储与检索
- 配置项查找（如字符串键映射）
- 映射类结构（如资源 ID 与对象映射）
