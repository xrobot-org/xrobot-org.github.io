---
id: jtag
title: JTAG Debug Interface
sidebar_position: 2
---

# JTAG Debug Interface

`LibXR::Debug::Jtag` defines TAP state control and IR/DR shifting. Current implementations include the GPIO bit-bang backend `JtagGeneralGPIO` and the DP/AP transaction layer `JtagDp`.

## Jtag base class

```cpp
virtual ErrorCode SetClockHz(uint32_t hz) = 0;
virtual void Close() = 0;
virtual ErrorCode ResetTap() = 0;
virtual ErrorCode GotoState(TapState target) = 0;
virtual ErrorCode ShiftIR(uint32_t bits,
                          const uint8_t* in_lsb_first,
                          uint8_t* out_lsb_first) = 0;
virtual ErrorCode ShiftDR(uint32_t bits,
                          const uint8_t* in_lsb_first,
                          uint8_t* out_lsb_first) = 0;
virtual ErrorCode Sequence(uint32_t cycles, bool tms,
                           const uint8_t* tdi_lsb_first,
                           uint8_t* tdo_lsb_first) = 0;
virtual void IdleClocks(uint32_t cycles) = 0;
```

IR/DR data is LSB-first. A null input shifts zeroes; a null output discards TDO.

## GPIO backend

```cpp
#include "debug/jtag_general_gpio.hpp"

LibXR::Debug::JtagGeneralGPIO<decltype(tck), decltype(tms),
                            decltype(tdi), decltype(tdo)>
    jtag(tck, tms, tdi, tdo, loops_per_us, 500000);
```

Construction configures TCK/TMS/TDI/TDO and resets TAP. `loops_per_us` calibrates software delay; target TCK is set through `SetClockHz()`.

The GPIO `GotoState()` directly handles RESET, IDLE, SHIFT_IR and SHIFT_DR. `ShiftIR()` and `ShiftDR()` return to IDLE when complete.

## JTAG-DP

```cpp
#include "debug/jtag_dp.hpp"

LibXR::Debug::JtagDp dp(jtag);
uint32_t idcode = 0;
auto result = dp.ReadIdCode(idcode);
```

`DpReadTxn()` and `ApReadTxn()` handle pipelined JTAG-DP reads by fetching the result from RDBUFF after the read request. Low-level `DpRead()` / `DpWrite()` perform one DP transaction directly.

Multi-device chains use `JtagProtocol::ChainConfig` to specify device count, selected index and IR lengths. Call `SetChainConfig()` when chain configuration changes.

## CMSIS-DAP

CMSIS-DAP v1/v2 JTAG profiles bind the same backend through `SetJtag()`. See [DAP v1](../xrusb/dev_stack/dap-v1.md) and [DAP v2](../xrusb/dev_stack/dap.md) for profile and USB endpoint configuration.
