---
id: stm32-code-gen-gpio
title: GPIO
sidebar_position: 4
---

# GPIO

LibXR 会根据 STM32CubeMX 中每个 GPIO 引脚的当前配置，生成对应的 `STM32GPIO` 实例。对代码生成器而言，这一页主要关心的是**实例形状**，而不是重新定义 GPIO 的运行时语义。

当前生成结果主要分为两类：

- 普通输入/输出引脚
- 带 EXTI 中断号的引脚

## 示例

根据在STM32CubeMX中是否配置为外部中断，生成如下代码:

```cpp
// GPIO配置为普通输入输出引脚
STM32GPIO gpioA0(GPIOA, GPIO_PIN_0);

// GPIO配置为外部中断引脚
STM32GPIO gpioA1(GPIOA, GPIO_PIN_1, EXTI1_IRQn);
```

## 当前 generator 覆盖范围

就当前 `GeneratorCodeSTM32.py` 而言，GPIO 这一项的主要职责是：

- 从 CubeMX 工程描述中识别每个 GPIO 引脚的名称与模式；
- 若该引脚被配置为 EXTI，则在构造参数中附带对应的 `EXTI*_IRQn`；
- 生成 `STM32GPIO <alias>;` 形式的实例声明。

这意味着：

- generator 负责把 CubeMX 中已经确定的 GPIO 角色翻译成 LibXR 侧对象；
- 它并不在这一层重新定义中断优先级、上下拉策略或运行时回调逻辑，这些仍以 CubeMX 配置和运行时代码为准。

## 使用建议

- 若你修改了 CubeMX 中的引脚模式（例如普通 GPIO 改成 EXTI），需要重新生成代码，确保构造形状同步变化；
- 对象名取 CubeMX 中的引脚标签（没有标签时由引脚名得到）；开启 XRobot 集成（`--xrobot`）时，同名对象以 `XR_REGISTER(<名字>, LibXR::GPIO)` 注册，应用配置按这个名字引用。
