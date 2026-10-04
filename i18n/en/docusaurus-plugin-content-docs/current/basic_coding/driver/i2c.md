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

## Behavior

- An I2C object handles one transfer at a time and does not queue. While the previous transfer on the bus is still running, a new call returns `BUSY`.
- A `BLOCK` operation returns the transfer result, or `TIMEOUT` when the wait times out. Other operations return `OK` to mean that the transfer has started or has already completed; the result is reported through the `Operation`.
- When the length exceeds the backend constructor parameter `dma_enable_min_size` (3 by default on STM32 and CH32, 8 on MSPM0), the transfer runs by DMA or interrupts; other transfers complete by polling inside the call, and the callback has run or the polling status has been updated before the call returns.
- A 7-bit `slave_addr` takes `0x00`–`0x7F`. The STM32 backend accepts `0x000`–`0x3FF` when 10-bit addressing is selected in CubeMX.
- Writes and DMA reads on the STM32 backend go through the `dma_buff` passed to the constructor, so the data length cannot exceed its size; `MemRead()` and `MemWrite()` check this with an `ASSERT`.

## Feature Summary

- Supports reading and writing I2C devices and their registers;  
- Allows configuration of communication clock speed;  
- Register access supports 8-bit and 16-bit addresses;  
- Unified interface compatible with both asynchronous and synchronous operation models;  
- Facilitates platform-specific subclassing for cross-platform adaptation.
