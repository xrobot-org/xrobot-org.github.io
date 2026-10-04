---
id: gpio
title: GPIO
sidebar_position: 1
---

# GPIO（通用输入输出）

`LibXR::GPIO` 提供跨平台的通用输入输出（General Purpose Input/Output）抽象接口，支持多种输入输出模式及中断回调机制。用户可继承此接口实现具体平台的 GPIO 控制逻辑。

## 接口概览

### 配置枚举

```cpp
enum class Direction : uint8_t {
  INPUT,                 // 输入模式
  OUTPUT_PUSH_PULL,      // 推挽输出
  OUTPUT_OPEN_DRAIN,     // 开漏输出
  FALL_INTERRUPT,        // 下降沿中断
  RISING_INTERRUPT,      // 上升沿中断
  FALL_RISING_INTERRUPT  // 双沿中断
};

enum class Pull : uint8_t {
  NONE,  // 无上下拉
  UP,    // 上拉
  DOWN   // 下拉
};
```

### 配置结构体

```cpp
struct Configuration {
  Direction direction;  // 引脚方向
  Pull pull;            // 上下拉设置
};
```

### 回调类型

```cpp
using Callback = LibXR::Callback<>;
```

### 构造与配置

```cpp
GPIO();  // 默认构造函数
virtual ErrorCode SetConfig(Configuration config) = 0;
```

### 引脚控制

```cpp
virtual bool Read() = 0;              // 读取引脚电平
virtual void Write(bool value) = 0;   // 写入引脚电平
```

### 中断控制

```cpp
virtual ErrorCode EnableInterrupt() = 0;   // 使能中断
virtual ErrorCode DisableInterrupt() = 0;  // 禁用中断
```

### 注册事件回调

```cpp
using Callback = LibXR::Callback<>;
ErrorCode RegisterCallback(Callback callback); // 注册中断处理函数
```

`RegisterCallback()` 只把回调保存到 `callback_` 并返回 `ErrorCode::OK`。要收到中断回调，还需用 `SetConfig()` 把方向设为中断模式，并调用 `EnableInterrupt()`。

## 特性总结

- 支持输入/输出/中断等多种模式配置；
- 提供类型安全的配置结构体；
- 事件处理使用统一回调接口，可在 ISR 或任务中触发；
- 平台实现需完整覆盖虚函数定义；
- 可与其他 LibXR 模块配合使用，如 Topic、Timer 等。
