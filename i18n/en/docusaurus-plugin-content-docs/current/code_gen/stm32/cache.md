---
id: stm32-code-gen-cache
title: Cache
sidebar_position: 13
---

# Cache (High Performance Cache)

On STM32 H7/F7 parts with cache support, LibXR already handles the cache-coherency side needed by its current driver paths. In practice, users mainly need to enable I-Cache and D-Cache in CubeMX. The generator's only configuration option on this page is **`dma_section`**, which places DMA buffers into the section you choose. It does not generate an MPU/cache policy for you.

## Cache Basics

- According to `ST AN4839`, when MPU is disabled, SRAM regions default to `WBWA (Write-Back, Write-Allocate)`.
- Once MPU is enabled, cache policy can be further customized, but that is outside the scope of this page.
- The practical questions are: where the DMA buffer lives, whether that RAM is DMA-accessible, and whether cache synchronization is needed.

## DMA Buffer Memory Regions

Taking STM32H750 as an example, common internal RAM regions can be understood roughly like this:

- `AXI RAM`, `SRAM1~4`: DMA-accessible, but CPU/DMA sharing requires cache coherency handling
- `ITCMRAM`, `DTCMRAM`: CPU-local fast memory, usually not suitable as DMA buffer memory
- `SRAM4`: also reachable by `BDMA` on STM32H7

If you only care whether a region can be used as DMA buffer memory, the simplified picture is:

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

If you want explicit placement, add matching sections to the linker script, for example:

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

Current generator-side behavior:

- `GeneratorCodeSTM32.py` reads the per-instance `dma_section` field for the relevant peripheral class;
- if the user leaves it empty, the current generator falls back to its built-in default section-selection logic.

## Generated Result

After regeneration, the buffer declarations carry the matching `section` attribute, for example:

```cpp
static uint16_t adc3_buf[64] __attribute__((section(".ram_d3")));
static uint8_t spi4_tx_buf[32] __attribute__((section(".axi_ram")));
static uint8_t spi4_rx_buf[32] __attribute__((section(".axi_ram")));
static uint8_t usart1_tx_buf[128] __attribute__((section(".axi_ram")));
static uint8_t usart1_rx_buf[128] __attribute__((section(".axi_ram")));
static uint8_t i2c1_buf[32] __attribute__((section(".axi_ram")));
```

## Usage

Business code usage is the same as in non-cache cases. The practical work is mainly:

- enable cache in `CubeMX`;
- place DMA buffers into DMA-accessible RAM regions;
- if you want explicit placement, keep the linker script and `libxr_config.yaml` section names aligned.
