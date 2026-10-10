---
id: core-assert
title: 断言与错误处理
sidebar_position: 2
---

# 断言与错误处理

`libxr_assert.hpp` 提供运行时检查与致命错误回调管理：`LibXR::Assert` 命名空间中的 fatal 回调函数，以及 `ASSERT`、`REQUIRE` 等检查宏。

## 致命错误处理接口

```cpp
extern "C" void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

断言失败时调用 `libxr_fatal_error()`，该函数不返回。在线程上下文（`in_isr` 为 `false`）中，若 `STDIO::write_` 已绑定且可写，先打印 `"Fatal error at <文件>:<行号>"`，再调用已注册的 fatal 回调（回调收到的 `in_isr` 为 `false`），然后休眠 500 ms 并重复，因此回调会被反复调用。`in_isr` 为 `true` 时只向地址 0 写入以触发硬件故障，不调用回调。

## `LibXR::Assert` 命名空间

当前公开的核心接口包括：

- `using FatalCallback = LibXR::Callback<const char*, uint32_t>`
- `RegisterFatalErrorCallback(cb)`
- `FatalErrorCallback()`
- `RunFatalErrorCallback(in_isr, file, line)`

### 注册回调

```cpp
LibXR::Assert::RegisterFatalErrorCallback(cb);
```

支持传入 `LibXR::Assert::FatalCallback`，也就是 `LibXR::Callback<const char*, uint32_t>` 类型的回调对象，用于处理致命错误事件。

## 宏定义：断言检查

| 宏 | 生效条件 | 关闭时 | 用途 |
| --- | --- | --- | --- |
| `ASSERT(expr)` / `ASSERT_FROM_CALLBACK(expr, in_isr)` | 定义 `LIBXR_DEBUG_BUILD`；未显式设置时按构建类型决定（Debug 开启），`-DLIBXR_DEBUG_BUILD=ON/OFF` 可在任何构建类型下覆盖 | 表达式仍求值，不检查 | 调用前提与配置检查 |
| `REQUIRE(expr)` / `REQUIRE_FROM_CALLBACK(expr, in_isr)` | 始终生效 | — | 不可恢复的运行错误 |
| `DEV_ASSERT(expr)` / `DEV_ASSERT_FROM_CALLBACK(expr, in_isr)` | CMake 选项 `LIBXR_DEV_ASSERT_BUILD=ON` | 表达式不求值 | LibXR 内部开发检查 |

失败时调用 `libxr_fatal_error(__FILE__, __LINE__, in_isr)`。不带 `_FROM_CALLBACK` 的版本传入 `in_isr = false`；`_FROM_CALLBACK` 版本在回调或 ISR 中使用，`in_isr` 原样传入。`ASSERT` 关闭时表达式仍会执行，必要操作应写在宏外。

## 用例示例

```cpp
using Arg = int;
Arg arg = 0;

auto err_cb = LibXR::Assert::FatalCallback::Create(
    [](bool in_isr, Arg arg, const char *file, uint32_t line)
    {
    (void)in_isr;
    (void)arg;
    (void)file;
    (void)line;
    // do something
    },
    arg);

LibXR::Assert::RegisterFatalErrorCallback(err_cb);

// buffer、in_isr 来自调用处的上下文
ASSERT(buffer != nullptr);
ASSERT_FROM_CALLBACK(buffer != nullptr, in_isr);
```
