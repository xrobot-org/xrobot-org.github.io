---
id: core-def
title: Common Definitions
sidebar_position: 1
---

# Common Definitions

`libxr_def.hpp` provides the basic macros, constants, error codes and generic template functions that the other LibXR headers build on.

## Math and Physical Constants

- `PI`, `TWO_PI`: π and 2π, commonly used in angle calculations.
- `STANDARD_GRAVITY`: Standard gravitational acceleration constant, with a value of `9.80665 m/s²`.

## Common Macros

- `DEF2STR(x)`: Converts a macro value to string.
- `UNUSED(x)`: Suppresses compiler warnings for unused variables.
- `LIBXR_NOINLINE`: Portability macro for disabling inlining.
- `LIBXR_PACKED_BEGIN` / `LIBXR_PACKED_END` / `LIBXR_PACKED`: packed-layout related macros.

## Alignment and Cache-Line Definitions

- `HW_CACHE_LINE_SIZE`: hardware cache-line size, 64 when pointers are 8 bytes, otherwise 32.
- `CONCURRENCY_ALIGNMENT`: alignment used by concurrent structures; `sizeof(size_t)` when `LIBXR_SINGLE_CORE` is true, otherwise `HW_CACHE_LINE_SIZE`. CMake defaults `LIBXR_SINGLE_CORE` to `OFF` on linux, webots and windows and to `ON` elsewhere.
- `CACHE_LINE_SIZE`: backward-compatible cache-line alias.
- `ALIGN_SIZE`: native platform alignment size, currently `sizeof(void*)`.

## Error Codes (`ErrorCode`)

The `ErrorCode` enum defines a unified error code system used to represent various operation results:

| Name           | Value | Meaning               |
| -------------- | ----- | --------------------- |
| `PENDING`      | 1     | Operation in progress |
| `OK`           | 0     | Operation succeeded   |
| `FAILED`       | -1    | Operation failed      |
| `INIT_ERR`     | -2    | Initialization error  |
| `ARG_ERR`      | -3    | Invalid argument      |
| `STATE_ERR`    | -4    | Invalid state         |
| `SIZE_ERR`     | -5    | Size mismatch         |
| `CHECK_ERR`    | -6    | Validation failed     |
| `NOT_SUPPORT`  | -7    | Feature not supported |
| `NOT_FOUND`    | -8    | Object not found      |
| `NO_RESPONSE`  | -9    | No response           |
| `NO_MEM`       | -10   | Insufficient memory   |
| `NO_BUFF`      | -11   | Insufficient buffer   |
| `TIMEOUT`      | -12   | Operation timeout     |
| `EMPTY`        | -13   | No data available     |
| `FULL`         | -14   | Data full             |
| `BUSY`         | -15   | Resource busy         |
| `PTR_NULL`     | -16   | Null pointer error    |
| `OUT_OF_RANGE` | -17   | Out of valid range    |

Convention: positive values usually indicate a non-terminal / in-progress state (for example `PENDING`), `0` means success, and negative values indicate a failure reason.

## Size Limit Modes (`SizeLimitMode`)

Used for runtime checks to validate data size:

- `EQUAL`: Must exactly match the reference value  
- `LESS`: Must be less than or equal to the reference  
- `MORE`: Must be greater than or equal to the reference  
- `NONE`: No size restriction

The size check function:

```cpp
constexpr bool SizeLimitCheck(SizeLimitMode mode, size_t limit, size_t size) noexcept;
```

This is a pure predicate only. It answers whether the requested size relation holds, but does not decide whether the caller should assert, abort, or return an error code.

## Assertion Macros

Provides unified runtime assertions:

- `ASSERT(x)`: Verifies the expression at runtime; triggers fatal error if false
- `ASSERT_FROM_CALLBACK(x, in_isr)`: for callbacks or ISRs; `in_isr` is passed to `libxr_fatal_error()`

These are only active when `LIBXR_DEBUG_BUILD` is defined. When triggered, the following function is called:

```cpp
void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

Assertion failures can be handled by a registered fatal callback (see Assertions and Error Handling).

## Generic Template Utilities

It also provides:

- `OffsetOf(member)` for member-offset computation via a member pointer;
- `ContainerOf(ptr, member)` for recovering the owning object pointer from a member pointer;
- concepts such as `MemberObjectPointer` and `CommonOrdered`.

These are used mainly by low-level containers and driver code to recover the owning object from a member pointer.

## Generic Template Functions

```cpp
template <typename LeftType, typename RightType>
  requires CommonOrdered<LeftType, RightType>
constexpr auto LibXR::max(LeftType a, RightType b) -> std::common_type_t<LeftType, RightType>;

template <typename LeftType, typename RightType>
  requires CommonOrdered<LeftType, RightType>
constexpr auto LibXR::min(LeftType a, RightType b) -> std::common_type_t<LeftType, RightType>;
```

Both arguments need a common type and must be comparable; the result has the common type, e.g. `LibXR::max(3, 4.5)` returns 4.5 (`double`).
