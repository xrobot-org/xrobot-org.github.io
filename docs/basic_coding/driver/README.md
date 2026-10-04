---
id: device-coding
title: 外设驱动
sidebar_position: 5
---

# 外设驱动（Device Drivers）

本章汇总 LibXR 对常见硬件外设的抽象接口。

LibXR 设备接口有以下共同点：

- 抽象类统一命名和行为，平台差异由各后端实现；
- 数据传输用 `Operation` 描述完成方式（阻塞、回调或轮询）：UART 的收发经过 `ReadPort` / `WritePort` 队列，I2C、SPI 的每次传输直接带一个 `ReadOperation` / `WriteOperation`，后端可在中断或 DMA 中完成；
- 接口参数和配置结构体使用强类型；
- 依赖 C++20 和 LibXR 核心 API，可用于裸机和 RTOS；
- 各外设按平台能力裁剪实现，可共享系统资源（如共享总线）。

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
- [调试接口（SWD / JTAG）](../../debug/README.md)

## 接口组成

很多外设抽象类会包含以下一部分常见构件，但并不是每个驱动都会完整具备这一整套：

- `Configuration` 配置结构体及对应的 `SetConfig()` 接口
- 面向流或事务场景的 `Read()` / `Write()` 数据传输接口
- 在硬件模型需要时提供的 `Enable()` / `Disable()` 控制接口
- 用于中断或异步完成路径的 `Callback` 事件注册

UART 等经过 `ReadPort` / `WritePort` 的 `Read()` / `Write()`，其返回时机、各返回码的含义和缓冲区需要保持有效的时间见 [IO 读写抽象](../core/core-rw.md)；SPI、I2C 的传输见各自页面的“行为”一节。

`ADC`、`DAC`、`PowerManager`、`Timebase`、`Flash` 只提供各自设备需要的少量接口。

上层代码通过基类指针或引用调用接口，同一段代码可用于 `STM32UART`、`ESP32UART`、`LinuxUART` 等不同后端。
