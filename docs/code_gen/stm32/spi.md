---
id: stm32-code-gen-spi
title: SPI
sidebar_position: 8
---

# SPI

需要在STM32CubeMX中开启对应的dma通道，然后使能SPI中断。发送和接收的 DMA 缓冲区只在 CubeMX 中为该方向开启了 DMA 时生成。

## 示例

最后一个参数是 DMA 切换阈值，相关判断使用**严格大于**。阈值为 `3` 时，等于 3 字节并不会进入该 DMA 分支。

```cpp
static STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
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

生成规则：

- 发送方向没有 DMA 时，构造参数中的发送缓冲区为 `{nullptr, 0}`，接收方向同理；
- `dma_enable_min_size` 作为 `STM32SPI` 构造函数的最后一个参数；
- `dma_section` 决定缓冲区所在的 section，见 [Cache](./cache.md)。

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`libxr stm32 setup -d .`  
或  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
