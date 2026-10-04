---
id: stm32-code-gen-gpio
title: GPIO
sidebar_position: 4
---

# GPIO

LibXR 会为 STM32CubeMX 中配置为 GPIO 输入、输出或外部中断（EXTI）的每个引脚生成一个 `STM32GPIO` 对象。中断优先级、上下拉等设置以 CubeMX 的配置为准。

## 示例

根据在STM32CubeMX中是否配置为外部中断，以及引脚有没有标签，生成如下代码:

```cpp
// 有标签的普通输入输出引脚，使用 CubeMX 按标签生成的宏
static STM32GPIO LED_B(LED_B_GPIO_Port, LED_B_Pin);

// 有标签的外部中断引脚，带中断号
static STM32GPIO USER_KEY(USER_KEY_GPIO_Port, USER_KEY_Pin, EXTI0_IRQn);

// 没有标签的引脚，以引脚名命名
static STM32GPIO PA8(GPIOA, GPIO_PIN_8);
```

## 生成规则

- 对象名取 CubeMX 中的引脚标签，没有标签时取引脚名（如 `PA8`）；
- 配置为 EXTI 的引脚在构造参数中附带中断号，按 MCU 系列选择：大多数系列的 5~9 线和 10~15 线分别共用 `EXTI9_5_IRQn` 和 `EXTI15_10_IRQn`，STM32F0/G0/L0/C0/U0 共用 `EXTI0_1_IRQn`、`EXTI2_3_IRQn`、`EXTI4_15_IRQn`，STM32H5/U3/U5/L5/WBA/N6 和 STM32H7R/S 每条线一个中断号，STM32WB0 的 PA/PB 引脚使用 `GPIOA_IRQn`/`GPIOB_IRQn`；
- 外部中断引脚所在 EXTI 线的中断要在 CubeMX 的 NVIC 中开启，CubeMX 才会生成对应的 `EXTIx_IRQHandler`；没有开启时 `libxr parse` 给出警告；
- 标签作为 C++ 对象名，不能是 C++ 关键字或保留标识符、CMSIS/HAL 宏或中断名、CubeMX 由其他标签派生的宏（如 `<标签>_Pin`），也不能与生成代码中用到的其他名字相同；有这类标签时 `libxr gen` 列出全部问题标签并停止，在 CubeMX 中改名后重新生成即可。

## 使用建议

- 修改 CubeMX 中的引脚模式（例如普通 GPIO 改成 EXTI）后，重新生成代码，使构造参数同步变化；
- 开启 XRobot 集成（`--xrobot`）时，每个对象以同名 `XR_REGISTER(<名字>, LibXR::GPIO)` 注册，配置按这个名字引用。
