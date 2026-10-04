---
id: core-string
title: 运行期字符串
sidebar_position: 6
---

# 运行期字符串

`libxr_string.hpp` 提供 `LibXR::RuntimeStringView<Source, Args...>`：运行期构造、长期保留的 NUL 结尾字符串，用于模块名、topic 名、运行期格式化结果等只构造一次或反复重写的文本。

- 文本保存在内部存储中，可通过 `View()` / `CStr()` 反复读取；
- 格式化构造在第一次重写前按编译期上界分配容量，之后复用同一块存储。

## 两类构造路径

1. 纯文本拷贝 / 拼接

```cpp
LibXR::RuntimeStringView<> topic_name("camera/front");
LibXR::RuntimeStringView<> path("/dev/", "ttyUSB0");
```

这一条路径只接受文本类输入；拼接数字时使用下面的格式化路径。从字符指针构造时，输入需要是有效的 NUL 结尾字符串。

2. 格式化重写

```cpp
LibXR::RuntimeStringView<"camera_{}", unsigned int> name;
if (name.Reformat(7U) != LibXR::ErrorCode::OK) {
  // 处理失败
}
// name.View() == "camera_7"

LibXR::RuntimeStringView<"frame_%03u", unsigned int> frame;
if (frame.Reprintf(5U) != LibXR::ErrorCode::OK) {
  // 处理失败
}
// frame.View() == "frame_005"
```

- `Reformat(...)` 使用 brace 风格格式；
- `Reprintf(...)` 使用 printf 风格格式；
- 刷新调用的参数类型必须与模板参数 `Args...` 一致。

## 语义

- 格式化参数只接受可静态界定容量的值类型；运行期字符串参数在编译期被拒绝，文本拼接使用 `RuntimeStringView<>` 的普通构造。
- 对象析构时不释放已分配存储，适合一次分配后长期复用的名字和格式化结果。
- `Status()` 返回最近一次构造或重写的状态；失败后可见字符串为空串。
- 不可复制，也不可赋值；移动构造接管存储，源对象变为空串。

## 常用访问接口

- `std::string_view View() const`
- `const char* CStr() const`
- `size_t Size() const`
- `bool Empty() const`
- `ErrorCode Status() const`
- 可隐式转换为 `std::string_view` 和 `const char*`。
