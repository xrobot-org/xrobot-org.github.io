---
id: con-guide-coding-style
title: 编码规范
sidebar_position: 5
---

# 编码规范

这里整理 LibXR 仓库当前采用的 C++ 代码写法。模块和 BSP 仓库沿用同样的命名和版式；CI 不检查这两类仓库的 C++ 格式，带有 `.clang-format` 的 BSP 按该文件格式化。`driver/` 和 `system/` 中的厂商与平台代码不要求遵循下面的命名规则。Python 代码的写法见 [Python 编码规范](./coding_style_python.md)。

## 命名

- 类型、类、结构体、枚举类型、成员函数和自由函数使用 `PascalCase`。

```cpp
class Logger
{
 public:
  static void Init();
};
```

- 局部变量、函数参数、数据成员使用 `snake_case`；数据成员以 `_` 结尾。

```cpp
static inline bool ready_ = false;
```

- 宏、错误码、日志宏、枚举值保持全大写风格。

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

## 命名空间与类型别名

- 命名空间使用独立换行的 `Allman` 风格，结束处保留注释。

```cpp
namespace LibXR
{
// ...
}  // namespace LibXR
```

- 类型别名优先使用 `using`；已有 `typedef` 保持现状。

```cpp
using Callback = LibXR::Callback<uint32_t>;
typedef RBTree<uint32_t>::Node<Block>* TopicHandle;
```

## 文件组织

- `.cpp` 先包含对应头文件，再包含系统头和项目头。

```cpp
#include "raw_sequential.hpp"

#include <cstddef>
#include <cstdint>

#include "libxr_def.hpp"
#include "libxr_mem.hpp"
```

- include 由 clang-format 按分组排序（`IncludeBlocks: Regroup`），同一组内按字母顺序排列。

```cpp
#include "async.hpp"
#include "database.hpp"
#include "double_buffer.hpp"
#include "event.hpp"
```

- 头文件统一使用 `#pragma once`。

```cpp
#pragma once
```

## 版式

- 使用 `Allman` 大括号风格。

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

- 列宽和换行交给仓库中的 `.clang-format` 处理；当前配置基于 `Google`，`ColumnLimit` 为 `90`。

- 连续空行最多保留一行，其余版式以 clang-format 的结果为准；需要保留手工排版的段落用 `// clang-format off` 和 `// clang-format on` 包围。

- 访问说明符不额外缩进，成员相对类体缩进两空格。

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

## 声明与定义

- 简短函数允许写成类内一行定义；较长函数保持正常展开。

```cpp
~LockGuard() { mutex_.Unlock(); }

static void Sleep(uint32_t milliseconds);
```

- `inline constexpr`、`static constexpr`、`static inline` 继续按现有习惯使用。

```cpp
inline constexpr size_t HW_CACHE_LINE_SIZE = (sizeof(void*) == 8) ? 64 : 32;
static inline bool ready_ = false;
```

- `explicit`、`operator`、`[[nodiscard]]` 等限定符按常规位置书写。

```cpp
explicit DatabaseRawSequential(Flash& flash, size_t max_buffer_size = 256);
[[nodiscard]] ErrorCode TryLock();
operator uint64_t() const { return microsecond_; }
```

- 指针和引用的 `*`、`&` 紧跟类型，写作 `const char* name`、`Flash& flash`（Google 风格的 `PointerAlignment: Left`）。

## 注释

- 公共头文件中的接口继续使用现有 `Doxygen` 风格。

```cpp
/**
 * @brief 发布一条字面量日志 / Publish one literal log message
 * @param level 日志级别 / Log level
 * @param file 来源文件名 / Source file name
 * @param line 行号 / Line number
 * @param args 格式参数 / Format arguments
 */
```

- 注释说明接口语义、参数和边界条件，不记录试错过程，不写过程化说明。

- 公共头文件中的注释通常保留中英双语；新增接口时继续沿用所在文件现有写法。

- 简单局部说明使用短行注释，不写口语化句子。

```cpp
// 创建线程
int ans = pthread_create(&this->thread_handle_, &attr, ThreadBlock::Port, block);
```

## 宏与例外

- 新增的辅助常量和函数优先写成 `constexpr` 常量或模板函数。以下节选自 `src/core/libxr_def.hpp`：

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

- 宏只用于需要预处理器的场合，例如 `UNUSED` 和按编译器切换的定义。以下节选自同一文件：

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

- `NOLINT` 只压在具体位置，不整段铺开。

```cpp
goto out_ap_read;  // NOLINT
```

- 条件编译保持直接展开，不额外包装。

```cpp
#if defined(LIBXR_SYSTEM_POSIX_HOST)
#include "linux_shared_topic.hpp"
#endif
```

- `extern "C"`、属性和平台宏保持现有直接写法。

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

## 测试代码

- `test/` 下的代码可以比公共头文件更直接，允许使用测试专用的宏、数组字面量和较紧凑的测试驱动写法。

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

- 但命名、括号风格和基本版式仍然保持与主代码一致。
- 测试放在哪里、测什么、怎样确认每个测试都有作用，见[测试规范](./testing.md)。

## clang-format

- 仓库根目录已有 `.clang-format`。
- CI 使用 `clang-format 21.1.8` 检查 `driver/`、`src/`、`system/` 和 `test/` 下的全部 C/C++ 源文件，检查入口是：

```bash
tools/format_cpp_files.sh --check
```

- 不带 `--check` 时脚本就地格式化；后面列出文件时只处理这些文件。
- CMake 文件由 `tools/format_cmake_files.sh --check` 检查，CI 使用 `cmakelang[YAML]==0.6.13`。
