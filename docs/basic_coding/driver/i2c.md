---
id: i2c
title: I2C
sidebar_position: 3
---

# I2C（串行总线）

`LibXR::I2C` 提供平台无关的 I2C 总线通信接口，支持读写设备与寄存器、通信速率配置，适用于外设控制、传感器访问等场景。

## 接口概览

### 枚举类型

```cpp
enum class MemAddrLength : uint8_t {
  BYTE_8,
  BYTE_16
};
```

### 配置结构

```cpp
struct Configuration {
  uint32_t clock_speed;  // 通信时钟速率（单位 Hz）
};
```

### 主要方法

```cpp
virtual ErrorCode Read(uint16_t slave_addr,
                       RawData read_data,
                       ReadOperation& op,
                       bool in_isr = false) = 0;

virtual ErrorCode Write(uint16_t slave_addr,
                        ConstRawData write_data,
                        WriteOperation& op,
                        bool in_isr = false) = 0;

virtual ErrorCode SetConfig(Configuration config) = 0;

virtual ErrorCode MemRead(uint16_t slave_addr, uint16_t mem_addr,
                          RawData read_data, ReadOperation& op,
                          MemAddrLength mem_addr_size = MemAddrLength::BYTE_8,
                          bool in_isr = false) = 0;

virtual ErrorCode MemWrite(uint16_t slave_addr, uint16_t mem_addr,
                           ConstRawData write_data, WriteOperation& op,
                           MemAddrLength mem_addr_size = MemAddrLength::BYTE_8,
                           bool in_isr = false) = 0;
```

- `slave_addr`：从设备地址，**不带 R/W 位**。
- `in_isr`：指示是否在中断上下文中发起/推进本次 I2C 操作（默认 `false`）。

`ReadOperation` / `WriteOperation` 的完成方式见 [Operation 操作模型](../core/core-op.md) 和 [BLOCK 超时与完成交接](../../adv_coding/driver/block_timeout_semantics.md)。

## 行为

- 一个 I2C 对象同时只处理一次传输，不排队。总线上一次传输尚未结束时，新的调用返回 `BUSY`。
- `BLOCK` 操作返回传输结果，等待超时返回 `TIMEOUT`。其他操作返回 `OK` 表示传输已经开始或已经完成，结果通过 `Operation` 通知。
- 长度超过后端构造参数 `dma_enable_min_size`（STM32、CH32 默认为 3，MSPM0 默认为 8）时，传输由 DMA 或中断完成；其余传输在调用内以轮询方式完成，调用返回前已执行回调或更新轮询状态。
- `slave_addr` 为 7 位地址时取 `0x00` 至 `0x7F`。STM32 后端在 CubeMX 中选择 10 位寻址时接受 `0x000` 至 `0x3FF`。
- STM32 后端的写入和 DMA 读取经过构造时传入的 `dma_buff`，数据长度不能超过它的大小；`MemRead()`、`MemWrite()` 对此有 `ASSERT` 检查。

## 特性总结

- 支持 I2C 设备读写与寄存器读写；
- 支持配置通信时钟频率；
- 寄存器访问支持 8/16 位地址；
- 接口统一，兼容异步/同步调用模型；
- 便于派生平台相关实现，支持跨平台适配。
