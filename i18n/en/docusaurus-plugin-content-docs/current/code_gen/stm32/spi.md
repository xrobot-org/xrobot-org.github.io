---
id: stm32-code-gen-spi
title: SPI
sidebar_position: 8
---

# SPI

When both the transmit and the receive direction of an SPI have DMA enabled in STM32CubeMX, the generated SPI object uses DMA, and the SPI interrupt must be enabled as well. An SPI without DMA, or with DMA in one direction only, takes the polling path. Transmit and receive buffers are generated in both cases.

## Example

With DMA in both directions, the last argument is the DMA switching threshold, and transfers strictly longer than the threshold use DMA. With threshold `3`, a three-byte transfer does not use DMA and a four-byte transfer does:

```cpp
static STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
```

For an SPI that does not use DMA, the last argument is `UINT32_MAX` and transfers always take the polling path. An excerpt of the `app_main.cpp` generated for an STM32F103C8 project whose SPI1 has no DMA:

```cpp
alignas(4) static uint8_t spi1_rx_buf[32];
alignas(4) static uint8_t spi1_tx_buf[32];
// ...
  static STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, UINT32_MAX);
```

With DMA in one direction only, `libxr gen` warns and generates the SPI as one without DMA:

```text
[WARNING] SPI1 has DMA for RX only; an SPI uses DMA only with DMA for both RX and TX, so spi1 takes the polling path and its RX DMA channel is not used. Enable DMA for TX in STM32CubeMX to use DMA
```

## Configuration File

`User/libxr_config.yaml` has one entry per SPI instance. This one comes from a project with DMA in both directions:

```yaml
SPI:
  spi1:
    tx_buffer_size: 32
    rx_buffer_size: 32
    dma_section: ''
    dma_enable_min_size: 3
```

Generation rules:

- `tx_buffer_size` and `rx_buffer_size` are the sizes of the transmit and receive buffers in bytes;
- `dma_enable_min_size` is the last constructor argument of an SPI with DMA in both directions; for an SPI that does not use DMA this key is neither read nor written, and the last argument is `UINT32_MAX`;
- `dma_section` decides the section the buffers go to, see [Cache](./cache.md).

After editing the file, regenerate the code with the commands in [Regenerating the Code](./README.md#regenerating-the-code).
