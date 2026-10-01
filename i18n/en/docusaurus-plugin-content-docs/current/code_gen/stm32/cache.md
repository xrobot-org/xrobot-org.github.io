---
id: stm32-code-gen-cache
title: Cache
sidebar_position: 13
---

# Cache (High Performance Cache)

On STM32 H7/F7 parts with cache support, LibXR handles the cache coherency its drivers need; I-Cache and D-Cache only have to be enabled in CubeMX. The code generation setting related to the cache is **`dma_section`**, which places the DMA buffers of each peripheral into a given section; MPU and cache policies are configured in CubeMX and the linker script.

## Cache Basics

- According to `ST AN4839`, when MPU is disabled, SRAM regions default to `WBWA (Write-Back, Write-Allocate)`.
- Once MPU is enabled, cache policy can be further customized, but that is outside the scope of this page.
- The practical questions are: where the DMA buffer lives, whether that RAM is DMA-accessible, and whether cache synchronization is needed.

## DMA Buffer Memory Regions

Taking STM32H750 as an example, common internal RAM regions can be understood roughly like this:

- `AXI RAM`, `SRAM1~4`: DMA-accessible, but CPU/DMA sharing requires cache coherency handling
- `ITCMRAM`, `DTCMRAM`: CPU-local fast memory, usually not suitable as DMA buffer memory
- `SRAM4`: also reachable by `BDMA` on STM32H7

Whether a region can hold DMA buffers, in a simplified picture:

|      | AXI RAM | SRAM1 | SRAM2 | SRAM3 | SRAM4 | ITCMRAM | DTCMRAM |
| ---- | ------- | ----- | ----- | ----- | ----- | ------- | ------- |
| CPU  | ✅      | ✅    | ✅    | ✅    | ✅    | ✅      | ✅      |
| DMA1 | ✅      | ✅    | ✅    | ✅    | ✅    | ❌      | ❌      |
| DMA2 | ✅      | ✅    | ✅    | ✅    | ✅    | ❌      | ❌      |
| BDMA | ❌      | ❌    | ❌    | ❌    | ✅    | ❌      | ❌      |

Notes:

- `AXI RAM`, `SRAM1~4` work well for larger DMA buffers, but DMA access still needs cache coherency handling; this layer is handled by LibXR.
- `ITCMRAM`, `DTCMRAM` are good for CPU-hot data, but are not appropriate DMA buffer regions.
- `SRAM4` is the practical STM32H7 region for `BDMA`-limited peripherals.

For explicit placement, add matching sections to the linker script, for example:

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

## Configuration File

The generator reads `dma_section` directly and places the generated buffers into that section. For example:

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

Generation rules:

- `libxr gen` reads the `dma_section` of each instance and places that instance's DMA buffers into the section;
- left empty, `dma_section` is an empty string and the buffers go to the default `.bss`;
- on chips with a data cache (`__DCACHE_PRESENT` is 1), each buffer is aligned and padded to the cache line, so no other data shares a cache line with either end of a buffer; the array length, and so the DMA transfer length, stays the same.

## Generated Result

After regeneration, the buffers carry the matching `section` attribute. The buffers of `spi2` and `adc1` in an STM32H723 project, with `dma_section` set to `.axi_ram` and `.ram_d3`:

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

`XR_DCACHE_LINE_SIZE` is CMSIS's `__SCB_DCACHE_LINE_SIZE`, or 32 with older CMSIS versions that lack the macro.

## Usage

Business code usage is the same as in non-cache cases. The practical work is mainly:

- enable cache in `CubeMX`;
- place DMA buffers into DMA-accessible RAM regions;
- for explicit placement, keep the section names of the linker script and the `dma_section` values of `libxr_config.yaml` aligned.
