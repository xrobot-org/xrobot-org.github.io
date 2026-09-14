---
id: stm32-code-gen-i2c
title: I2C
sidebar_position: 9
---

# I2C

In STM32CubeMX, the matching I2C DMA channels and interrupts should be configured.

From the current generator’s perspective, this page mainly covers two generated parameters: the **shared buffer size** and the **DMA enable threshold**.

## Example

The last constructor argument is the DMA switching threshold. The relevant branch requires the transfer length to be **strictly greater** than this value.

```cpp
STM32I2C i2c1(&hi2c1, i2c1_buf, 3);
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

Current generation details:

- the generator emits one shared buffer per I2C instance, for example `i2c1_buf`;
- `dma_enable_min_size` is currently emitted directly as the last argument of `STM32I2C(..., dma_enable_min_size)`;
- `dma_section` only affects where the buffer declaration is placed, and does not change the `STM32I2C` constructor shape itself.
