---
id: stm32-code-gen-spi
title: SPI
sidebar_position: 8
---

# SPI

In STM32CubeMX, the corresponding DMA channels must be enabled and the SPI interrupt must also be configured.

From the current generator’s perspective, this page mainly covers **buffer declarations + constructor arguments**. Whether DMA buffers are actually generated depends on whether `DMA_TX / DMA_RX` are enabled for that SPI instance in CubeMX.

## Example

The last constructor argument is a DMA switching threshold tested with **strict greater-than**. With threshold `3`, a three-byte transfer does not enter that DMA branch; four bytes does.

```cpp
STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
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

Current generation details:

- when `DMA_TX` is not enabled, the TX buffer constructor argument falls back to `{nullptr, 0}`;
- when `DMA_RX` is not enabled, the RX buffer constructor argument falls back to `{nullptr, 0}`;
- `dma_enable_min_size` is currently emitted directly as the last argument of `STM32SPI(..., dma_enable_min_size)`.
