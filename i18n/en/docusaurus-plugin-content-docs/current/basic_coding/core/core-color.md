---
id: core-color
title: Terminal Colors and Formatting
sidebar_position: 7
---

# Terminal Colors and Formatting

`libxr_color.hpp` provides enums and ANSI escape-string tables for terminal text styles, control sequences, foreground and background colors, and common presets, used by terminal output, Logger and serial debug terminals.

## Text Style `TextStyle`

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

- `BOLD`: bold text
- `DIM`: dim text
- `UNDERLINE`: underlined text
- `BLINK`: blinking text
- `REVERSE`: inverted foreground/background
- `CONCEALED`: hidden text

Corresponding ANSI strings: `LIBXR_TEXT_STYLE_STR[]`

## Terminal Control `TerminalControl`

```cpp
enum class TerminalControl : uint8_t {
  NONE = 0,
  RESET,
  ERASE_LINE,
  COUNT
};
```

- `RESET`: reset current styles
- `ERASE_LINE`: clear the current line

Corresponding ANSI strings: `LIBXR_TERMINAL_CONTROL_STR[]`

## Foreground Color `Foreground`

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

Corresponding ANSI strings: `LIBXR_FOREGROUND_STR[]`

## Background Color `Background`

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

Corresponding ANSI strings: `LIBXR_BACKGROUND_STR[]`

## Common Presets `Preset`

```cpp
enum class Preset : uint8_t {
  NONE = 0,
  YELLOW_BOLD,
  RED_BOLD,
  BOLD_ON_RED,
  COUNT
};
```

- `YELLOW_BOLD`: yellow bold text
- `RED_BOLD`: red bold text
- `BOLD_ON_RED`: bold text on red background

Corresponding ANSI strings: `LIBXR_PRESET_STR[]`

## Example

```cpp
std::cout
    << LibXR::LIBXR_TEXT_STYLE_STR[static_cast<uint8_t>(LibXR::TextStyle::BOLD)]
    << LibXR::LIBXR_FOREGROUND_STR[static_cast<uint8_t>(LibXR::Foreground::GREEN)]
    << "This is bold green text!"
    << LibXR::LIBXR_TERMINAL_CONTROL_STR[static_cast<uint8_t>(LibXR::TerminalControl::RESET)];
```

The Logger uses these tables: it selects a foreground color from `LIBXR_FOREGROUND_STR[]` by log level, then appends `TerminalControl::RESET` at the end of the rendered line.
