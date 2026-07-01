---
id: core-assert
title: 断言与错误处理
sidebar_position: 2
---

# 断言与错误处理

本模块用于运行时错误检查与致命错误回调管理。当前公开接口核心是 `LibXR::Assert` 命名空间中的 fatal callback 管理函数，以及 `ASSERT` / `ASSERT_FROM_CALLBACK` 这些宏。

## 致命错误处理接口

```cpp
extern "C" void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

该函数用于终止程序执行，可在正常或回调上下文中调用。发生断言失败时将自动调用，并可通过 `LibXR::Assert` 命名空间中的回调注册接口处理。

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

说明：当前尺寸关系判断本身在 `libxr_def.hpp` 中以 `constexpr bool SizeLimitCheck(...)` 的形式公开，而不是在这里再单独定义一个调试专用静态类接口。

## 宏定义：断言检查

- `ASSERT(expr)`: 普通上下文断言，失败时调用 `libxr_fatal_error(...)`
- `ASSERT_FROM_CALLBACK(expr, in_isr)`: 回调上下文断言

这些宏由 `LIBXR_DEBUG_BUILD` 控制是否启用，建议用于调试、开发阶段的防御性编程。

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

ASSERT(buffer != nullptr);
ASSERT_FROM_CALLBACK(buffer != nullptr, in_isr);
```

---

断言与校验逻辑建议在系统开发初期即集成并启用。
