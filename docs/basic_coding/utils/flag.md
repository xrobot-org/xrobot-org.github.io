---
id: flag
title: Flag（轻量标志位）
sidebar_position: 1
---

# Flag（轻量标志位）

`LibXR::Flag` 提供一组非常轻量的布尔状态工具，适合表达“忙闲”、“请求待处理”、“某事件是否发生过”这类简单状态。

`Flag` 包含三部分：

- `Flag::Atomic`：原子标志位，适合线程 / 多核 / ISR 共享状态。
- `Flag::Plain`：普通标志位，不提供并发保护。
- `Flag::ScopedRestore<FlagT>`：作用域恢复辅助器，进入作用域时改写标志，离开作用域时恢复旧值。

`Flag` 只保存和交换一个布尔值；需要互斥访问时使用 [Mutex](../system/mutex.md)。

---

## 1. `Flag::Atomic`

`Flag::Atomic` 内部使用 `std::atomic<uint32_t>` 保存状态，并提供以下常用接口：

- `Set()`：置位。
- `Clear()`：清零。
- `IsSet()`：查询当前是否已置位。
- `TestAndSet()`：先读取旧值，再写为 set。
- `TestAndClear()`：先读取旧值，再写为 clear。
- `Exchange(bool)`：写入新值并返回旧值。

该类型禁用拷贝构造与拷贝赋值，避免无意中复制状态对象。

适用场景：

- ISR 与线程之间共享“有新数据 / 正在发送 / 需要重试”等状态。
- 多线程之间共享一次性的状态标记。

---

## 2. `Flag::Plain`

`Flag::Plain` 提供与 `Flag::Atomic` 基本一致的接口，但内部只保存一个普通 `bool`。

特点：

- 没有原子语义；
- 不适合并发访问；
- 适合单线程环境，或外部已经有互斥 / 关中断 / 临界区保护的场景。

如果一个状态只在当前线程内部使用，或者访问边界已经由更上层同步原语控制，`Flag::Plain` 往往更直接。

---

## 3. `Flag::ScopedRestore<FlagT>`

`ScopedRestore` 是一个 RAII 辅助器：

- 构造时调用 `flag.Exchange(set_value)` 写入新值；
- 析构时自动恢复进入作用域前的旧值。

它要求 `FlagT` 至少提供：

```cpp
bool Exchange(bool set_value);
```

典型用途：

- 临时把“正在处理”标志置位，作用域结束后恢复；
- 防止函数中途 `return` 后忘记手动清理状态。

---

## 4. 使用示例

```cpp
#include <libxr.hpp>

LibXR::Flag::Atomic tx_busy;

if (!tx_busy.TestAndSet())
{
  // 第一次进入发送路径
  tx_busy.Clear();
}

LibXR::Flag::Plain in_callback;

{
  LibXR::Flag::ScopedRestore<LibXR::Flag::Plain> guard(in_callback, true);
  // 作用域内 in_callback 为 true
}
// 离开作用域后恢复到进入前的值
```

---

## 5. 选型建议

- 跨线程 / ISR 共享状态：优先用 `Flag::Atomic`。
- 单线程局部状态：优先用 `Flag::Plain`。
- 需要“进入作用域改写，退出自动恢复”：配合 `ScopedRestore` 使用。

需要互斥访问时，使用 [Mutex](../system/mutex.md) 或其他同步原语。
