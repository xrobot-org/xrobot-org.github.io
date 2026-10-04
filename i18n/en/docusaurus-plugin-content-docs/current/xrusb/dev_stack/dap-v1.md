---
id: xrusb-dev-stack-daplinkv1
title: DAPLinkV1
sidebar_position: 5
---

# DAPLinkV1 Device Stack

This document describes XRUSB’s CMSIS-DAP v1 (HID) device-class implementation: `LibXR::USB::DapLinkV1Class<SwdPort>`.

This class targets CMSIS-DAP v1 host toolchains that still use HID Report transport. It supports SWD, and JTAG once a backend is set with `SetJtag()`; common DAP core commands; SWJ/SWD/JTAG sequences; and optional `nRESET` GPIO control.

Supported capabilities:

- CMSIS-DAP v1 HID transport
- SWD; with a JTAG backend set, `DAP_Connect` can also connect over JTAG
- Optional nRESET control (inject via `GPIO* nreset_gpio`)
- HID Interrupt IN/OUT transport
- DAP_Transfer / DAP_TransferBlock (including AP posted-read pipeline)

---

## 1. Class and Construction

### 1.1 `LibXR::USB::DapLinkV1Class<SwdPort>`

This is a template class. The template parameter `SwdPort` provides the underlying SWD capability.

Constructor:

```cpp
template <typename SwdPort>
explicit DapLinkV1Class(
    Endpoint::EPNumber in_ep_num,
    Endpoint::EPNumber out_ep_num,
    SwdPort& swd_link,
    LibXR::GPIO* nreset_gpio = nullptr);
```

Parameters:

- `in_ep_num` / `out_ep_num`: HID Interrupt IN/OUT endpoint numbers (required)
- `swd_link`: SWD link object reference
- `nreset_gpio`: optional nRESET GPIO

The interface string is fixed to `"CMSIS-DAP"`.

Common APIs:

- `SetInfoStrings(info)`: override `DAP_Info` strings
- `GetState()`: read internal DAP state
- `IsInited()`: whether bind/initialization has completed
- `SetJtag(jtag)`: set the JTAG backend (`LibXR::Debug::Jtag*`). Including `daplink_v1_profile_swd.hpp` disables JTAG at compile time and `SetJtag()` has no effect; JTAG is available when `daplink_v1.hpp` or `daplink_v1_profile_jtag.hpp` is included directly

### 1.2 InfoStrings

`DAP_Info` string set:

```cpp
struct InfoStrings
{
  const char* vendor;
  const char* product;
  const char* serial;
  const char* firmware_ver;

  const char* device_vendor;
  const char* device_name;
  const char* board_vendor;
  const char* board_name;
  const char* product_fw_ver;
};
```

---

## 2. Transport Model and HID Reports

`DapLinkV1Class` inherits from:

```cpp
HID<sizeof(DAPLINK_V1_REPORT_DESC), DapLinkV1Def::MAX_REQUEST_SIZE,
    DapLinkV1Def::MAX_RESPONSE_SIZE>
```

Constants:

- `MAX_REQUEST_SIZE = 64`
- `MAX_RESPONSE_SIZE = 64`

The HID report descriptor defines:

- a 64-byte Input Report
- a 64-byte Output Report
- a 64-byte Feature Report

Requests and responses travel over HID Interrupt OUT / IN. The Feature Report declared in the descriptor is not implemented: `GET_REPORT(Feature)` returns empty data and `SET_REPORT` returns not supported.

---

## 3. Lifecycle: Bind / Unbind

### 3.1 Bind

The bind stage mainly does the following:

- calls the HID base bind path and allocates IN/OUT endpoints
- initializes DAP runtime state:
  - `debug_port = DISABLED`
  - `transfer_abort = false`
  - `swj_clock_hz = 1MHz`
  - default SWJ shadow: SWDIO=1, nRESET=1, SWCLK=0
- arms OUT reception to process host HID Output Reports

### 3.2 Unbind

The unbind stage mainly does the following:

- closes the SWD backend
- releases HID IN/OUT endpoints
- resets shadow state (SWDIO=1, nRESET=1)

---

## 4. Key `DAP_Info` Fields

Current implementation behavior for key `DAP_Info` fields:

- `CAPABILITIES`: `DAP_CAP_SWD`, plus `DAP_CAP_JTAG` when a JTAG backend is set
- `PACKET_COUNT`: `1`
- `PACKET_SIZE`: `64`
- `TIMESTAMP_CLOCK`: `1,000,000`

Notes:

- `PACKET_SIZE` matches the fixed 64-byte HID v1 report size
- unlike DAPLinkV2, there is no variable Bulk packet-size exposure here

---

## 5. Supported Command Scope

Supported commands:

- `DAP_Info`
- `DAP_HostStatus`
- `DAP_Connect` / `DAP_Disconnect`
- `DAP_TransferConfigure`
- `DAP_Transfer`
- `DAP_TransferBlock`
- `DAP_TransferAbort`
- `DAP_WriteABORT`
- `DAP_Delay`
- `DAP_ResetTarget`
- `DAP_SWJ_Pins`
- `DAP_SWJ_Clock`
- `DAP_SWJ_Sequence`
- `DAP_SWD_Configure`
- `DAP_SWD_Sequence`
- `DAP_JTAG_Sequence` / `DAP_JTAG_Configure` / `DAP_JTAG_IDCODE` (when JTAG is available)
- `DAP_QueueCommands` / `DAP_ExecuteCommands`: return `<CMD, DAP_ERROR>`

Implementation boundary:

- `PACKET_COUNT` is fixed at `1`.

---

## 6. Runtime Behavior

This class maintains the SWJ shadow pin state, the current `debug_port` and the `transfer_abort` flag.

Requests are handled in three steps:

1. the host sends a HID Output Report over Interrupt OUT
2. the device parses the request in `OnDataOutComplete()` and writes the response into the IN endpoint buffer
3. if the IN endpoint is idle, the response is sent immediately; if a transfer is in progress, the response stays in the other half of the double buffer and is sent after the previous transfer completes

---

## 7. Usage Example

```cpp
#include "daplink_v1.hpp"

extern LibXR::Debug::Swd& swd;  // SWD backend provided by the platform
extern LibXR::GPIO& nreset;     // optional nRESET pin

using EPNumber = LibXR::USB::Endpoint::EPNumber;

LibXR::USB::DapLinkV1Class<LibXR::Debug::Swd> dap(EPNumber::EP1, EPNumber::EP1, swd,
                                                  &nreset);

LibXR::USB::DapLinkV1Class<LibXR::Debug::Swd>::InfoStrings info;
info.vendor = "XRobot";
info.product = "DAPLinkV1";
info.serial = "00000001";
info.firmware_ver = "1.0.0";
dap.SetInfoStrings(info);

// USB device class list: {{&dap}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

---

## 8. Difference from DAPLinkV2

- `DapLinkV1Class`: HID transport, `PACKET_SIZE=64`, `PACKET_COUNT=1`
- `DapLinkV2Class`: Bulk transport, default `PACKET_SIZE=1024`, `PACKET_COUNT=4`

If the host toolchain supports CMSIS-DAP v2 Bulk, `DapLinkV2Class` is generally preferred.
If compatibility with older host-side HID report paths is required, `DapLinkV1Class` is the appropriate class.
