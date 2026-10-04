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


## 特性总结

- 支持 I2C 设备读写与寄存器读写；
- 支持配置通信时钟频率；
- 寄存器访问支持 8/16 位地址；
- 接口统一，兼容异步/同步调用模型；
- 便于派生平台相关实现，支持跨平台适配。
