---
id: stm32-code-gen-gpio
title: GPIO
sidebar_position: 4
---

# GPIO

The generator emits `STM32GPIO` instances based on each GPIO pin’s current CubeMX configuration. From the generator’s point of view, this page is mainly about the **constructor shape** of the generated objects, not about redefining GPIO runtime semantics.

Current generated results mainly fall into two groups:

- ordinary input/output pins
- pins with an EXTI interrupt number

## Example

Depending on whether a pin is configured as an external interrupt in STM32CubeMX, the generator emits code such as:

```cpp
// GPIO configured as a normal input/output pin
STM32GPIO gpioA0(GPIOA, GPIO_PIN_0);

// GPIO configured as an EXTI interrupt pin
STM32GPIO gpioA1(GPIOA, GPIO_PIN_1, EXTI1_IRQn);
```

## Current generator coverage

In current `GeneratorCodeSTM32.py`, the GPIO generation path mainly does the following:

- identify each GPIO pin name and mode from the CubeMX project description;
- if the pin is configured as EXTI, append the matching `EXTI*_IRQn` constructor argument;
- generate instance declarations in the form `STM32GPIO <alias>;`.

This means:

- the generator translates already-decided GPIO roles from CubeMX into LibXR-side objects;
- it does not redefine interrupt priority, pull mode, or runtime callback logic at this layer; those still follow CubeMX configuration and runtime code.

## Usage notes

- if you change a pin mode in CubeMX, for example from a normal GPIO to EXTI, regenerate the code so that the constructor shape stays in sync;
- object names come from the CubeMX pin labels (derived from the pin name when there is no label); with XRobot integration (`--xrobot`) each object is registered under the same name with `XR_REGISTER(<name>, LibXR::GPIO)`, and application configurations refer to it by that name.
