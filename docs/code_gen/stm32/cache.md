---
id: stm32-code-gen-cache
title: 高速缓存
sidebar_position: 13
---

# 高速缓存 (Cache)

在 STM32 H7/F7 等带 Cache 的系列中，LibXR 已经处理了 Cache 同步。用户只需要在 CubeMX 中开启 I-Cache 和 D-Cache，不需要再手工补一套 Cache 维护逻辑，也不需要为了 DMA 缓冲区再额外写一套 Cache 维护代码。

从当前 generator 的角度，这一页真正可配置的项主要是 **`dma_section`**：也就是把不同外设的 DMA 缓冲区放到你指定的 section，而不是在代码生成阶段直接生成一套 MPU/Cache 策略代码。

## Cache 配置基础

* 参考 `ST AN4839`：MPU 关闭时，SRAM 区域默认是 `WBWA (Write-Back, Write-Allocate)`。
* 开启 MPU 后，Cache 策略可以继续自定义，这里不展开。
* 真正需要关心的是：DMA 缓冲区放在哪块 RAM、这块 RAM 是否可被 DMA 访问，以及是否需要 Cache 同步。

## DMA 缓冲区内存分区

以 STM32H750 为例，其内部常见 RAM 区域可以粗略分成下面几类：

* `AXI RAM`、`SRAM1~4`：DMA 可访问，但 DMA 与 CPU 共享访问时需要 Cache 同步
* `ITCMRAM`、`DTCMRAM`：CPU 直连，通常不能给 DMA 当缓冲区
* `SRAM4`：在 STM32H7 上也是 `BDMA` 可访问区域

如果只看“能不能做 DMA Buffer”，可以按下面这张表理解：

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

如果你要显式控制 DMA 缓冲区所在区域，可以在链接脚本里增加 section，例如：

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

当前生成逻辑要点：

- `GeneratorCodeSTM32.py` 会按外设类别读取对应实例的 `dma_section`；
- 若用户未显式填写，当前 generator 会按 DMA 类型走内置默认 section 选择逻辑；
- 这一页更准确的作用是“让生成出来的缓冲区声明落在合适 section”，而不是在代码生成阶段替你完成所有 Cache/MPU 架构设计。

## 生成结果

重新生成后，缓冲区会带上对应的 `section` 属性，例如：

```cpp
static uint16_t adc3_buf[64] __attribute__((section(".ram_d3")));
static uint8_t spi4_tx_buf[32] __attribute__((section(".axi_ram")));
static uint8_t spi4_rx_buf[32] __attribute__((section(".axi_ram")));
static uint8_t usart1_tx_buf[128] __attribute__((section(".axi_ram")));
static uint8_t usart1_rx_buf[128] __attribute__((section(".axi_ram")));
static uint8_t i2c1_buf[32] __attribute__((section(".axi_ram")));
```

## 使用

使用方式与无 Cache 时一致，不需要额外改业务代码。实际要做的主要是：

* 在 `CubeMX` 里把 Cache 打开
* 把 DMA Buffer 放到 DMA 可访问的内存区域
* 如果你要手工指定区域，就在链接脚本和 `libxr_config.yaml` 里把 `section` 对上
