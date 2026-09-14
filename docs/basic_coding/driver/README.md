---
id: device-coding
title: 外设驱动
sidebar_position: 5
---

# 外设驱动（Device Drivers）

本模块汇总 LibXR 对常见硬件外设的抽象接口。

LibXR 设备接口的共性如下：

- **平台无关**：抽象类接口统一命名、统一行为，不依赖底层硬件寄存器或驱动结构；
- **支持异步操作**：基于 `ReadPort` / `WritePort` 的通用操作模型，适配中断、DMA 等硬件机制；
- **类型安全**：接口参数和配置结构体使用强类型封装，提升可靠性与代码可读性；
- **最小依赖**：核心模块当前依赖 C++20 特性和 LibXR 基础组件，适用于裸机和各种 RTOS 平台；
- **灵活扩展**：每种外设可根据平台能力裁剪实现，支持复用系统资源（如共享总线）；

## 目录

- [GPIO（通用输入输出）](./gpio.md)
- [UART（串口通信）](./uart.md)
- [I2C（I2C 总线）](./i2c.md)
- [SPI（SPI 接口）](./spi.md)
- [CAN / FDCAN（控制器局域网）](./can.md)
- [ADC（模数转换）](./adc.md)
- [DAC（数字转模拟）](./dac.md)
- [PWM（脉宽调制）](./pwm.md)
- [Flash（闪存接口）](./flash.md)
- [Power（电源管理）](./power.md)
- [Timebase（时间基准）](./timebase.md)
- [看门狗（Watchdog）](./watchdog.md)
- [USB（USB 设备）](./usb.md)
- [网络接口与 Wi-Fi](./network.md)

## 接口组成

很多外设抽象类会包含以下一部分常见构件，但并不是每个驱动都会完整具备这一整套：

- `Configuration` 配置结构体及对应的 `SetConfig()` 接口
- 面向流或事务场景的 `Read()` / `Write()` 数据传输接口
- 在硬件模型需要时提供的 `Enable()` / `Disable()` 控制接口
- 用于中断或异步完成路径的 `Callback` 事件注册

当前主线中的 `ADC`、`DAC`、`PowerManager`、`Timebase`、`Flash` 等页面就属于更窄、更专用的接口形态，不应被理解成统一模板。

用户无需关心底层是STM32UART、ESP32UART还是LinuxUART，只需拿到基类指针并调用接口即可。
