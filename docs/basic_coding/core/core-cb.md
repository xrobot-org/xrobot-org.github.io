---
id: core-callback
title: 通用回调
sidebar_position: 3
---

# 通用回调

`libxr_cb.hpp` 提供通用回调 `Callback`，底层由 `CallbackBlock` 与可选的 `GuardedCallbackBlock` 实现，用于异步通知、事件处理、错误回调等场景。

## CallbackBlock

```cpp
template <typename ArgType, typename... Args>
class CallbackBlock;
```

用于封装一个具体的回调函数及其第一个绑定参数，并提供擦除后的统一调用入口，可在 ISR 或任务上下文触发：

- `FunctionType`: 回调函数签名为 `void(bool in_isr, ArgType arg, Args... args)`。

构造时绑定函数与参数。`CallbackBlock` 不可复制；`Callback` 复制后共享同一个回调块。

### `GuardedCallbackBlock` 的重入保护语义

`GuardedCallbackBlock` 在 `CallbackBlock` 之上增加重入保护，对应的用户入口是：

```cpp
LibXR::Callback<Args...>::CreateGuarded(fun, bound_arg);
```

它用于抑制回调链形成环时的栈递归增长（例如 A → B → C → A，使同一回调在其执行期间被间接再次触发）。

当同一 guarded callback 处于执行状态时再次触发：

- 不会形成新的嵌套调用栈帧（不递归调用）；
- 仅保留一次“待执行请求”（保存一份参数快照；后续重入会覆盖旧的待执行参数）；
- 当前执行结束后在同一调用点以循环方式补跑（以循环代替递归），直到没有待执行请求为止，从而避免无限嵌套。

> 备注：为缓存待执行参数，内部对 `Args...` 以 `std::decay_t` 形式按值保存一份可复制的参数快照。

## Callback

```cpp
template <typename... Args>
class Callback;
```

对底层 callback block 的进一步封装，提供统一接口、类型擦除和创建工厂方法。

### 创建回调

```cpp
LibXR::Callback<Args...> cb = LibXR::Callback<Args...>::Create(fun, bound_arg);
```

- `fun`: 回调函数，格式为 `void(bool, BoundArgType, Args...)`，并且需要**可转换为函数指针**（例如普通函数、静态成员函数、无捕获 lambda 等）。
- `bound_arg`: 回调函数的第一个绑定参数

> 注意：`Create` 会 `new` 一个 `CallbackBlock<BoundArgType, Args...>`，回调块不会释放；`Create()` / `CreateGuarded()` 应在初始化阶段调用，创建的回调长期持有。

如需 guarded 版本：

```cpp
LibXR::Callback<Args...> cb = LibXR::Callback<Args...>::CreateGuarded(fun, bound_arg);
```

该路径分配 `GuardedCallbackBlock<...>`。guarded 回调用于压平同一条调用链上的递归重入；多个线程或 ISR 同时触发时需要调用方自行同步。

### 执行回调

```cpp
cb.Run(in_isr, arg1, arg2, ...);
```

可传递附加参数，`in_isr` 指示调用上下文；若回调为空，`Run` 为安全的空操作（no-op）。

### 其他接口与语义

- `Empty()`：判断回调是否为空
- 支持默认构造、拷贝构造、移动构造与赋值
  - 拷贝为浅拷贝：多个 `Callback` 实例会共享同一回调块指针与调用入口。

## 使用示例

```cpp
void OnEvent(bool in_isr, int context, const char* msg) {
  printf("ISR=%d context=%d msg=%s\n", in_isr, context, msg);
}

auto cb = LibXR::Callback<const char*>::Create(OnEvent, 42);
cb.Run(false, "Hello");
```

输出：

```bash
ISR=0 context=42 msg=Hello
```

## 设计特点

- 只有 `CreateGuarded(...)` 创建的回调带重入保护；`Create(...)` 只创建基础 `CallbackBlock`。
- `Run()` 可在 ISR 中调用，`in_isr` 原样传给回调；回调体能否在 ISR 中执行由回调自身决定。`Create()` / `CreateGuarded()` 会分配内存，应在初始化阶段调用。
- 绑定参数与调用参数的类型由模板参数确定，编译期检查。
- 适用于 IO、定时器、事件发布等场景的回调传递。
