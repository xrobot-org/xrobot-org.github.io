---
id: core-def
title: 公共定义
sidebar_position: 1
---

# 公共定义

本模块提供 LibXR 中最基础的宏、常量、错误码及通用模板函数，广泛用于其他模块的实现。它避免平台差异、简化编码，并为调试与运行时检查提供基础设施。

## 数学与物理常量

- `PI`, `TWO_PI`: 圆周率及其两倍，常用于角度计算。
- `STANDARD_GRAVITY`: 标准重力加速度常量，值为 `9.80665 m/s²`。

## 常用宏定义

- `DEF2STR(x)`: 将宏值转为字符串。
- `UNUSED(x)`: 用于消除未使用变量的编译器警告。
- `LIBXR_NOINLINE`: 禁止内联的兼容性宏。
- `LIBXR_PACKED_BEGIN` / `LIBXR_PACKED_END` / `LIBXR_PACKED`: 结构体紧凑布局相关宏。

## 对齐与缓存行定义

- `HW_CACHE_LINE_SIZE`: 硬件缓存行大小，64 位平台通常为 64 字节，32 位平台通常为 32 字节。
- `CONCURRENCY_ALIGNMENT`: 并发结构使用的对齐粒度；单核与多核配置下可能不同。
- `CACHE_LINE_SIZE`: 面向旧代码保留的缓存行别名。
- `ALIGN_SIZE`: 平台自然对齐大小，当前取 `sizeof(void*)`。

## 错误码定义（`ErrorCode`）

枚举类型 `ErrorCode` 定义了统一的错误码系统，用于表示各类操作结果：

| 名称           | 值  | 含义         |
| -------------- | --- | ------------ |
| `PENDING`      | 1   | 操作进行中   |
| `OK`           | 0   | 操作成功     |
| `FAILED`       | -1  | 操作失败     |
| `INIT_ERR`     | -2  | 初始化错误   |
| `ARG_ERR`      | -3  | 参数错误     |
| `STATE_ERR`    | -4  | 状态错误     |
| `SIZE_ERR`     | -5  | 尺寸错误     |
| `CHECK_ERR`    | -6  | 校验失败     |
| `NOT_SUPPORT`  | -7  | 功能不支持   |
| `NOT_FOUND`    | -8  | 未找到对象   |
| `NO_RESPONSE`  | -9  | 无响应       |
| `NO_MEM`       | -10 | 内存不足     |
| `NO_BUFF`      | -11 | 缓冲区不足   |
| `TIMEOUT`      | -12 | 操作超时     |
| `EMPTY`        | -13 | 数据为空     |
| `FULL`         | -14 | 数据已满     |
| `BUSY`         | -15 | 资源忙碌中   |
| `PTR_NULL`     | -16 | 空指针错误   |
| `OUT_OF_RANGE` | -17 | 超出有效范围 |

约定：正值通常用于表示“非终态/进行中”（例如 `PENDING`），0 表示成功，负值表示失败原因。

## 尺寸限制模式（`SizeLimitMode`）

用于运行时检查尺寸是否符合要求：

- `EQUAL`: 必须等于参考值  
- `LESS`: 小于或等于参考值  
- `MORE`: 大于或等于参考值  
- `NONE`: 不限制尺寸

当前主线还直接提供：

```cpp
constexpr bool SizeLimitCheck(SizeLimitMode mode, size_t limit, size_t size) noexcept;
```

它是一个纯判断函数，只回答“尺寸关系是否成立”，不替调用方决定应该断言、终止还是返回错误码。

## 断言宏

提供统一的运行时断言机制：

- `ASSERT(x)`: 在调试模式下检查表达式是否为真，否则触发致命错误
- `ASSERT_FROM_CALLBACK(x, in_isr)`: 用于回调上下文的断言检查

在 `LIBXR_DEBUG_BUILD` 编译宏启用时生效，触发时会调用：

```cpp
void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

可通过注册回调处理断言失败行为（详见 `libxr_assert.hpp`）。

## 通用模板工具

除基础枚举与常量外，当前主线还直接提供：

- `OffsetOf(member)`：通过成员指针计算成员偏移量；
- `ContainerOf(ptr, member)`：通过成员指针恢复所属对象指针；
- `MemberObjectPointer` / `CommonOrdered` 这类 concept 约束。

这些接口当前主要服务于底层容器、驱动胶水层和零 RTTI 的对象回溯路径。

## 通用模板函数

```cpp
template <typename T1, typename T2>
constexpr auto LibXR::max(T1 a, T2 b) -> common_type<T1, T2>::type;

template <typename T1, typename T2>
constexpr auto LibXR::min(T1 a, T2 b) -> common_type<T1, T2>::type;
```

用于计算任意类型的最大/最小值，支持整数、浮点等常见数值类型。
