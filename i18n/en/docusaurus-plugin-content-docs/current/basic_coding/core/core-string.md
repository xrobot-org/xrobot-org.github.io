---
id: core-string
title: Fixed-Length String
sidebar_position: 5
---

# Fixed-Length String

Current mainline string-related interfaces fall mainly into two groups:

- `LibXR::String<N>`: fixed-capacity, value-semantics string objects
- `LibXR::RuntimeStringView<...>`: runtime-built retained NUL-terminated string views

The first group fits small fixed-capacity string values. The second fits retained names or formatted results such as module names, topic names, and runtime-generated identifiers.

## Feature Overview

- **Fixed Length**: The maximum length is specified via the template parameter `MaxLength`. Internally, it uses `std::array<char, MaxLength+1>` and is always null-terminated (`\0`).
- **Safe Operations**: Most methods include boundary checks and assertions to prevent out-of-bounds access.
- **C-Style String Compatible**: Supports construction from `const char*` or strings with a specified length. The `Raw()` method retrieves the underlying string.
- **Appending and Searching**: Supports `+=` for appending and `Find()` for substring search.
- **Full Comparison Operators**: Supports `==`, `!=`, `<`, `>`, `<=`, `>=`, including comparisons between different `String<N>` lengths.

## Usage Example

```cpp
LibXR::String<32> s1("hello");
s1 += " world";
int idx = s1.Find("lo");  // returns 3
auto sub = s1.Substr<5>(6);  // extracts 5 characters starting from index 6
```

```cpp
LibXR::RuntimeStringView<"camera_{}", unsigned int> name;
name.Reformat(7U);
// name.View() == "camera_7"
```

## API Reference

### Constructors

- `String()` – Constructs an empty string.
- `String(const char* str)` – Constructs from a C-style string.
- `String(const char* str, size_t len)` – Constructs from a string with a specified length.

### Basic Methods

- `const char* Raw() const` – Returns the underlying C-style string.
- `size_t Length() const` – Returns the current string length.
- `void Clear()` – Clears the string.
- `int Find(const char* str) const` – Finds the position of a substring; returns -1 if not found.
- `template <unsigned int SubStrLength> String<SubStrLength> Substr(size_t pos) const` – Extracts a substring starting at a given position.

### Operators

- `+=` – Appends a C-style string.
- `[]` – Accesses characters by index (with boundary assertion).
- Comparison operators – `==`, `!=`, `<`, `>`, `<=`, `>=` are supported across `String<N>` of different lengths.

## `RuntimeStringView`

`RuntimeStringView<Source, Args...>` is the other public string capability in current mainline, defined in `libxr_string.hpp`.

Its main purpose is:

- retaining one runtime-generated NUL-terminated text value
- exposing it repeatedly through `View()` / `CStr()`
- allocating capacity once from a compile-time upper bound on the first formatted rewrite, then reusing that same storage

### Two construction paths

1. **Plain text copy / concatenation path**

```cpp
LibXR::RuntimeStringView<> topic_name("camera/front");
LibXR::RuntimeStringView<> path("/dev/", "ttyUSB0");
```

This path accepts text-like inputs only. If you need numeric formatting, do not use the plain concatenation constructor.

2. **Formatted rewrite path**

```cpp
LibXR::RuntimeStringView<"camera_{}", unsigned int> name;
name.Reformat(7U);

LibXR::RuntimeStringView<"frame_%03u", unsigned int> frame;
frame.Reprintf(5U);
```

- `Reformat(...)` uses brace-style formatting
- `Reprintf(...)` uses printf-style formatting
- the current implementation requires the rewrite call argument types to match the template-bound `Args...` exactly

### Current mainline semantic boundaries

- Formatted `RuntimeStringView` arguments currently accept only value types whose capacity can be bounded statically; runtime string arguments are rejected and should use the plain `RuntimeStringView<>` concatenation path instead.
- The current implementation **does not free allocated storage in the object destructor**. Its design target is a retained string view with one allocation and repeated reuse, not a short-lived auto-releasing text container.
- `Status()` reports the result of the latest construction or rewrite; on failure, the visible text is cleared to an empty string.

### Common access APIs

- `std::string_view View() const`
- `const char* CStr() const`
- `size_t Size() const`
- `bool Empty() const`
- `ErrorCode Status() const`

If you need deterministic capacity, value semantics, and ordinary object-style string lifetime, prefer `String<N>`. If you need a retained runtime name or a repeatedly rewritten formatted result, `RuntimeStringView` is the closer match to current mainline design.
