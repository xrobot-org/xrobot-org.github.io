---
id: device-coding
title: Device Drivers
sidebar_position: 5
---

# Device Drivers

This module summarizes LibXR's abstract interfaces for common hardware peripherals.

The common properties of these device interfaces are:

- **Platform Independent**: Abstract interfaces use unified naming and behavior, independent of low-level hardware registers or driver structures.
- **Asynchronous Operation Support**: The common operation model is based on `ReadPort` / `WritePort`, and fits interrupt- and DMA-driven implementations.
- **Type Safety**: Interface parameters and configuration structures use strong typing.
- **Minimal Dependencies**: Core modules currently rely on C++20 features and basic LibXR components.
- **Flexible Extension**: Each peripheral can be implemented according to platform capabilities, including shared-resource cases such as shared buses.

## Contents

- [GPIO (General Purpose Input/Output)](./gpio.md)
- [UART (Serial Communication)](./uart.md)
- [I2C (I2C Bus)](./i2c.md)
- [SPI (SPI Interface)](./spi.md)
- [CAN / FDCAN (Controller Area Network)](./can.md)
- [ADC (Analog-to-Digital Conversion)](./adc.md)
- [DAC (Digital-to-Analog Conversion)](./dac.md)
- [PWM (Pulse-Width Modulation)](./pwm.md)
- [Flash (Flash Interface)](./flash.md)
- [Power (Power Management)](./power.md)
- [Timebase (Time Base)](./timebase.md)
- [Watchdog (Watchdog Timer)](./watchdog.md)
- [USB (Universal Serial Bus)](./usb.md)
- [Network and Wi-Fi](./network.md)

## Interface structure

Many peripheral abstraction classes include some of the following building blocks, but not every driver exposes the full set:

- a `Configuration` structure and a matching `SetConfig()` interface
- `Read()` / `Write()` style data-transfer interfaces where the peripheral is stream- or transaction-oriented
- control interfaces such as `Enable()` / `Disable()` when the hardware model requires them
- callback registration for event-driven paths such as interrupts or asynchronous completions

Counterexamples in current mainline include `ADC`, `DAC`, `PowerManager`, `Timebase`, and `Flash`, which intentionally expose narrower, device-specific contracts.

Users do not need to care whether the backend is STM32UART, ESP32UART, or LinuxUART. Use the base class interface directly.
