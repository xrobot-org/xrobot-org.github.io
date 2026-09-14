---
id: xrusb-dev-stack-daplinkv1
title: DAPLinkV1
sidebar_position: 5
---

# DAPLinkV1 Device Stack

This document describes XRUSB’s **CMSIS-DAP v1 (HID)** device-class implementation: `LibXR::USB::DapLinkV1Class<SwdPort>`.

This class targets CMSIS-DAP v1 host toolchains that still use **HID Report** transport. Current mainline focuses on **SWD**, supports common DAP core commands, SWJ/SWD control sequences, and optional `nRESET` GPIO control.

Supported capabilities:

- **CMSIS-DAP v1 HID transport**
- **SWD with optional JTAG**: direct `daplink_v1.hpp` builds JTAG support; JTAG is advertised/used after `SetJtag()` binds a backend. `daplink_v1_profile_swd.hpp` builds an SWD-only profile.
- **Optional nRESET control** (inject via `GPIO* nreset_gpio`)
- **HID IN/OUT + Feature Report** transport path
- **DAP_Transfer / DAP_TransferBlock** (including AP posted-read pipeline)

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

- `swd_link`: SWD link object reference
- `nreset_gpio`: optional nRESET GPIO
- `in_ep_num` / `out_ep_num`: HID IN/OUT endpoint numbers; auto allocation is supported

Common APIs:

- `SetInfoStrings(info)`: override `DAP_Info` strings
- `GetState()`: read internal DAP state
- `IsInited()`: whether bind/initialization has completed

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

Current mainline constants:

- `MAX_REQUEST_SIZE = 64`
- `MAX_RESPONSE_SIZE = 64`
- `PACKET_COUNT_ADVERTISED = 1`

The HID report descriptor defines:

- a 64-byte **Input Report**
- a 64-byte **Output Report**
- a 64-byte **Feature Report**

So this class uses **HID report transport**, not the Bulk transport model used by DAPLinkV2.

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
- clears response-queue and shadow state

---

## 4. Key `DAP_Info` Fields

Current implementation behavior for key `DAP_Info` fields:

- `CAPABILITIES`: always includes SWD; adds JTAG when JTAG is compiled and a backend is bound
- `PACKET_COUNT`: `1`
- `PACKET_SIZE`: `64`
- `TIMESTAMP_CLOCK`: `1,000,000`

Notes:

- `PACKET_SIZE` matches the fixed 64-byte HID v1 report size
- unlike DAPLinkV2, there is no variable Bulk packet-size exposure here

---

## 5. Supported Command Scope

Current mainline covers a command family broadly similar to DAPLinkV2, but on a different transport:

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

Implementation boundary:

- JTAG commands are available in a JTAG-enabled profile after `SetJtag()` binds a backend; the SWD-only profile excludes them
- `PACKET_COUNT` is fixed at `1`, so there is no DAPLinkV2-style host-visible multi-packet response depth

---

## 6. Runtime Behavior

This class maintains:

- SWJ shadow pin state
- current `debug_port`
- `transfer_abort` flag
- a HID response queue whose depth matches `PACKET_COUNT_ADVERTISED`

The request path is roughly:

1. host sends a HID Output Report
2. device parses it in `OnDataOutComplete()`
3. response data is returned through HID Input / Feature Report paths

---

## 7. Usage Example

```cpp
#include "daplink_v1.hpp"
#include "usb/device.hpp"
#include "debug/swd.hpp"

MySwdBackend swd(/* ... init ... */);
MyGpio nreset(/* ... optional ... */);

using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::DapLinkV1Class<MySwdBackend> dap(EP::EP1, EP::EP1, swd, &nreset);

LibXR::USB::DapLinkV1Class<MySwdBackend>::InfoStrings info;
info.vendor = "XRobot";
info.product = "DAPLinkV1";
info.serial = "00000001";
info.firmware_ver = "1.0.0";
dap.SetInfoStrings(info);

// USB device class list: {{&dap}}
// usb_dev.Init();
// usb_dev.Start();
```

---

## 8. Difference from DAPLinkV2

- `DapLinkV1Class`: **HID transport**, `PACKET_SIZE=64`, `PACKET_COUNT=1`
- `DapLinkV2Class`: **Bulk transport**, current mainline default host-visible `PACKET_SIZE=1024`, `PACKET_COUNT=4`

If the host toolchain supports CMSIS-DAP v2 Bulk, `DapLinkV2Class` is generally preferred.
If compatibility with older host-side HID report paths is required, `DapLinkV1Class` is the appropriate class.
