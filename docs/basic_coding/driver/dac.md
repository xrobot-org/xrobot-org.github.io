---
id: dac
title: 数模转换
sidebar_position: 7
---

# DAC（数模转换）

`LibXR::DAC` 提供平台无关的数字转模拟（DAC）抽象接口，用于输出一个浮点值对应的模拟量。

## 接口定义

```cpp
class DAC {
public:
  DAC() = default;

  // 输出 DAC 浮点值
  // Outputs the DAC floating-point value
  virtual ErrorCode Write(float voltage) = 0;
};
```

- `Write(voltage)` 是纯虚函数，子类需实现具体的输出逻辑；
- `voltage` 的单位为 V，现有后端（STM32、ESP32）先把输入钳位到 `[0, 参考电压]` 再输出；
- 返回 `ErrorCode`，用于表示输出过程中的错误或成功状态；

## 典型用法

```cpp
// 示例：输出 1.23 V
dac->Write(1.23f);
```
