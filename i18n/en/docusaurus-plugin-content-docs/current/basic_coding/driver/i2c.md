---
id: i2c
title: I2C
sidebar_position: 3
---

# I2C (Inter-Integrated Circuit)

`LibXR::I2C` provides a platform-independent interface for I2C bus communication. It supports reading and writing devices and registers, and configuring communication speed, making it suitable for peripheral control, sensor access, and similar applications.

## Interface Overview

### Enum Types

```cpp
enum class MemAddrLength : uint8_t {
  BYTE_8,
  BYTE_16
};
```

### Configuration Structure

```cpp
struct Configuration {
  uint32_t clock_speed;  // Communication clock speed (in Hz)
};
```

### Core Methods

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

- `slave_addr`: target I2C slave address, **without the R/W bit**.
- `in_isr`: whether this I2C operation is initiated/progressed in ISR context (default `false`).

See [Operation Model](../core/core-op.md) and [BLOCK Timeout and Completion Handoff](../../adv_coding/driver/block_timeout_semantics.md) for completion modes of `ReadOperation` / `WriteOperation`.

## Feature Summary

- Supports reading and writing I2C devices and their registers;  
- Allows configuration of communication clock speed;  
- Register access supports 8-bit and 16-bit addresses;  
- Unified interface compatible with both asynchronous and synchronous operation models;  
- Facilitates platform-specific subclassing for cross-platform adaptation.
