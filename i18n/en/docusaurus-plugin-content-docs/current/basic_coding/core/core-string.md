---
id: core-string
title: Runtime String
sidebar_position: 6
---

# Runtime String

`libxr_string.hpp` provides `LibXR::RuntimeStringView<Source, Args...>`, a runtime-built, retained NUL-terminated string for module names, topic names and runtime-formatted results that are built once or rewritten repeatedly.

- The text is kept in internal storage and can be read repeatedly through `View()` / `CStr()`.
- A formatted instance allocates capacity from a compile-time upper bound before its first rewrite and reuses that storage.

## Two construction paths

1. Plain text copy / concatenation

```cpp
LibXR::RuntimeStringView<> topic_name("camera/front");
LibXR::RuntimeStringView<> path("/dev/", "ttyUSB0");
```

This path accepts text inputs only; numbers go through the rewrite path below. Character pointers must reference valid NUL-terminated strings.

2. Formatted rewrite

```cpp
LibXR::RuntimeStringView<"camera_{}", unsigned int> name;
if (name.Reformat(7U) != LibXR::ErrorCode::OK) {
  // handle the failure
}
// name.View() == "camera_7"

LibXR::RuntimeStringView<"frame_%03u", unsigned int> frame;
if (frame.Reprintf(5U) != LibXR::ErrorCode::OK) {
  // handle the failure
}
// frame.View() == "frame_005"
```

- `Reformat(...)` uses brace-style formatting.
- `Reprintf(...)` uses printf-style formatting.
- The argument types of a rewrite call must match `Args...` exactly.

## Semantics

- Formatted arguments must be value types with a statically bounded size; runtime string arguments are rejected at compile time, and text concatenation uses the plain `RuntimeStringView<>` constructors.
- The destructor does not free the allocated storage; the type suits names and formatted results allocated once and reused.
- `Status()` reports the latest construction or rewrite result; after a failure the visible text is empty.
- Copy construction and all assignments are deleted; move construction takes over the storage and leaves the source empty.

## Common access APIs

- `std::string_view View() const`
- `const char* CStr() const`
- `size_t Size() const`
- `bool Empty() const`
- `ErrorCode Status() const`
- Implicit conversion to `std::string_view` and `const char*`.
