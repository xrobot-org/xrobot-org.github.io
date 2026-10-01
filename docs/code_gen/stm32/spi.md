---
id: stm32-code-gen-spi
title: SPI
sidebar_position: 8
---

# SPI

需要在STM32CubeMX中开启对应的dma通道，然后使能SPI中断。

对当前 generator 来说，这一页主要覆盖的是**缓冲区声明 + 实例构造参数**。是否真的生成 DMA 缓冲区，取决于 CubeMX 中该 SPI 实例的 `DMA_TX / DMA_RX` 是否启用。

## 示例

最后一个参数决定了开启dma传输的最小字节数，小于该值的数据不会开启dma传输。

```cpp
STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
```

## 配置文件

在上一步代码生成后，会在`User/libxr_config.yaml`文件中出现SPI配置文件，格式如下：

```yaml
SPI:
  spi1:
    tx_buffer_size: 32
    rx_buffer_size: 32
    dma_section: ''
    dma_enable_min_size: 3
```

当前生成逻辑要点：

- `DMA_TX` 未启用时，构造参数中的 TX buffer 会退化成 `{nullptr, 0}`；
- `DMA_RX` 未启用时，RX buffer 会退化成 `{nullptr, 0}`；
- `dma_enable_min_size` 当前会直接作为 `STM32SPI(..., dma_enable_min_size)` 的最后一个参数生成。

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`libxr stm32 setup -d .`  
或  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
