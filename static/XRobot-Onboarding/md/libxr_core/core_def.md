# LibXR core-def：公共定义

目标：  
看完这一节之后，你知道 core-def 大致包含哪些东西，并能用几段小函数实际调一调这些宏和常量（不依赖任何具体 OS / 板子）。

推荐先阅读官方文档原文，再看下面代码片段对照理解：

> https://xrobot.work/docs/basic_coding/core/core-def

---

## 1. 数学与物理常量：M_PI / M_2PI / M_1G

core-def 里放了常用的数学和物理常量，例如：

- `M_PI`, `M_2PI`：圆周率及其两倍，用于角度 / 相位计算；
- `M_1G`：标准重力加速度，值为 `9.80665 m/s²`。

一个只依赖 LibXR 的小例子：

```cpp
// 使用 core-def 中的数学 / 物理常量做简单换算
void ExampleCoreDef_Constants()
{
    // 90 度转成弧度再转回角度
    float rad = M_PI / 2.0f;
    float deg = rad * 180.0f / M_PI;

    // 2g 加速度，对应多少 m/s^2
    float acc_2g = 2.0f * M_1G;

    LibXR::STDIO::Printf("core-def constants: deg=%.1f, acc_2g=%.3f m/s^2\r\n",
                          deg, acc_2g);
}
```

---

## 2. 常用宏：UNUSED / OFFSET_OF / MEMBER_SIZE_OF / CONTAINER_OF / DEF2STR

core-def 给了一批工程里经常用到的工具宏。

### 2.1 UNUSED：显式“这个参数暂时不用”

```cpp
// 某个回调签名固定，但当前实现暂时不需要 ctx
void ExampleCoreDef_Callback(int event, void* ctx)
{
    UNUSED(ctx);  // 消除未使用参数告警

    LibXR::STDIO::Printf("ExampleCoreDef_Callback: event=%d\r\n", event);
}
```

---

### 2.2 OFFSET_OF / MEMBER_SIZE_OF：和结构体布局打交道

```cpp
struct ExampleCoreDef_Node
{
    int   id;
    char  name[16];
    void* user;
};

// 打印 name 成员在结构体中的偏移和大小
void ExampleCoreDef_StructLayout()
{
    size_t offset = OFFSET_OF(ExampleCoreDef_Node, name);
    size_t size   = MEMBER_SIZE_OF(ExampleCoreDef_Node, name);

    LibXR::STDIO::Printf("ExampleCoreDef_StructLayout: name offset=%u, size=%u\r\n",
                          (unsigned)offset, (unsigned)size);
}
```

---

### 2.3 CONTAINER_OF：从成员指针回到整个对象

```cpp
// 假设外部逻辑只拿到 name 成员指针，希望找回所属节点
void ExampleCoreDef_ContainerOf(ExampleCoreDef_Node* node)
{
    char* name_ptr = node->name;

    ExampleCoreDef_Node* owner =
        CONTAINER_OF(name_ptr, ExampleCoreDef_Node, name);

    LibXR::STDIO::Printf("ExampleCoreDef_ContainerOf: node=%p, owner=%p\r\n",
                          (void*)node, (void*)owner);
}
```

---

### 2.4 DEF2STR：宏转字符串

```cpp
#define EXAMPLE_CORE_DEF_VALUE  123

// 打印一个编译期宏的字符串形式
void ExampleCoreDef_Def2Str()
{
    LibXR::STDIO::Printf("ExampleCoreDef_Def2Str: EXAMPLE_CORE_DEF_VALUE=%s\r\n",
                          DEF2STR(EXAMPLE_CORE_DEF_VALUE));
}
```

---

## 3. 缓存行大小：LIBXR_CACHE_LINE_SIZE

core-def 根据指针位数定义了一条“合理默认”的缓存行尺寸：

- 64 位平台：64 字节；
- 32 位平台：32 字节。

可以在需要按缓存行对齐的地方使用这个常量，而不是自己写死数字。

```cpp
// 只演示如何读取这个常量，不依赖具体平台
void ExampleCoreDef_CacheLine()
{
    LibXR::STDIO::Printf("ExampleCoreDef_CacheLine: cache line size=%u bytes\r\n",
                          (unsigned)LIBXR_CACHE_LINE_SIZE);
}
```

---

## 4. 错误码：ErrorCode（知道有一套即可）

core-def 定义了统一的错误码枚举 `ErrorCode`，比如：

- `OK` / `FAILED`；
- `INIT_ERR` / `ARG_ERR` / `STATE_ERR`；
- `TIMEOUT` / `NO_MEM` / `NO_BUFF`；
- `EMPTY` / `FULL` / `NOT_FOUND`；
- `PTR_NULL` / `OUT_OF_RANGE` 等。

这里不需要记住具体值，只需要知道：**LibXR 已经有一整套错误码表，写接口返回值时可以直接用。**

简单示例：一个只用来演示返回值的“假初始化函数”：

```cpp
// 纯示例：返回两种典型错误码之一或 OK
ErrorCode ExampleCoreDef_DummyInit(bool config_ok, bool resource_ok)
{
    if (!config_ok)
    {
        return ErrorCode::ARG_ERR;   // 配置本身有问题
    }

    if (!resource_ok)
    {
        return ErrorCode::NO_MEM;    // 资源不够（只是举例）
    }

    return ErrorCode::OK;
}
```

---

## 5. 尺寸限制模式：SizeLimitMode（为后面断言做准备）

core-def 里还定义了尺寸限制模式：

- `EQUAL`：尺寸必须等于参考值；
- `LESS`：尺寸必须小于等于参考值；
- `MORE`：尺寸必须大于等于参考值；
- `NONE`：不限制尺寸。

这一节只需要知道有这四种模式，具体怎么结合断言做尺寸检查，会在断言模块（core-assert）里展开。

```cpp
// 只示意 SizeLimitMode 的使用，不做实际检查
void ExampleCoreDef_SizeLimit(SizeLimitMode mode, size_t limit, size_t size)
{
    LibXR::STDIO::Printf("ExampleCoreDef_SizeLimit: mode=%d, limit=%u, size=%u\r\n",
                          (int)mode, (unsigned)limit, (unsigned)size);

    // 具体的检查逻辑建议放到断言模块统一实现
}
```

---

## 6. 断言宏：ASSERT / ASSERT_FROM_CALLBACK

core-def 文档中提到两组断言宏：

- `ASSERT(x)`：普通上下文下使用；
- `ASSERT_FROM_CALLBACK(x, in_isr)`：在回调或中断上下文中使用，需要显示传入 `in_isr` 标志。

在 `LIBXR_DEBUG_BUILD` 打开时，当表达式为假，会调用：

```cpp
void libxr_fatal_error(const char *file, uint32_t line, bool in_isr);
```

### 6.1 显式触发一次断言失败（调试用）

下面这个函数，如果在带 `LIBXR_DEBUG_BUILD` 的调试构建中被调用，会**一定触发一次 ASSERT 失败**。

```cpp
// 调试时用于验证断言链路：调用它会必然触发 ASSERT 失败
void ExampleCoreDef_ForceAssertFailure()
{
    // 这里就是刻意写错条件，让 ASSERT 一定失败
    ASSERT(0);
}
```

### 6.2 回调场景下的 ASSERT_FROM_CALLBACK

```cpp
// 伪代码示意：从回调或 ISR 中使用断言
void ExampleCoreDef_CallbackWithAssert(bool in_isr, void* context)
{
    // 例如 context 在协议里约定不应该是空
    ASSERT_FROM_CALLBACK(context != nullptr, in_isr);

    LibXR::STDIO::Printf("ExampleCoreDef_CallbackWithAssert: ctx=%p\r\n",
                          context);
}
```

---

## 7. 通用模板函数：LibXR::max / LibXR::min

core-def 中还给了两条跨类型的 `max` / `min`：

```cpp
// 示例：不同类型之间使用 LibXR::max / LibXR::min
void ExampleCoreDef_MinMax()
{
    int   a = 10;
    float b = 3.5f;

    auto m1 = LibXR::max(a, b);
    auto m2 = LibXR::min(a, b);

    LibXR::STDIO::Printf("ExampleCoreDef_MinMax: max=%.2f, min=%.2f\r\n",
                          (double)m1, (double)m2);
}
```

---

## 8. 小结

core-def 集中放置了：

- 公共常量（`M_PI / M_2PI / M_1G`）；
- 常用工具宏（`UNUSED / OFFSET_OF / MEMBER_SIZE_OF / CONTAINER_OF / DEF2STR`）；
- 统一错误码 `ErrorCode`；
- 尺寸限制模式 `SizeLimitMode`；
- 断言宏 `ASSERT / ASSERT_FROM_CALLBACK`；
- 通用 `LibXR::max / LibXR::min`。

你可以在自己的测试代码里按需调用上面的这些示例函数，确认它们在当前工程中的行为。