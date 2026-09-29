---
id: con-guide-coding-style
title: 编码规范
sidebar_position: 5
---

# 编码规范

这里整理仓库当前采用的代码写法。

## 命名

- 类型、类、结构体、枚举类型、成员函数使用 `PascalCase`。

```cpp
class Logger
{
 public:
  static void Init();
};
```

- 局部变量、函数参数、数据成员使用 `snake_case`；数据成员以 `_` 结尾。

```cpp
static inline bool initialized_ = false;
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
}

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
#include "async.hpp"

#include "libxr_def.hpp"
#include "thread.hpp"
```

- 头文件中的 include 保持现有顺序，不为整理做无关重排。

```cpp
#include "async.hpp"
#include "database.hpp"
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

- 允许为可读性保留现有空行和局部排版，不为了追求机械一致而改动无关段落。

- 访问说明符不额外缩进，成员相对类体缩进两空格。

```cpp
class Logger
{
 public:
  static void Init();

 private:
  static inline bool initialized_ = false;
};
```

## 声明与定义

- 简短函数允许写成类内一行定义；较长函数保持正常展开。

```cpp
~LockGuard() { mutex_.Unlock(); }

static void Sleep(uint32_t milliseconds);
```

- `constexpr`、`static constexpr`、`static inline` 继续按现有习惯使用。

```cpp
static constexpr size_t LIBXR_CACHE_LINE_SIZE = (sizeof(void*) == 8) ? 64 : 32;
static inline bool initialized_ = false;
```

- `explicit`、`operator`、`[[nodiscard]]` 等限定符按常规位置书写。

```cpp
explicit DatabaseRawSequential(Flash& flash, size_t max_buffer_size = 256);
[[nodiscard]] ErrorCode TryLock();
operator uint64_t() const;
```

- 指针和引用的空格风格以局部文件现有写法为准。仓库里同时存在 `const char*` 和 `const char *`，不要为了统一这一点扩大改动范围。

## 注释

- 公共头文件中的接口继续使用现有 `Doxygen` 风格。

```cpp
/**
 * @brief 发布一条日志 / Publish a log message
 * @param level 日志级别 / Log level
 * @param file 来源文件名 / Source file name
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

- 底层辅助宏继续保持现有写法，不额外改写成模板或内联函数。

```cpp
#define UNUSED(_x) ((void)(_x))
#define CONTAINER_OF(ptr, type, member) \
  ((type*)((char*)(ptr) - OFFSET_OF(type, member)))  // NOLINT
```

- `NOLINT` 只压在具体位置，不整段铺开。

```cpp
// NOLINTNEXTLINE
static void Publish(LogLevel level, const char* file, uint32_t line, const char* fmt,
                    ...);
```

- 条件编译保持直接展开，不额外包装。

```cpp
#if defined(LIBXR_SYSTEM_Linux) || defined(LIBXR_SYSTEM_Webots)
#include "linux_shared_topic.hpp"
#endif
```

- `extern "C"`、属性和平台宏保持现有直接写法。

```cpp
extern "C" __attribute__((weak)) void vApplicationStackOverflowHook(...);
```

## 测试代码

- `test/` 下的代码可以比公共头文件更直接，允许使用局部宏、数组字面量和较紧凑的测试驱动写法。

```cpp
#define TEST_STEP(_arg)                                \
  do                                                   \
  {                                                    \
    test_name = _arg;                                  \
  } while (0)
```

- 但命名、括号风格和基本版式仍然保持与主代码一致。

## clang-format

- 仓库根目录已有 `.clang-format`。
- CI 使用 `clang-format 21.1.8`，检查入口是：

```bash
tools/format_driver_src.sh --check
```

- 当前脚本只检查 `driver/` 和 `src/` 下的 `C/C++` 源文件。
