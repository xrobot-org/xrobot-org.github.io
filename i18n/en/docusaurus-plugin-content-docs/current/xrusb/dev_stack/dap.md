---
id: xrusb-dev-stack-daplinkv2
title: DAPLinkV2
sidebar_position: 5
---

# DAPLinkV2 Device Stack

This document describes XRUSB’s **CMSIS-DAP v2 (Bulk)** device-class implementation: `LibXR::USB::DapLinkV2Class<SwdPort>`. A known-working test VID:PID is `0x0D28:0x2040`, with BCD version `0x0201`.

This class targets common CMSIS-DAP v2 host toolchains (e.g., pyOCD, OpenOCD CMSIS-DAP backend, DAPLink-compatible clients) using **USB Bulk transport**. It uses a **single Vendor interface + two Bulk endpoints (1 IN + 1 OUT)**, implements a practical subset of DAP v2 commands (SWD-focused), and advertises plug-and-play **WinUSB (MS OS 2.0)** capability on Windows.

Since DAPLink commonly declares itself as a composite device, this class is typically used together with other USB classes (e.g., CDC virtual COM). Hosts also often look for devices containing the `CMSIS-DAP` string, so the recommended LanguagePack is:

```cpp
static constexpr auto USB_FS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US, "XRobot", "CMSIS-DAP",
        "XRUSB-DEMO-XRDAP-");
```

Supported features:

- **CMSIS-DAP v2 Bulk transport**
- **SWD with optional JTAG**: direct `daplink_v2.hpp` builds JTAG support; `SetJtag()` enables JTAG capability after binding a backend. `daplink_v2_profile_swd.hpp` builds an SWD-only profile.
- **Optional nRESET control** (inject via `GPIO* nreset_gpio`; disabled by default)
- **SWJ_Pins shadow semantics** (SWDIO/SWCLK are exposed via shadow state; if wired, nRESET can report the physical level)
- **WinUSB (MS OS 2.0) BOS platform capability** (CompatibleID="WINUSB" + DeviceInterfaceGUIDs)
- **DAP_Transfer / DAP_TransferBlock** (includes AP posted-read pipeline; Transfer supports match / timestamp constraint checks)

---

## 1. Class and Construction

### 1.1 `LibXR::USB::DapLinkV2Class<SwdPort>`

This is a template class. The SWD backend type is specified by the template parameter `SwdPort`. `SwdPort` must provide the SWD capabilities used by this class (enter/close SWD, DP/AP read/write transactions, bit-sequence read/write, clock configuration, transfer policy, etc.).

Constructor:

```cpp
template <typename SwdPort, /* packet/queue template parameters... */>
explicit DapLinkV2Class(
    Endpoint::EPNumber data_in_ep_num,
    Endpoint::EPNumber data_out_ep_num,
    SwdPort& swd_link,
    LibXR::GPIO* nreset_gpio = nullptr,
    const char* interface_string = DEFAULT_INTERFACE_STRING);
```

Parameters:

- `swd_link`: SWD link object (`SwdPort` instance).
- `nreset_gpio`: optional nRESET GPIO. If null, reset-related commands are handled best-effort.
- `data_in_ep_num` / `data_out_ep_num`: explicit Bulk IN/OUT endpoint numbers.

Common APIs:

- `SetInfoStrings(info)`: override `DAP_Info` string fields.
- `GetState()`: read the internal DAP state.
- `IsInited()`: whether bind/initialization has completed.

### 1.2 InfoStrings

`DAP_Info` string set:

```cpp
struct InfoStrings {
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

Return rules:

- Returned strings include a trailing NUL.
- If truncated, the result is guaranteed to end with a NUL.

---

## 2. USB Interface and Endpoints

### 2.1 Interface Descriptor

`DapLinkV2Class` contributes **one interface** and does not use an IAD:

- `GetInterfaceCount() = 1`
- `HasIAD() = false`

The interface class is fixed to `0xFF` (Vendor Specific) and exposes two Bulk endpoints.

### 2.2 Bulk Endpoints

- **Bulk OUT**: Host → Device (DAP request packets)
- **Bulk IN**: Device → Host (DAP response packets)

Endpoint allocation/configuration happens in `BindEndpoints()`:

- Allocate OUT/IN endpoints from `EndpointPool` (explicit or auto endpoint numbers).
- Endpoint type is BULK; the transfer size uses `UINT16_MAX` as an upper bound and the core chooses a legal value.
- `wMaxPacketSize` in the configuration descriptor comes from the endpoint object’s `MaxPacketSize()`.

---

## 3. WinUSB (MS OS 2.0) Support

This class declares the MS OS 2.0 platform capability in BOS and provides an MS OS 2.0 descriptor set:

- BOS Capability: MS OS 2.0 Platform Capability (count = 1)
- Vendor code: `0x20`
- Compatible ID: `"WINUSB"`
- DeviceInterfaceGUIDs (REG_MULTI_SZ, UTF-16LE): `{CDB3B5AD-293B-4663-AA36-1AAE46463776}` (single GUID + double-NUL terminator)

The interface number is only known at bind time, so the function subset field `bFirstInterface` is updated during `BindEndpoints()` to ensure consistent enumeration on Windows.

---

## 4. Transport Model (Bulk Request/Response)

This class implements a synchronous **CMSIS-DAP v2 over Bulk** request/response model:

1. Host sends one request frame to **Bulk OUT**.
2. The device parses the request and builds the response in the OUT completion callback (into the IN endpoint buffer).
3. The device sends the response on **Bulk IN**.
4. After IN completes, the device re-arms OUT to receive the next request frame.

---

## 5. Lifecycle: Bind / Unbind

### 5.1 `BindEndpoints(endpoint_pool, start_itf_num)`

Key points:

- Record `interface_num_ = start_itf_num` and patch WinUSB function subset interface fields.
- Allocate and configure Bulk OUT/IN endpoints and register callbacks.
- Generate and submit the configuration descriptor block (Interface + 2x Endpoint).
- Runtime defaults:
  - `debug_port = DISABLED`
  - `transfer_abort = false`
  - `swj_clock_hz = 1MHz` and synchronize to `swd_link`
  - SWJ shadow defaults: SWDIO=1, nRESET=1, SWCLK=0
- Set `inited_ = true` and arm OUT reception.

### 5.2 `UnbindEndpoints(endpoint_pool)`

Key points:

- Clear runtime flags and close the SWD backend.
- Close and release IN/OUT endpoints back to the pool.
- Reset shadow defaults (SWDIO=1, nRESET=1, SWCLK=0).

---

## 6. Runtime State and Defaults

### 6.1 DAP State

The internal state structure `LibXR::USB::DapLinkV2Def::State` includes:

- `debug_port`: default DISABLED; becomes SWD or JTAG after a successful CONNECT according to the selected port
- `transfer_abort`: TransferAbort flag
- `transfer_cfg`: parsed TransferConfigure settings (`idle_cycles / retry_count / match_retry`)

### 6.2 SWJ Clock

- Default: `1,000,000 Hz`
- `DAP_SWJ_Clock` updates the internal variable and calls `swd_link.SetClockHz(hz)`.

### 6.3 SWJ Shadow Semantics

The class maintains an internal SWJ pin shadow:

- Default: SWDIO=1, nRESET=1, SWCLK=0
- `DAP_SWJ_Pins` updates shadow bits for selected pins
- nRESET:
  - If `nreset_gpio` is present, it drives the GPIO and reads return the physical level
  - If absent, it is exposed purely via shadow state

---

## 7. Command Set (Implementation Overview)

Command dispatch is implemented in `ProcessOneCommand()`. The first byte `CMD` selects the handler; unknown commands return a single byte `0xFF`.

### 7.1 Implemented Commands

| Command                 |                   ID | Summary                                                                                         |
| ----------------------- | -------------------: | ----------------------------------------------------------------------------------------------- |
| `DAP_Info`              |               `INFO` | Returns string/numeric info (CAPABILITIES / PACKET_COUNT / PACKET_SIZE / TIMESTAMP_CLOCK, etc.) |
| `DAP_HostStatus`        |        `HOST_STATUS` | Returns OK                                                                                      |
| `DAP_Connect`           |            `CONNECT` | Supports SWD; JTAG is also available when the JTAG-enabled profile has a bound backend                                                           |
| `DAP_Disconnect`        |         `DISCONNECT` | Closes the active debug link and returns to DISABLED                                                              |
| `DAP_TransferConfigure` | `TRANSFER_CONFIGURE` | Sets idle_cycles / retry / match_retry and maps to SWD policy                                   |
| `DAP_Transfer`          |           `TRANSFER` | DP/AP read/write; supports match / timestamp; AP posted-read pipeline                           |
| `DAP_TransferBlock`     |     `TRANSFER_BLOCK` | DP/AP block read/write; AP read uses posted pipeline; no match/timestamp                        |
| `DAP_TransferAbort`     |     `TRANSFER_ABORT` | Sets abort flag; next Transfer/Block returns error then clears flag                             |
| `DAP_WriteABORT`        |        `WRITE_ABORT` | Writes ABORT; returns OK/ERROR based on ack/EC                                                  |
| `DAP_Delay`             |              `DELAY` | Microsecond delay                                                                               |
| `DAP_ResetTarget`       |       `RESET_TARGET` | If nRESET exists, pulse and set Execute=1; otherwise Execute=0; always returns DAP_OK           |
| `DAP_SWJ_Pins`          |           `SWJ_PINS` | Updates shadow; best-effort nRESET control; supports PinWait                                    |
| `DAP_SWJ_Clock`         |          `SWJ_CLOCK` | Updates SWJ clock                                                                               |
| `DAP_SWJ_Sequence`      |       `SWJ_SEQUENCE` | Writes SWJ bit sequence (LSB-first) and updates shadow (SWDIO=last bit, SWCLK=0)                |
| `DAP_SWD_Configure`     |      `SWD_CONFIGURE` | Best-effort parse; returns OK                                                                   |
| `DAP_SWD_Sequence`      |       `SWD_SEQUENCE` | Multi-segment in/out sequences; input data appended to response (LSB-first)                     |
| `DAP_QueueCommands`     |     `QUEUE_COMMANDS` | Queues a validated packed command stream for later execution                                                                      |
| `DAP_ExecuteCommands`   |   `EXECUTE_COMMANDS` | Executes the stream previously saved by QueueCommands and returns the combined response                                                                      |

Note: The numeric values depend on `DapLinkV2Def::CommandId`; this document uses enum names.

### 7.2 Key `DAP_Info` Fields

- `CAPABILITIES`: always includes SWD; adds JTAG when compiled and a backend has been supplied through `SetJtag()`
- `PACKET_COUNT`: `4` by default. The class advertises `8` as its template default packet-count input, but the current implementation clamps the effective host-visible count to `4`.
- `PACKET_SIZE`: is computed from DAP template configuration. With default template parameters the host-visible size is `1024`; endpoint `MaxTransferSize()` only determines whether Bulk segmentation/reassembly is needed
- `TIMESTAMP_CLOCK`: `1,000,000` (matches a microsecond time base)

---

## 8. Usage Example

### 8.1 Device-side Initialization (Illustration)

```cpp
#include "daplink_v2.hpp"
#include "usb/device.hpp"
#include "debug/swd.hpp"

MySwdBackend swd(/* ... init ... */);   // concrete SWD backend implementation
MyGpio nreset(/* ... optional ... */);  // concrete GPIO implementation

using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::DapLinkV2Class<MySwdBackend> dap(EP::EP1, EP::EP2, swd, &nreset);

// Optional: override DAP_Info strings
LibXR::USB::DapLinkV2Class<MySwdBackend>::InfoStrings info;
info.vendor = "XRobot";
info.product = "DAPLinkV2";
info.serial = "00000001";
info.firmware_ver = "2.0.0";
dap.SetInfoStrings(info);

// USB device class list: {{&dap}}
// usb_dev.Init();
// usb_dev.Start();
```

### 8.2 Windows / WinUSB Access

By advertising WinUSB and DeviceInterfaceGUIDs through BOS / MS OS 2.0 descriptors, Windows can usually enumerate the device as a WinUSB device without a custom INF, and user-mode applications can enumerate/open it via the GUID.
