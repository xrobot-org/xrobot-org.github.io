---
id: core-color
title: 终端颜色与格式
sidebar_position: 7
---

# 终端颜色与格式

`libxr_color.hpp` 提供终端文本样式、控制序列、前景色、背景色和常用预设的枚举与 ANSI 转义字符串，用于终端输出、Logger 和串口调试终端。

## 文本样式 `TextStyle`

```cpp
enum class TextStyle : uint8_t {
  NONE = 0,
  BOLD,
  DIM,
  UNDERLINE,
  BLINK,
  REVERSE,
  CONCEALED,
  COUNT
};
```

- `BOLD`：加粗
- `DIM`：弱化/暗色
- `UNDERLINE`：下划线
- `BLINK`：闪烁
- `REVERSE`：前景/背景反转
- `CONCEALED`：隐藏文本

对应 ANSI 转义字符串：`LIBXR_TEXT_STYLE_STR[]`

## 终端控制 `TerminalControl`

```cpp
enum class TerminalControl : uint8_t {
  NONE = 0,
  RESET,
  ERASE_LINE,
  COUNT
};
```

- `RESET`：重置当前样式
- `ERASE_LINE`：清除当前行

对应 ANSI 转义字符串：`LIBXR_TERMINAL_CONTROL_STR[]`

## 前景色 `Foreground`

```cpp
enum class Foreground : uint8_t {
  NONE = 0,
  BLACK,
  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  CYAN,
  WHITE,
  COUNT
};
```

对应 ANSI 转义字符串：`LIBXR_FOREGROUND_STR[]`

## 背景色 `Background`

```cpp
enum class Background : uint8_t {
  NONE = 0,
  BLACK,
  RED,
  GREEN,
  YELLOW,
  BLUE,
  MAGENTA,
  CYAN,
  WHITE,
  COUNT
};
```

对应 ANSI 转义字符串：`LIBXR_BACKGROUND_STR[]`

## 常用预设 `Preset`

```cpp
enum class Preset : uint8_t {
  NONE = 0,
  YELLOW_BOLD,
  RED_BOLD,
  BOLD_ON_RED,
  COUNT
};
```

- `YELLOW_BOLD`：黄色粗体
- `RED_BOLD`：红色粗体
- `BOLD_ON_RED`：红底粗体

对应 ANSI 转义字符串：`LIBXR_PRESET_STR[]`

## 使用示例

```cpp
std::cout
    << LibXR::LIBXR_TEXT_STYLE_STR[static_cast<uint8_t>(LibXR::TextStyle::BOLD)]
    << LibXR::LIBXR_FOREGROUND_STR[static_cast<uint8_t>(LibXR::Foreground::GREEN)]
    << "This is bold green text!"
    << LibXR::LIBXR_TERMINAL_CONTROL_STR[static_cast<uint8_t>(LibXR::TerminalControl::RESET)];
```

Logger 使用这一组常量：按日志级别从 `LIBXR_FOREGROUND_STR[]` 取前景色，再在结尾追加 `TerminalControl::RESET`。
