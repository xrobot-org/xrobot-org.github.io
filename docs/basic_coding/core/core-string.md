---
id: core-string
title: 定长字符串
sidebar_position: 5
---

# RuntimeStringView 字符串

当前公开的运行期字符串工具是 `LibXR::RuntimeStringView<...>`，定义在 `libxr_string.hpp` 中。旧版 `String<N>` 已从当前源码移除。

`RuntimeStringView` 适合模块名、topic 名、设备路径或运行期格式化结果这类“初始化或首次格式化后长期保留”的文本。它保存 NUL 结尾字符串，并在后续重写时复用已经准备好的存储。

## 纯文本构造

```cpp
LibXR::RuntimeStringView<> topic_name("camera/front");
LibXR::RuntimeStringView<> path("/dev/", "ttyUSB0");
```

这一条路径用于文本拷贝和拼接。从字符指针构造时，输入需要是有效的 NUL 结尾字符串。

## 格式化重写

```cpp
LibXR::RuntimeStringView<"camera_{}", unsigned int> name;
name.Reformat(7U);

LibXR::RuntimeStringView<"frame_%03u", unsigned int> frame;
frame.Reprintf(5U);
```

- `Reformat(...)` 使用 brace 风格格式；
- `Reprintf(...)` 使用 printf 风格格式；
- 重写参数类型与模板参数 `Args...` 对应；
- 运行期字符串不作为格式化参数使用，需要拼接文本时走普通构造路径。

## 常用访问接口

- `std::string_view View() const`
- `const char* CStr() const`
- `size_t Size() const`
- `bool Empty() const`
- `ErrorCode Status() const`

格式化失败时可见字符串清为空串，调用方可以检查返回值或 `Status()`。

## 存储语义

格式化路径按编译期可计算的上界准备存储，后续重写复用同一块区域。对象析构当前不会释放已经分配的存储，因此它面向初始化后长期使用的名称和文本，不是短生命周期的通用字符串容器。

需要普通拥有型、自动释放的字符串时，使用标准库字符串；需要应用自己控制固定容量时，可以使用固定字符数组配合 `Print::*IntoBuffer()`。
