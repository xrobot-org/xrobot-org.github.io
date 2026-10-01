---
id: stm32-code-gen-i2c
title: I2C
sidebar_position: 9
---

# I2C

In STM32CubeMX, the I2C runs in I2C mode (SMBus mode uses an SMBUS handle), with the matching DMA channels and interrupts configured.

## Example

The last constructor argument is the minimum transfer size required before DMA is enabled.

```cpp
static STM32I2C i2c1(&hi2c1, i2c1_buf, 3);
```

## Configuration File

After code generation, the following I2C section appears in `User/libxr_config.yaml`:

```yaml
I2C:
  i2c1:
    buffer_size: 32
    dma_section: ''
    dma_enable_min_size: 3
```

- `buffer_size`: shared I2C transfer / receive buffer size
- `dma_section`: linker section for the generated buffer declaration
- `dma_enable_min_size`: minimum transfer byte count to enable DMA

Generation rules:

- each I2C instance gets one buffer shared by transmit and receive, for example `i2c1_buf`, of `buffer_size` bytes;
- `dma_enable_min_size` is the last argument of the `STM32I2C` constructor;
- `dma_section` decides the section the buffer goes to, see [Cache](./cache.md);
- FMPI2C peripherals get no object and `libxr parse` warns about them; LibXR has no FMPI2C driver.
