---
id: perf-daplink
title: DAPLink (SWD) Performance Test
sidebar_position: 4
---

# DAPLink (CMSIS-DAP v2 / SWD) Performance Test

## Test Setup

- Probe: custom DAPLink (CMSIS-DAP v2)
  - MCU: CH32V307 @ 144 MHz
  - SWD: GPIO bit-banging (`SwdGeneralGPIO`)
- USB: USBHS (High-Speed)
  - Endpoint type: Bulk
  - MaxPacketSize: 512
- Compiler optimization: `-O3`
- Target: STM32F401RC
- SWD clock: `SwdGeneralGPIO` uses `loops_per_us = 0` (no-delay path; SWCLK is set by GPIO toggle speed and the host Speed setting does not change it), measured about 10 MHz

![daplink-benchmark](/img/dap.png)

## Test Code

```cpp
static constexpr auto USB_OTG_HS_LANG_PACK =
      LibXR::USB::DescriptorStrings::MakeLanguagePack(
          LibXR::USB::DescriptorStrings::Language::EN_US,
          "XRobot", "CMSIS-DAP", "XROBOT-XRDAP-");

LibXR::USB::CDCUart cdc(128, 128, 3);

LibXR::Debug::SwdGeneralGPIO<decltype(PA0), decltype(PA4)> swd(PA0, PA4, 0);

LibXR::USB::DapLinkV2Class<decltype(swd)> dap(swd);

LibXR::CH32USBOtgHS usb_dev_hs(
    ...
    /* config */
    {{&dap, &cdc}},
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
...
```

## Methodology

This benchmark includes two groups of metrics:

1) Throughput (different block sizes): use `probe-rs` benchmark output with the following fixed parameters:
- Speed=10000
- Word size=32bit
- Iterations=32
- Vary Data length: 32 / 128 / 2048 / 32768 bytes

2) SRAM read/write upper bound (fixed length): use OpenOCD + TCL scripts to measure write/read/e2e timing over a specified SRAM address range.

## Results

### Throughput (different block sizes)

Speed=10000, Word size=32bit, Iterations=32:

- Data length = 32 bytes
  - Read : 167394.75 bytes/s (Std Dev 26285.19)
  - Write: 164495.92 bytes/s (Std Dev 35468.60)

- Data length = 128 bytes
  - Read : 365890.08 bytes/s (Std Dev 42441.94)
  - Write: 376733.44 bytes/s (Std Dev 66519.33)

- Data length = 2048 bytes
  - Read : 596184.47 bytes/s (Std Dev 19107.54)
  - Write: 613571.24 bytes/s (Std Dev 34987.02)

- Data length = 32768 bytes
  - Read : 598801.08 bytes/s (Std Dev 9090.12)
  - Write: 625560.76 bytes/s (Std Dev 12092.70)

### SRAM Read/Write Upper Bound (fixed length)

- SRAM_WRITE_LIMIT: 49152 bytes in 0.066248 s (724.55 KiB/s)
- SRAM_READ: 49152 bytes in 0.069153 s (694.11 KiB/s)
- SRAM_E2E (write+read): 98304 bytes in 0.135401 s (709.01 KiB/s)

## Summary

This benchmark measures SRAM access throughput on an STM32F401RC target using a CH32V307-based USBHS (512B Bulk) CMSIS-DAP v2 implementation (DAPLink) with GPIO bit-banged SWD.

Under Speed=10000, 32-bit accesses, and 32 iterations, large transfers (2 KB to 32 KB) achieve stable read/write throughput around 0.6 MB/s. For a fixed length of 48 KiB, end-to-end SRAM throughput (write+read) is about 709 KiB/s.
