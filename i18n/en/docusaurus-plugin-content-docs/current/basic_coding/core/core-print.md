---
id: core-print
title: Compile-Time Formatting
sidebar_position: 8
---

# Compile-Time Formatting

`print.hpp` provides a compile-time formatting and output layer, independent of `STDIO`, under:

```cpp
namespace LibXR::Print
```

It is a shared compile-time formatting layer reused by:

- I/O paths such as `STDIO::Printf`
- `RuntimeStringView::Reformat / Reprintf`
- higher-level modules such as `Logger`

Two source-format frontends are supported:

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

So formatted output can go to real I/O, test sinks, memory buffers or strings.

---

## 2. Brace-style frontend: `LibXR::Format<Source>`

```cpp
constexpr LibXR::Format<"x={:+05d} {:x} {}"> format{};
```

`Format<Source>` parses a brace-style literal at compile time and provides:

- `ArgumentCount()` (static): how many call-site arguments are actually referenced
- `Matches<Args...>()` (static): whether a given argument-type list is compatible with the format
- `Compiled<Args...>`: the compiled result after binding concrete argument types
- `WriteTo(sink, args...)` (const member function): writes into an `OutputSink` and returns `ErrorCode`

With the CMake option `LIBXR_PRINT_ENABLE_EXPLICIT_ARGUMENT_INDEXING=1`, explicit argument reordering is supported (off by default; disabled use is a compile error):

```cpp
LibXR::Format<"{1} {0}">
```

but mixing automatic and manual indexing is a compile-time error.

---

## 3. printf-style frontend: `Print::Printf`

```cpp
constexpr auto format = LibXR::Print::Printf::Build<"%+05d %x %s">();
```

`Printf::Build<Source>()` parses a printf-style literal at compile time and returns a compiled-format object. Also provided:

- `Printf::Matches<Source, Args...>()`
- `Printf::Compiled<Source>`

Its failures are also pushed to compile time whenever possible, including:

- invalid conversion specifiers
- unsupported length modifiers
- dynamic width / precision using `*`
- mixing positional and sequential arguments
- format features disabled in the current configuration, e.g. the `#` flag needs `LIBXR_PRINT_ENABLE_ALTERNATE=1` (off by default)

> The current implementation is a compile-time literal path, not a traditional runtime `printf` parser for arbitrary format strings.

---

## 4. Public output APIs

### 4.1 Write into any sink

Convenience wrappers:

- `ErrorCode Write(sink, format, args...)`
- `ErrorCode FormatTo(sink, format, args...)`
- `ErrorCode FormatTo<"...">(sink, args...)`
- `ErrorCode PrintfTo<"...">(sink, args...)`

These sink-writing paths return only sink-side `ErrorCode`, not a written-length value.

### 4.2 Write into a bounded char buffer

Bounded-buffer helpers:

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
constexpr LibXR::Format<"x={:+05d} {:x} {}"> format{};
ErrorCode ec = LibXR::Print::FormatTo(sink, format, 7, 42U, "ok");  // "x=+0007 2a ok"
```

### 5.2 printf-style output to a sink

```cpp
Sink sink;
ErrorCode ec = LibXR::Print::PrintfTo<"%+05d %x %s">(sink, 7, 42U, "ok");  // "+0007 2a ok"
```

### 5.3 Output to a bounded char buffer

```cpp
char buffer[16] = {};
int written = LibXR::Print::PrintfIntoBuffer<"%d %s">(buffer, sizeof(buffer), 123, "xy");  // written == 6, buffer == "123 xy"
```

If `buffer` is too small, `written` still reports the full text length, while `buffer` keeps only the first `capacity - 1` visible characters and appends `\0` automatically.

---

## 6. Relationship to `STDIO::Printf`

`STDIO::Printf` is one upper-layer entry point, but it is not the whole formatting system.

The relationship is:

- `Print` provides compile-time format parsing and output contracts
- `STDIO::Printf` reuses that layer and sends the result to the global `STDIO` write endpoint
- `RuntimeStringView` also reuses it, but retains the result inside its own string storage

Use `STDIO::Printf` from [core-rw](./core-rw.md) for debug text on the global output; use the `Print::*` APIs on this page to write into a custom sink or a bounded buffer.
