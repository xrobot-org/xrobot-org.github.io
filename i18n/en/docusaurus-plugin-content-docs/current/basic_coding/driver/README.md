---
id: device-coding
title: Device Drivers
sidebar_position: 5
---

# Device Drivers

This chapter summarizes LibXR's abstract interfaces for common hardware peripherals.

LibXR device interfaces share these properties:

- Abstract classes use unified naming and behavior; platform differences live in the backends.
- Transfers describe completion with an `Operation` (blocking, callback, or polling): UART transfers go through `ReadPort` / `WritePort` queues, while each I2C or SPI transfer takes a `ReadOperation` / `WriteOperation` directly; backends may complete them from interrupts or DMA.
- Interface parameters and configuration structures are strongly typed.
- They depend on C++20 and basic LibXR components and run on bare metal and RTOSes.
- Each peripheral is implemented according to platform capabilities, including shared resources such as shared buses.

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

`ADC`, `DAC`, `PowerManager`, `Timebase`, and `Flash` expose only the few calls their devices need.

Upper-layer code calls the interface through a base-class pointer or reference, so the same code works with `STM32UART`, `ESP32UART`, `LinuxUART`, and other backends.
