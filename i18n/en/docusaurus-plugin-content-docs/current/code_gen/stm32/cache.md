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

When the linker script puts `.bss` in RAM that DMA cannot reach (such as DTCMRAM in the linker scripts STM32CubeMX generates for STM32H7), or for explicit placement, add matching sections to the linker script, for example:

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
- left empty, `dma_section` is an empty string and the buffers go to the default `.bss`. The linker scripts STM32CubeMX generates for STM32H7 put `.data` and `.bss` in DTCMRAM, which DMA1, DMA2 and BDMA cannot reach, so such projects set `dma_section` for every instance that uses DMA;
- STM32F7, H7, H7RS and N6 have a data cache: each buffer is aligned to the 32-byte cache line and its array length is rounded up to whole lines, so no other data shares a cache line with either end of a buffer, while the driver still receives the configured size; on the other families buffers are aligned to 4 bytes. A family missing from the generator's known lists is treated as having a data cache, with a warning.

## Generated Result

After regeneration, the buffers carry the matching `section` attribute. Some of the buffers of an STM32H723 project, with `dma_section` set to `.axi_ram` for `adc1` and `spi2` and to `.ram_d3` for `spi6` (excerpt):

```cpp
// DMA buffers (STM32H723VG: D-cache, 32-byte lines)
alignas(32) static uint16_t adc1_buf[128] __attribute__((section(".axi_ram")));
alignas(32) static uint8_t spi2_rx_buf[32] __attribute__((section(".axi_ram")));
alignas(32) static uint8_t spi2_tx_buf[32] __attribute__((section(".axi_ram")));
alignas(32) static uint8_t spi6_tx_buf[32] __attribute__((section(".ram_d3")));
// ...
```

With a `tx_buffer_size` of 100 and an empty `dma_section`, `usart1` gets `alignas(32) static uint8_t usart1_tx_buf[128];` and the constructor receives `{usart1_tx_buf, 100}`.

## Usage

Business code usage is the same as in non-cache cases. The practical work is mainly:

- enable cache in `CubeMX`;
- place DMA buffers into DMA-accessible RAM regions;
- for explicit placement, keep the section names of the linker script and the `dma_section` values of `libxr_config.yaml` aligned.
