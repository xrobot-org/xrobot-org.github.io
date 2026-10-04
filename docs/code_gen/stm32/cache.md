---
id: stm32-code-gen-cache
title: 高速缓存
sidebar_position: 14
---

# 高速缓存 (Cache)

在 STM32 H7/F7 等带 Cache 的系列中，LibXR 的驱动在 DMA 传输前后维护数据 Cache，在 CubeMX 中开启 I-Cache 和 D-Cache 即可。

代码生成中与 Cache 相关的设置是 **`dma_section`**，用于把各外设的 DMA 缓冲区放到指定的 section；MPU 与 Cache 策略在 CubeMX 和链接脚本中配置。

## Cache 配置基础

* 参考 `ST AN4839`：MPU 关闭时，SRAM 区域默认是 `WBWA (Write-Back, Write-Allocate)`。
* 开启 MPU 后，Cache 策略可以继续自定义，这里不展开。
* 需要确定的是：DMA 缓冲区放在哪块 RAM、这块 RAM 能否被 DMA 访问，以及是否需要 Cache 同步。

## DMA 缓冲区内存分区

以 STM32H750 为例，其内部常见 RAM 区域可以粗略分成下面几类：

* `AXI RAM`、`SRAM1~4`：DMA 可访问，但 DMA 与 CPU 共享访问时需要 Cache 同步
* `ITCMRAM`、`DTCMRAM`：CPU 直连，通常不能给 DMA 当缓冲区
* `SRAM4`：在 STM32H7 上也是 `BDMA` 可访问区域

各 RAM 区域能否用作 DMA 缓冲区如下表（简化）：

|      | AXI RAM | SRAM1 | SRAM2 | SRAM3 | SRAM4 | ITCMRAM | DTCMRAM |
| ---- | ------- | ----- | ----- | ----- | ----- | ------- | ------- |
| CPU  | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅      |
| DMA1 | ✅      | ✅    | ✅    | ✅    | ✅    | ❌      | ❌      |
| DMA2 | ✅      | ✅    | ✅    | ✅    | ✅    | ❌      | ❌      |
| BDMA | ❌      | ❌    | ❌    | ❌    | ✅    | ❌      | ❌      |

说明：

* `AXI RAM`、`SRAM1~4` 适合做大容量 DMA 缓冲区，但 DMA 访问后需要处理 Cache 一致性；这一层由 LibXR 负责
* `ITCMRAM`、`DTCMRAM` 适合放 CPU 高频访问的数据，但不适合做 DMA Buffer
* `SRAM4` 更适合给 `BDMA` 这类受限 DMA 控制器用

链接脚本把 `.bss` 放在 DMA 不能访问的 RAM 中时（例如 STM32CubeMX 为 STM32H7 生成的链接脚本中的 DTCMRAM），或需要显式控制 DMA 缓冲区所在区域时，在链接脚本里增加 section，例如：

```ld
.ram_d3 (NOLOAD) :
{
  . = ALIGN(4);
  *(.ram_d3)
  *(.ram_d3*)
  . = ALIGN(4);
} >RAM_D3

.axi_ram (NOLOAD) :
{
  . = ALIGN(4);
  *(.axi_ram)
  *(.axi_ram*)
  . = ALIGN(4);
} >RAM
```

## 配置文件

代码生成工具会直接读取 `dma_section`，并把对应缓冲区放进指定 section。例如：

```yaml
SPI:
  spi4:
    tx_buffer_size: 32
    rx_buffer_size: 32
    dma_section: '.axi_ram'
    dma_enable_min_size: 3
I2C:
  i2c1:
    buffer_size: 32
    dma_section: '.axi_ram'
    dma_enable_min_size: 3
USART:
  usart1:
    tx_buffer_size: 128
    rx_buffer_size: 128
    dma_section: '.axi_ram'
    tx_queue_size: 5
ADC:
  adc3:
    buffer_size: 128
    dma_section: '.ram_d3'
    vref: 3.3
```

生成规则：

- `libxr gen` 读取每个实例的 `dma_section`，把该实例的 DMA 缓冲区放进这个 section；
- 未填写时 `dma_section` 为空字符串，缓冲区放在默认的 `.bss` 中。STM32CubeMX 为 STM32H7 生成的链接脚本把 `.data` 和 `.bss` 放在 DTCMRAM，DMA1、DMA2 和 BDMA 都不能访问，这类工程需要为每个使用 DMA 的实例设置 `dma_section`；
- STM32F7、H7、H7RS 和 N6 有数据 Cache，每个缓冲区按 32 字节的 Cache 行对齐，数组长度向上取整到整行，缓冲区两端不与其他数据共用 Cache 行，传给驱动的长度仍是设置的大小；其他系列的缓冲区按 4 字节对齐。系列不在生成器的已知列表中时按有数据 Cache 处理，并给出警告。

## 生成结果

重新生成后，缓冲区带上对应的 `section` 属性。下面是一个 STM32H723 工程中的部分缓冲区，`adc1` 和 `spi2` 的 `dma_section` 为 `.axi_ram`，`spi6` 的为 `.ram_d3`（节选）：

```cpp
// DMA buffers (STM32H723VG: D-cache, 32-byte lines)
alignas(32) static uint16_t adc1_buf[128] __attribute__((section(".axi_ram")));
alignas(32) static uint8_t spi2_rx_buf[32] __attribute__((section(".axi_ram")));
alignas(32) static uint8_t spi2_tx_buf[32] __attribute__((section(".axi_ram")));
alignas(32) static uint8_t spi6_tx_buf[32] __attribute__((section(".ram_d3")));
// ...
```

`usart1` 的 `tx_buffer_size` 为 100、`dma_section` 为空时生成 `alignas(32) static uint8_t usart1_tx_buf[128];`，构造函数中写作 `{usart1_tx_buf, 100}`。

## 使用

使用方式与无 Cache 时一致，业务代码不需要改动。需要完成的是：

* 在 `CubeMX` 里把 Cache 打开
* 把 DMA Buffer 放到 DMA 可访问的内存区域
* 手工指定区域时，链接脚本中的 section 名与 `libxr_config.yaml` 中的 `dma_section` 保持一致
