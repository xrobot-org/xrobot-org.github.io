---
id: stm32-code-gen-spi
title: SPI
sidebar_position: 8
---

# SPI

SPI 的发送和接收两个方向都在 STM32CubeMX 中开启了 DMA 时，生成的 SPI 对象使用 DMA，这时还需要使能 SPI 中断。没有开启 DMA，或只有一个方向开启了 DMA 的 SPI 走轮询路径。两种情况都生成发送和接收缓冲区。

## 示例

两个方向都有 DMA 时，最后一个参数是 DMA 切换阈值，长度严格大于阈值的传输走 DMA。阈值为 `3` 时，3 字节的传输不走 DMA，4 字节的传输走 DMA：

```cpp
static STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
```

不使用 DMA 的 SPI，最后一个参数为 `UINT32_MAX`，传输总是走轮询路径。以下节选自 SPI1 没有开启 DMA 的 STM32F103C8 工程生成的 `app_main.cpp`：

```cpp
alignas(4) static uint8_t spi1_rx_buf[32];
alignas(4) static uint8_t spi1_tx_buf[32];
// ...
  static STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, UINT32_MAX);
```

只有一个方向开启了 DMA 时，`libxr gen` 给出警告，并按不使用 DMA 生成这个 SPI：

```text
[警告] SPI1 只有 RX 方向开启了 DMA；SPI 只在 RX 和 TX 都有 DMA 时使用 DMA，spi1 走轮询路径，RX 的 DMA 通道不被使用。需要 DMA 时请在 STM32CubeMX 中为 TX 开启 DMA
```

## 配置文件

`User/libxr_config.yaml` 中每个 SPI 实例一项。以下取自两个方向都开启了 DMA 的工程：

```yaml
SPI:
  spi1:
    tx_buffer_size: 32
    rx_buffer_size: 32
    dma_section: ''
    dma_enable_min_size: 3
```

生成规则：

- `tx_buffer_size`、`rx_buffer_size` 是发送和接收缓冲区的字节数；
- `dma_enable_min_size` 是两个方向都有 DMA 的 SPI 的最后一个构造参数；不使用 DMA 的 SPI 不读取也不写入这个键，最后一个参数为 `UINT32_MAX`；
- `dma_section` 决定缓冲区所在的 section，见 [Cache](./cache.md)。

修改该文件后重新生成代码，命令见[重新生成代码](./README.md#重新生成代码)。
