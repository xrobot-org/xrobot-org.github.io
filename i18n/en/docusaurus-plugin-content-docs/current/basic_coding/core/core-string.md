---
id: core-string
title: Fixed-Length String
sidebar_position: 5
---

# RuntimeStringView

The current public runtime string utility is `LibXR::RuntimeStringView<...>` from `libxr_string.hpp`. The older `String<N>` API has been removed from current source.

`RuntimeStringView` is intended for module names, topic names, device paths, and formatted text that is created during initialization or on first formatting and then retained. It stores NUL-terminated text and reuses prepared storage for later rewrites.

## Plain text construction

```cpp
LibXR::RuntimeStringView<> topic_name("camera/front");
LibXR::RuntimeStringView<> path("/dev/", "ttyUSB0");
```

This path copies/concatenates text. Character pointers must reference valid NUL-terminated strings.

## Formatted rewrites

```cpp
LibXR::RuntimeStringView<"camera_{}", unsigned int> name;
name.Reformat(7U);

LibXR::RuntimeStringView<"frame_%03u", unsigned int> frame;
frame.Reprintf(5U);
```

- `Reformat(...)` uses brace formatting;
- `Reprintf(...)` uses printf-style formatting;
- rewrite argument types match template `Args...`;
- runtime strings are not formatted arguments; concatenate runtime text through the plain-text path.

## Common accessors

- `std::string_view View() const`
- `const char* CStr() const`
- `size_t Size() const`
- `bool Empty() const`
- `ErrorCode Status() const`

A formatting failure clears the visible string; check the result or `Status()`.

## Storage semantics

Formatted storage is prepared from a compile-time capacity bound and reused on later rewrites. Destruction currently does not free allocated storage, so the type is aimed at long-lived retained names/text rather than a short-lived general-purpose string container.

Use a standard-library owning string for ordinary automatic reclamation, or an application-owned fixed character array with `Print::*IntoBuffer()` when fixed capacity is required.
