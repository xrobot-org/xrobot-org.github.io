---
id: con-guide-coding-style
title: Code Style
sidebar_position: 5
---

# Code Style

This page summarizes the C++ code style currently used in the repository. For Python code, see [Python Code Style](./coding_style_python.md).

## Naming

- Types, classes, structs, enum types, and member functions use `PascalCase`.

```cpp
class Logger
{
 public:
  static void Init();
};
```

- Local variables, function parameters, and data members use `snake_case`. Data members end with `_`.

```cpp
static inline bool initialized_ = false;
```

- Macros, error codes, log macros, and enum values stay uppercase.

```cpp
#define ASSERT(arg) ...
#define XR_LOG_INFO(fmt, ...)

enum class ErrorCode : int8_t
{
  OK = 0,
  BUSY = -15,
  OUT_OF_RANGE = -17
};
```

## Namespaces and Type Aliases

- Namespaces use `Allman` style, with an end comment retained.

```cpp
namespace LibXR
{
}

}  // namespace LibXR
```

- Prefer `using` for type aliases. Existing `typedef` declarations stay as they are.

```cpp
using Callback = LibXR::Callback<uint32_t>;
typedef RBTree<uint32_t>::Node<Block>* TopicHandle;
```

## File Organization

- In `.cpp` files, include the corresponding header first, then system headers, then project headers.

```cpp
#include "async.hpp"

#include "libxr_def.hpp"
#include "thread.hpp"
```

- Keep existing include order in headers. Do not reorder includes just for cleanup.

```cpp
#include "async.hpp"
#include "database.hpp"
#include "event.hpp"
```

- Headers use `#pragma once`.

```cpp
#pragma once
```

## Layout

- Use `Allman` brace style.

```cpp
class Thread
{
 public:
  enum class Priority : uint8_t
  {
    IDLE,
    LOW,
    MEDIUM
  };
};
```

- Line breaking and wrapping follow the repository `.clang-format`; the current base is `Google` with `ColumnLimit = 90`.

- Existing local spacing and blank lines may be kept where they improve readability.

- Access specifiers are not indented further. Members are indented two spaces relative to the class body.

```cpp
class Logger
{
 public:
  static void Init();

 private:
  static inline bool initialized_ = false;
};
```

## Declarations and Definitions

- Short functions may be defined inline in the class body. Longer functions stay expanded.

```cpp
~LockGuard() { mutex_.Unlock(); }

static void Sleep(uint32_t milliseconds);
```

- `constexpr`, `static constexpr`, and `static inline` follow the existing style.

```cpp
static constexpr size_t LIBXR_CACHE_LINE_SIZE = (sizeof(void*) == 8) ? 64 : 32;
static inline bool initialized_ = false;
```

- `explicit`, `operator`, and `[[nodiscard]]` use their normal declaration positions.

```cpp
explicit DatabaseRawSequential(Flash& flash, size_t max_buffer_size = 256);
[[nodiscard]] ErrorCode TryLock();
operator uint64_t() const;
```

- Pointer and reference spacing follows the local file style. The repository contains both `const char*` and `const char *`; do not widen a diff just to unify them.

## Comments

- Public headers continue to use the existing `Doxygen` style.

```cpp
/**
 * @brief Publish a log message
 * @param level Log level
 * @param file Source file name
 */
```

- Comments describe semantics, parameters, and boundary conditions. Do not record trial-and-error history.

- Public header comments are often bilingual. New interfaces should follow the style already used in the surrounding file.

- Simple local notes use short line comments.

```cpp
// create thread
int ans = pthread_create(&this->thread_handle_, &attr, ThreadBlock::Port, block);
```

## Macros and Exceptions

- Keep low-level helper macros in their existing macro form.

```cpp
#define UNUSED(_x) ((void)(_x))
#define CONTAINER_OF(ptr, type, member) \
  ((type*)((char*)(ptr) - OFFSET_OF(type, member)))  // NOLINT
```

- Apply `NOLINT` only at the exact location that needs it.

```cpp
// NOLINTNEXTLINE
static void Publish(LogLevel level, const char* file, uint32_t line, const char* fmt,
                    ...);
```

- Conditional compilation stays explicit.

```cpp
#if defined(LIBXR_SYSTEM_Linux) || defined(LIBXR_SYSTEM_Webots)
#include "linux_shared_topic.hpp"
#endif
```

- Keep `extern "C"`, attributes, and platform macros in the existing direct style.

```cpp
extern "C" __attribute__((weak)) void vApplicationStackOverflowHook(...);
```

## Test Code

- Code under `test/` may be more direct than public headers. Local macros, array literals, and compact test-driver code are acceptable there.

```cpp
#define TEST_STEP(_arg)                                \
  do                                                   \
  {                                                    \
    test_name = _arg;                                  \
  } while (0)
```

- Naming, brace style, and basic layout still follow the same conventions as the main code.
- Where tests go, what they check and how to confirm that every test is needed: see [Testing](./testing.md).

## clang-format

- The repository has a root `.clang-format`.
- CI uses `clang-format 21.1.8`. The check entry is:

```bash
tools/format_cpp_files.sh --check
```

- By default it checks C/C++ files under `driver/`, `src/`, `system/`, and `test/`; specific files can also be passed to the script.
