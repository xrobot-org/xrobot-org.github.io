---
id: power
title: 电源管理
sidebar_position: 10
---

# Power（电源管理）

`LibXR::PowerManager` 提供统一的电源管理接口，适用于实现系统复位、关机或进入低功耗模式等功能，供平台或电源控制驱动实现。

## 接口定义

```cpp
class PowerManager {
public:
  PowerManager() = default;
  virtual ~PowerManager() = default;

  // 系统复位操作（由子类实现具体逻辑）
  virtual void Reset() = 0;

  // 系统关机操作（由子类实现具体逻辑）
  virtual void Shutdown() = 0;

  // 跳转到启动加载器（默认退化为 Reset）
  virtual void JumpToBootloader() { Reset(); }
};
```

## 使用说明

- `Reset()` 可用于软复位控制器、重新启动系统等；
- `Shutdown()` 用于关机、掉电、进入睡眠等低功耗控制；
- `JumpToBootloader()` 默认会退化为 `Reset()`，平台实现可按需改为真正的 Bootloader 跳转；
- 可用于平台的电源按钮、远程命令、低电量策略等情境；
- 由具体平台实现其底层行为，接口保持一致，便于移植与抽象封装。

## 说明

- `PowerManager` 当前是一个非常窄的抽象面：只有 `Reset()`、`Shutdown()` 和默认退化为 `Reset()` 的 `JumpToBootloader()`。
- 它不携带状态查询、事件回调、低功耗级别枚举等更丰富的统一策略接口；如果某个平台有这些能力，仍属于具体实现或更上层策略模块，而不是当前基类公共契约。
