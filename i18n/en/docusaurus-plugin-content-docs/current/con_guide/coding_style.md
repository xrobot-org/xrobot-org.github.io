---
id: con-guide-coding-style
title: Code Style
sidebar_position: 5
---

# Code Style

This page summarizes the C++ code style currently used in the LibXR repository. Module and BSP repositories follow the same naming and layout; CI does not check their C++ formatting, and a BSP with its own `.clang-format` is formatted with that file. Vendor and platform code under `driver/` and `system/` is not required to follow the naming rules below. For Python code, see [Python Code Style](./coding_style_python.md).

## Naming

- Types, classes, structs, enum types, member functions, and free functions use `PascalCase`.

```cpp
class Logger
{
 public:
  static void Init();
};
```

- Local variables, function parameters, and data members use `snake_case`. Data members end with `_`.

```cpp
static inline bool ready_ = false;
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
// ...
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
#include "raw_sequential.hpp"

#include <cstddef>
#include <cstdint>

#include "libxr_def.hpp"
#include "libxr_mem.hpp"
```

- clang-format groups and sorts includes (`IncludeBlocks: Regroup`); within a group they are in alphabetical order.

```cpp
#include "async.hpp"
#include "database.hpp"
#include "double_buffer.hpp"
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

- At most one consecutive blank line is kept; all other layout follows clang-format. A passage that must keep its manual layout is wrapped in `// clang-format off` and `// clang-format on`.

- Access specifiers are not indented further. Members are indented two spaces relative to the class body.

```cpp
class Timebase
{
 public:
  // ...
  [[nodiscard]] static bool IsReady() noexcept { return ready_; }
  // ...

 private:
  // ...
  static inline bool ready_ = false;
};
```

## Declarations and Definitions

- Short functions may be defined inline in the class body. Longer functions stay expanded.

```cpp
~LockGuard() { mutex_.Unlock(); }

static void Sleep(uint32_t milliseconds);
```

- `inline constexpr`, `static constexpr`, and `static inline` follow the existing style.

```cpp
inline constexpr size_t HW_CACHE_LINE_SIZE = (sizeof(void*) == 8) ? 64 : 32;
static inline bool ready_ = false;
```

- `explicit`, `operator`, and `[[nodiscard]]` use their normal declaration positions.

```cpp
explicit DatabaseRawSequential(Flash& flash, size_t max_buffer_size = 256);
[[nodiscard]] ErrorCode TryLock();
operator uint64_t() const { return microsecond_; }
```

- `*` and `&` bind to the type: `const char* name`, `Flash& flash` (`PointerAlignment: Left` from the Google style).

## Comments

- Public headers continue to use the existing `Doxygen` style.

```cpp
/**
 * @brief 发布一条字面量日志 / Publish one literal log message
 * @param level 日志级别 / Log level
 * @param file 来源文件名 / Source file name
 * @param line 行号 / Line number
 * @param args 格式参数 / Format arguments
 */
```

- Comments describe semantics, parameters, and boundary conditions. Do not record trial-and-error history or step-by-step narration.

- Public header comments are often bilingual. New interfaces should follow the style already used in the surrounding file.

- Simple local notes use short line comments without colloquial sentences.

```cpp
// 创建线程
int ans = pthread_create(&this->thread_handle_, &attr, ThreadBlock::Port, block);
```

## Macros and Exceptions

- New helper constants and functions are preferably `constexpr` constants or template functions. Excerpt from `src/core/libxr_def.hpp`:

```cpp
inline constexpr size_t HW_CACHE_LINE_SIZE = (sizeof(void*) == 8) ? 64 : 32;

// ...

template <typename OwnerType, typename MemberType>
  requires MemberObjectPointer<OwnerType, MemberType>
[[nodiscard]] inline OwnerType* ContainerOf(MemberType* ptr,
                                            MemberType OwnerType::* member) noexcept
{
  return reinterpret_cast<OwnerType*>(reinterpret_cast<std::byte*>(ptr) -
                                      OffsetOf(member));
}
```

- Macros are used only where the preprocessor is needed, for example `UNUSED` and definitions that switch on the compiler. Excerpt from the same file:

```cpp
#ifndef UNUSED
/// \brief 用于抑制未使用变量的警告 / Macro to suppress unused variable warnings
#define UNUSED(_x) ((void)(_x))
#endif

// ...

#if defined(_MSC_VER)
#define LIBXR_NOINLINE __declspec(noinline)
// ...
#elif defined(__clang__) || defined(__GNUC__)
#define LIBXR_NOINLINE __attribute__((noinline))
// ...
#endif
```

- Apply `NOLINT` only at the exact location that needs it.

```cpp
goto out_ap_read;  // NOLINT
```

- Conditional compilation stays explicit.

```cpp
#if defined(LIBXR_SYSTEM_POSIX_HOST)
#include "linux_shared_topic.hpp"
#endif
```

- Keep `extern "C"`, attributes, and platform macros in the existing direct style.

```cpp
// NOLINTNEXTLINE
extern "C" __attribute__((weak)) void vApplicationStackOverflowHook(TaskHandle_t xTask,
                                                                    char* pcTaskName)
{
  static volatile const char* task_name = pcTaskName;
  UNUSED(task_name);
  UNUSED(xTask);
  REQUIRE(false);
}
```

## Test Code

- Code under `test/` may be more direct than public headers. Test-only macros, array literals, and compact test-driver code are acceptable there.

```cpp
#define TEST_ASSERT(condition)                                                          \
  do                                                                                    \
  {                                                                                     \
    if (!(condition))                                                                   \
    {                                                                                   \
      std::fprintf(stderr, "%s:%d: test failed: %s\n", __FILE__, __LINE__, #condition); \
      std::abort();                                                                     \
    }                                                                                   \
  } while (0)
```

- Naming, brace style, and basic layout still follow the same conventions as the main code.
- Where tests go, what they check and how to confirm that every test is needed: see [Testing](./testing.md).

## clang-format

- The repository has a root `.clang-format`.
- CI checks every C/C++ source file under `driver/`, `src/`, `system/` and `test/` with `clang-format 21.1.8`. The check entry is:

```bash
tools/format_cpp_files.sh --check
```

- Without `--check` the script formats the files in place; a list of files after the options limits it to those files.
- CMake files are checked by `tools/format_cmake_files.sh --check`; CI uses `cmakelang[YAML]==0.6.13`.
