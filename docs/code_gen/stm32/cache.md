---
id: stm32-code-gen-cache
title: 高速缓存
sidebar_position: 13
---

# 高速缓存 (Cache)

在 STM32 H7/F7 等带 Cache 的系列中，LibXR 已经处理了 Cache 同步。用户只需要在 CubeMX 中开启 I-Cache 和 D-Cache，不需要再手工补一套 Cache 维护逻辑，也不需要为了 DMA 缓冲区再额外写一套 Cache 维护代码。

代码生成中与 Cache 相关的设置是 **`dma_section`**，用于把各外设的 DMA 缓冲区放到指定的 section；MPU 与 Cache 策略在 CubeMX 和链接脚本中配置。

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

需要显式控制 DMA 缓冲区所在区域时，在链接脚本里增加 section，例如：

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
- 未填写时 `dma_section` 为空字符串，缓冲区放在默认的 `.bss` 中；
- 带数据 Cache 的芯片（`__DCACHE_PRESENT` 为 1）上，每个缓冲区按 Cache 行对齐并补齐到整行，缓冲区两端不与其他数据共用 Cache 行；数组长度不变，DMA 传输长度也不变。

## 生成结果

重新生成后，缓冲区带上对应的 `section` 属性。下面是 STM32H723 工程中 `spi2` 和 `adc1` 的缓冲区，`dma_section` 分别为 `.axi_ram` 和 `.ram_d3`：

```cpp
#if defined(__DCACHE_PRESENT) && (__DCACHE_PRESENT == 1U)
static struct alignas(XR_DCACHE_LINE_SIZE)
{
  uint8_t data[32];
} spi2_tx_buf_storage __attribute__((section(".axi_ram")));
static constexpr auto& spi2_tx_buf = spi2_tx_buf_storage.data;
#else
alignas(4) static uint8_t spi2_tx_buf[32] __attribute__((section(".axi_ram")));
#endif
#if defined(__DCACHE_PRESENT) && (__DCACHE_PRESENT == 1U)
static struct alignas(XR_DCACHE_LINE_SIZE)
{
  uint16_t data[32];
} adc1_buf_storage __attribute__((section(".ram_d3")));
static constexpr auto& adc1_buf = adc1_buf_storage.data;
#else
alignas(4) static uint16_t adc1_buf[32] __attribute__((section(".ram_d3")));
#endif
```

`XR_DCACHE_LINE_SIZE` 取 CMSIS 的 `__SCB_DCACHE_LINE_SIZE`，旧版 CMSIS 中没有该宏时为 32。

## 使用

使用方式与无 Cache 时一致，不需要额外改业务代码。实际要做的主要是：

* 在 `CubeMX` 里把 Cache 打开
* 把 DMA Buffer 放到 DMA 可访问的内存区域
* 手工指定区域时，链接脚本中的 section 名与 `libxr_config.yaml` 中的 `dma_section` 保持一致
