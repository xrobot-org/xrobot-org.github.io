---
id: pwm
title: PWM
sidebar_position: 8
---

# PWM（脉宽调制）

`LibXR::PWM` 提供平台无关的 PWM 信号控制接口，用于控制 LED 亮度、电机速度等占空比调节相关的外设。

## 接口定义

```cpp
class PWM {
public:
  struct Configuration {
    uint32_t frequency;  // PWM 频率（Hz）
  };

  // 设置占空比，范围为 0.0 ~ 1.0
  virtual ErrorCode SetDutyCycle(float value) = 0;

  // 设置 PWM 参数（如频率）
  virtual ErrorCode SetConfig(Configuration config) = 0;

  // 启用 PWM 输出
  virtual ErrorCode Enable() = 0;

  // 禁用 PWM 输出
  virtual ErrorCode Disable() = 0;
};
```

## 特性总结

- 抽象占空比调节和频率配置；
- 统一接口适用于 LED、马达、蜂鸣器等控制；
- 提供启用与禁用接口，适合状态控制与节能管理；
- 平台需实现具体信号输出逻辑，上层调用保持一致性。

## 说明

- `SetDutyCycle(float value)` 当前只以注释形式约定“0.0 ~ 1.0”这一常见占空比表达；若某个平台实现需要做钳制、量化或错误返回，具体行为仍由该后端决定。
- `Configuration` 当前只包含 `frequency` 字段；占空比并不通过 `SetConfig()` 设置，而是单独走 `SetDutyCycle()`。
