---
id: stm32-code-gen-gpio
title: GPIO
sidebar_position: 4
---

# GPIO

The generator emits one `STM32GPIO` object for every pin configured in STM32CubeMX as a GPIO input, output or external interrupt (EXTI). Interrupt priority, pull-up/pull-down and similar settings follow the CubeMX configuration.

## Example

Depending on whether a pin is configured as an external interrupt in STM32CubeMX and whether it has a label, the generator emits code such as:

```cpp
// Labeled input/output pin, using the macros CubeMX derives from the label
static STM32GPIO LED_B(LED_B_GPIO_Port, LED_B_Pin);

// Labeled external interrupt pin, with its IRQ number
static STM32GPIO USER_KEY(USER_KEY_GPIO_Port, USER_KEY_Pin, EXTI0_IRQn);

// Pin without a label, named after the pin
static STM32GPIO PA8(GPIOA, GPIO_PIN_8);
```

## Generation Rules

- objects are named after the CubeMX pin label, or after the pin (such as `PA8`) when there is no label;
- EXTI pins get their IRQ number by MCU family: most families share `EXTI9_5_IRQn` for lines 5 to 9 and `EXTI15_10_IRQn` for lines 10 to 15; STM32F0/G0/L0/C0/U0 share `EXTI0_1_IRQn`, `EXTI2_3_IRQn` and `EXTI4_15_IRQn`; STM32H5/U3/U5/L5/WBA/N6 and STM32H7R/S have one IRQ per line, and the PA/PB pins of STM32WB0 use `GPIOA_IRQn`/`GPIOB_IRQn`;
- the EXTI line of an external interrupt pin needs its interrupt enabled in the CubeMX NVIC for CubeMX to generate the matching `EXTIx_IRQHandler`; `libxr parse` warns when it is not;
- a label becomes a C++ object name, so it cannot be a C++ keyword or reserved identifier, a CMSIS/HAL macro or IRQ name, a macro CubeMX derives from another label (such as `<label>_Pin`), or another name the generated code uses; with such labels `libxr gen` lists every offending label and stops, and renaming them in CubeMX and regenerating resolves it.

## Usage notes

- after changing a pin mode in CubeMX, for example from a normal GPIO to EXTI, regenerate the code so that the constructor arguments follow;
- with XRobot integration (`--xrobot`) each object is registered under the same name with `XR_REGISTER(<name>, LibXR::GPIO)`, and configurations refer to it by that name.
