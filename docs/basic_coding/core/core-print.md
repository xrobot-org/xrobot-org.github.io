---
id: core-print
title: 编译期格式化输出
sidebar_position: 10
---

# 编译期格式化输出

`print.hpp` 在当前主线中提供了一套独立于 `STDIO` 的编译期格式化输出接口，命名空间为：

```cpp
namespace LibXR::Print
```

它的定位不是“某个设备驱动”，而是一层通用的格式编译与输出包装，可被：

- `STDIO::Printf` 等 I/O 路径复用；
- `RuntimeStringView::Reformat / Reprintf` 复用；
- `Logger` 等上层模块复用。

当前主线同时支持两套源格式前端：

- brace 风格：`LibXR::Format<"...">`
- printf 风格：`LibXR::Print::Printf::Build<"...">()`

---

## 1. 输出端契约 `OutputSink`

`LibXR::Print` 的写出目标不是固定为串口或终端，而是任何满足 `OutputSink` 概念的对象。

当前约束很简单：

```cpp
ErrorCode Write(std::string_view text);
```

也就是说，只要某个对象提供 `Write(std::string_view)` 且返回值可转换为 `ErrorCode`，它就可以作为打印输出端。

这也是为什么当前主线既能把格式化结果写到真实 I/O，也能写到测试用 sink、内存缓冲或字符串拼接器。

---

## 2. brace 风格前端：`LibXR::Format<Source>`

```cpp
constexpr LibXR::Format<"x={:+05d} {:#x} {}"> format{};
```

`Format<Source>` 会在编译期解析 brace 风格字面量，并暴露出当前主线使用的几类静态接口：

- `ArgumentCount()`：该源串实际引用了多少个调用点参数。
- `Matches<Args...>()`：给定参数类型列表是否与格式兼容。
- `Compiled<Args...>`：把具体参数类型绑定到这条格式后的编译结果。
- `WriteTo(sink, args...)`：直接写入一个 `OutputSink`。

当前主线还支持显式参数重排，如：

```cpp
LibXR::Format<"{1} {0}">
```

但自动索引与手动索引混用在当前实现中会在编译期报错。

---

## 3. printf 风格前端：`Print::Printf`

```cpp
constexpr auto format = LibXR::Print::Printf::Build<"%+05d %#x %s">();
```

`Printf::Build<Source>()` 会在编译期解析 printf 风格字面量，并返回一个编译结果对象。当前主线也提供：

- `Printf::Matches<Source, Args...>()`
- `Printf::Compiled<Source>`

它的错误同样尽量在编译期暴露，例如：

- 非法转换说明符
- 不支持的长度修饰
- 动态宽度 / 精度 `*`
- 位置参数与顺序参数混用

> 当前实现支持的是“编译期已知字面量”路径，不是运行时传入任意格式串再动态解析的传统 `printf` 接口。

---

## 4. 公开写出接口

### 4.1 写到任意 sink

当前主线公开了以下便捷包装：

- `ErrorCode Write(sink, format, args...)`
- `ErrorCode FormatTo(sink, format, args...)`
- `ErrorCode FormatTo<"...">(sink, args...)`
- `ErrorCode PrintfTo<"...">(sink, args...)`

这几条接口都只返回 sink 侧的 `ErrorCode`，不返回写入长度。

### 4.2 写到有界字符缓冲区

当前主线还公开了几条 bounded-buffer 包装：

- `int FormatIntoBuffer(buffer, capacity, format, args...)`
- `int FormatIntoBuffer<"...">(buffer, capacity, args...)`
- `int PrintfIntoBuffer<"...">(buffer, capacity, args...)`
- `int SNPrintf(buffer, capacity, format, args...)`
- `int SNPrintf<"...">(buffer, capacity, args...)`

返回值契约与当前实现一致：

- 成功时返回**完整格式化长度**，不含结尾 `\0`；
- 即使发生截断，返回值仍然是未截断时的完整长度；
- 运行期错误或长度超出 `int` 可表示范围时返回 `-1`；
- 当 `capacity > 0` 时，目标缓冲区始终保持 NUL 结尾。

这一点更接近 `snprintf` 语义，而不是“返回实际写入长度”。

---

## 5. 使用示例

### 5.1 brace 风格写到 sink

```cpp
struct Sink
{
  ErrorCode Write(std::string_view text)
  {
    // 写入串口、字符串缓存或其他目标
    return ErrorCode::OK;
  }
};

Sink sink;
constexpr LibXR::Format<"x={:+05d} {:#x} {}"> format{};
LibXR::Print::FormatTo(sink, format, 7, 42U, "ok");
```

### 5.2 printf 风格写到 sink

```cpp
Sink sink;
LibXR::Print::PrintfTo<"%+05d %#x %s">(sink, 7, 42U, "ok");
```

### 5.3 写到有界字符缓冲区

```cpp
char buffer[16] = {};
int written = LibXR::Print::PrintfIntoBuffer<"%d %s">(buffer, sizeof(buffer), 123, "xy");
```

若 `buffer` 太小，`written` 仍表示完整文本长度，而 `buffer` 中只保留前 `capacity - 1` 个可见字符并自动补 `\0`。

---

## 6. 与 `STDIO::Printf` 的关系

`STDIO::Printf` 是上层 I/O 使用入口之一，但不是这套格式化能力的全部。

当前关系更准确地说是：

- `Print` 负责编译期格式解析与写出契约；
- `STDIO::Printf` 复用这套能力，把结果送到全局 `STDIO` 写端；
- `RuntimeStringView` 也复用这套能力，把结果保留到内部字符串缓冲区。

如果你只是想把调试文本发到全局输出，使用 [core-rw](./core-rw.md) 中的 `STDIO::Printf` 最直接；如果你需要把格式结果写到自定义 sink 或内存缓冲区，则应直接使用本页这组 `Print::*` 接口。
