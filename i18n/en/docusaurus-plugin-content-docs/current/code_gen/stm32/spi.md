---
id: stm32-code-gen-spi
title: SPI
sidebar_position: 8
---

# SPI

In STM32CubeMX, the corresponding DMA channels must be enabled and the SPI interrupt must also be configured. The transmit and receive DMA buffers are generated only for the directions with DMA enabled in CubeMX.

## Example

The last constructor argument is a DMA switching threshold tested with **strict greater-than**. With threshold `3`, a three-byte transfer does not enter that DMA branch; four bytes does.

```cpp
static STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
```

## Configuration File

After the previous generation step, an SPI section appears in `User/libxr_config.yaml`:

```yaml
SPI:
  spi1:
    tx_buffer_size: 32
    rx_buffer_size: 32
    dma_section: ''
    dma_enable_min_size: 3
```

Generation rules:

- without DMA on the transmit direction, the transmit buffer argument is `{nullptr, 0}`, and likewise for receive;
- `dma_enable_min_size` is the last argument of the `STM32SPI` constructor;
- `dma_section` decides the section the buffers go to, see [Cache](./cache.md).
