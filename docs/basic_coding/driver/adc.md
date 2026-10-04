---
id: adc
title: 模数转换
sidebar_position: 6
---

# ADC（模数转换）

`LibXR::ADC` 提供平台无关的模拟数字转换（ADC）抽象接口，用于读取模拟输入对应的浮点值，适用于电压检测、传感器读取等应用场景。

## 接口定义

```cpp
class ADC {
public:
  ADC() = default;

  // 读取 ADC 浮点值
  virtual float Read() = 0;
};
```

- `Read()` 是纯虚函数，子类需实现具体的采样逻辑；
- `Read()` 返回电压（V），现有后端（STM32、ESP32）按参考电压把采样值换算为电压；
