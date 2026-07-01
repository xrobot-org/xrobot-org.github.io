---
id: core-print
title: Compile-Time Formatting
sidebar_position: 9
---

# Compile-Time Formatting

`print.hpp` provides a formatting and output layer in current mainline that is independent from `STDIO`, under:

```cpp
namespace LibXR::Print
```

It is a shared compile-time formatting surface that can be reused by:

- I/O paths such as `STDIO::Printf`
- `RuntimeStringView::Reformat / Reprintf`
- higher-level modules such as `Logger`

Current mainline supports two source-format frontends:

- brace style: `LibXR::Format<"...">`
- printf style: `LibXR::Print::Printf::Build<"...">()`

---

## 1. Output sink contract: `OutputSink`

`LibXR::Print` does not hardcode one target such as UART or terminal output. Instead, it writes to any object satisfying the `OutputSink` concept.

The current requirement is simple:

```cpp
ErrorCode Write(std::string_view text);
```

So any object that provides `Write(std::string_view)` and returns something convertible to `ErrorCode` can be used as a print sink.

This is why current mainline can write formatted output both to real I/O and to test sinks, memory buffers, or retained string builders.

---

## 2. Brace-style frontend: `LibXR::Format<Source>`

```cpp
constexpr LibXR::Format<"x={:+05d} {:#x} {}"> format{};
```

`Format<Source>` parses a brace-style literal at compile time and exposes several static interfaces used in current mainline:

- `ArgumentCount()`: how many call-site arguments are actually referenced
- `Matches<Args...>()`: whether a given argument-type list is compatible with the format
- `Compiled<Args...>`: the compiled result after binding concrete argument types
- `WriteTo(sink, args...)`: direct output into an `OutputSink`

Current mainline also supports explicit argument reordering, for example:

```cpp
LibXR::Format<"{1} {0}">
```

but mixing automatic and manual indexing is a compile-time error.

---

## 3. printf-style frontend: `Print::Printf`

```cpp
constexpr auto format = LibXR::Print::Printf::Build<"%+05d %#x %s">();
```

`Printf::Build<Source>()` parses a printf-style literal at compile time and returns a compiled-format object. Current mainline also provides:

- `Printf::Matches<Source, Args...>()`
- `Printf::Compiled<Source>`

Its failures are also pushed to compile time whenever possible, including:

- invalid conversion specifiers
- unsupported length modifiers
- dynamic width / precision using `*`
- mixing positional and sequential arguments

> The current implementation is a compile-time literal path, not a traditional runtime `printf` parser for arbitrary format strings.

---

## 4. Public output APIs

### 4.1 Write into any sink

Current mainline exposes these convenience wrappers:

- `ErrorCode Write(sink, format, args...)`
- `ErrorCode FormatTo(sink, format, args...)`
- `ErrorCode FormatTo<"...">(sink, args...)`
- `ErrorCode PrintfTo<"...">(sink, args...)`

These sink-writing paths return only sink-side `ErrorCode`, not a written-length value.

### 4.2 Write into a bounded char buffer

Current mainline also exposes bounded-buffer helpers:

- `int FormatIntoBuffer(buffer, capacity, format, args...)`
- `int FormatIntoBuffer<"...">(buffer, capacity, args...)`
- `int PrintfIntoBuffer<"...">(buffer, capacity, args...)`
- `int SNPrintf(buffer, capacity, format, args...)`
- `int SNPrintf<"...">(buffer, capacity, args...)`

Their return contract matches the current implementation:

- success returns the **full formatted length**, excluding the trailing `\0`
- even when truncation happens, the return value still reports the full untruncated length
- runtime error or length overflow beyond `int` returns `-1`
- when `capacity > 0`, the destination buffer is always kept NUL-terminated

That is much closer to `snprintf` semantics than to “actual retained length”.

---

## 5. Examples

### 5.1 Brace-style output to a sink

```cpp
struct Sink
{
  ErrorCode Write(std::string_view text)
  {
    // write to UART, a string cache, or another target
    return ErrorCode::OK;
  }
};

Sink sink;
constexpr LibXR::Format<"x={:+05d} {:#x} {}"> format{};
LibXR::Print::FormatTo(sink, format, 7, 42U, "ok");
```

### 5.2 printf-style output to a sink

```cpp
Sink sink;
LibXR::Print::PrintfTo<"%+05d %#x %s">(sink, 7, 42U, "ok");
```

### 5.3 Output to a bounded char buffer

```cpp
char buffer[16] = {};
int written = LibXR::Print::PrintfIntoBuffer<"%d %s">(buffer, sizeof(buffer), 123, "xy");
```

If `buffer` is too small, `written` still reports the full text length, while `buffer` keeps only the first `capacity - 1` visible characters and appends `\0` automatically.

---

## 6. Relationship to `STDIO::Printf`

`STDIO::Printf` is one upper-layer entry point, but it is not the whole formatting system.

The current relationship is more accurately:

- `Print` provides compile-time format parsing and output contracts
- `STDIO::Printf` reuses that layer and sends the result to the global `STDIO` write endpoint
- `RuntimeStringView` also reuses it, but retains the result inside its own string storage

If you only want to emit debug text through the global output, `STDIO::Printf` from [core-rw](./core-rw.md) is the most direct choice. If you want to write formatted output into a custom sink or a bounded memory buffer, use the `Print::*` APIs on this page directly.
