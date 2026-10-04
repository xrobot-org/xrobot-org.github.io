---
id: xrusb-dev-stack-gsusb
title: GSUSB
sidebar_position: 4
---

# GSUSB Device Stack

This document describes XRUSB’s GSUSB (Linux `gs_usb`) device class implementation: `LibXR::USB::GsUsbClass<CanChNum>`.

This device class targets USB-to-CAN usage in the Linux/SocketCAN ecosystem. It uses a Vendor Interface + Bulk IN/OUT transport model and implements the commonly used control plane and data plane of the `gs_usb` protocol.

Supported capabilities:

- Classic CAN: up to 8 bytes of data
- CAN FD (optional): up to 64 bytes of data; DLC mapping follows the FD table
- TX echo: echoes back `echo_id` for host-side TX buffer tracking
- Optional timestamp field: `timestamp_us` (4 bytes) appended to the end of the wire frame, sourced from the low 32 bits of `LibXR::Timebase::GetMicroseconds()`
- Multi-channel: the number of channels is fixed at compile time by the template parameter `CanChNum`

---

## 1. Class and construction

In `GsUsbClass<CanChNum>`, `CanChNum` is the compile-time CAN channel count (`1..255`). Channel indices are exposed as `uint8_t`. The constructor takes a list of channel object pointers whose count equals `CanChNum`.

This class supports both Classic CAN and FDCAN (with FD capability enabled) via different constructors.

### 1.1 Classic CAN constructor

```cpp
GsUsbClass(Endpoint::EPNumber data_in_ep_num,
           Endpoint::EPNumber data_out_ep_num,
           std::initializer_list<LibXR::CAN*> cans,
           size_t rx_queue_size = 32,
           size_t echo_queue_size = 32,
           LibXR::GPIO* identify_gpio = nullptr,
           std::initializer_list<LibXR::GPIO*> termination_gpios = {},
           LibXR::Database* database = nullptr,
           const char* interface_string = DEFAULT_INTERFACE_STRING);  // "XRUSB GS USB"
```

Notes:

- `cans`: list of Classic CAN pointers; the count must equal `CanChNum`
- Endpoint numbers are required; older kernel `gs_usb` drivers use fixed EP1 IN / EP2 OUT, so these numbers keep compatibility with them
- The Linux `gs_usb` driver binds automatically by the VID:PID entries of its kernel device table, and every entry is limited to interface number 0, so this class is placed as the first interface in the configuration
- The project's registered `1D50:6199` (see [VID/PID and serial usage conventions](/docs/xrusb/xrusb-id)) is not in the device table of mainline `gs_usb`, so the host does not bind it automatically. After the driver is loaded, writing the VID, the PID and the interface class `ff` (the class of this interface) to `new_id` makes the driver bind the vendor-specific interface of the device; the setting is lost when the driver is reloaded or the host reboots:

```bash
sudo modprobe gs_usb
echo "1d50 6199 ff" | sudo tee /sys/bus/usb/drivers/gs_usb/new_id
```

### 1.2 FDCAN constructor (FD enabled)

```cpp
GsUsbClass(Endpoint::EPNumber data_in_ep_num,
           Endpoint::EPNumber data_out_ep_num,
           std::initializer_list<LibXR::FDCAN*> fd_cans,
           size_t rx_queue_size = 32,
           size_t echo_queue_size = 32,
           LibXR::GPIO* identify_gpio = nullptr,
           std::initializer_list<LibXR::GPIO*> termination_gpios = {},
           LibXR::Database* database = nullptr,
           const char* interface_string = DEFAULT_INTERFACE_STRING);  // "XRUSB GS USB"
```

Notes:

- `fd_cans`: list of FDCAN pointers; the count must equal `CanChNum`
- Whether FD is truly usable depends on both device-side FD support and whether the host enables FD mode for the channel via the control plane

---

## 2. USB interface and endpoints

### 2.1 Interface descriptor

`GsUsbClass` exposes one interface and does not use an IAD. The interface class/subclass/protocol are fixed to `0xFF/0xFF/0xFF` (Vendor Specific), with 2 endpoints.

### 2.2 Bulk endpoints

- Bulk OUT: Host → Device (host sends CAN/FD frames; carries `echo_id` for TX echo)
- Bulk IN: Device → Host (device reports RX frames/error frames, plus TX echo replies)

The maximum transfer length is determined by the underlying `Endpoint` implementation; configuration uses `UINT16_MAX` as an upper bound.

---

## 3. gs_usb wire format (data plane)

All Bulk data frames start with a fixed 12-byte header (little-endian):

```text
struct WireHeader {
  uint32_t echo_id;   // Echo ID
  uint32_t can_id;    // CAN ID (with flags)
  uint8_t  can_dlc;   // DLC
  uint8_t  channel;   // Channel index
  uint8_t  flags;     // GS_CAN_FLAG_*
  uint8_t  reserved;
}
```

Conventions:

- For RX frames reported by the device, `ECHO_ID_RX = 0xFFFFFFFF` is used
- If the host sends a frame with `echo_id != 0xFFFFFFFF`, the device generates a corresponding TX echo event and sends it back

Payload and length:

- Classic CAN: payload is fixed at 8 bytes
- CAN FD: payload is fixed at 64 bytes
- Optional timestamp: if enabled for the channel, append 4 bytes `timestamp_us` (microseconds, low 32 bits) after the payload

Total length:

- Classic: `12 + 8` (or `12 + 8 + 4`)
- FD: `12 + 64` (or `12 + 64 + 4`)

### 3.1 DLC and FD mapping

- Classic: `can_dlc` is capped at 8 (values above 8 are clamped to 8)
- FD: `can_dlc` is mapped to length `0..64` using the FD DLC mapping table

| DLC | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  | 11  | 12  | 13  | 14  | 15  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LEN | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 12  | 16  | 20  | 24  | 32  | 48  | 64  |

---

## 4. Lifecycle: BindEndpoints / UnbindEndpoints

### 4.1 BindEndpoints

Initialization typically includes:

- Allocate/configure Bulk IN/OUT endpoints; generate and submit configuration descriptors (Interface + 2x Endpoint)
- Register endpoint callbacks:
  - OUT complete: parse host wire frames
  - IN complete: attempt to continue sending the next frame
- Reset runtime state and keep the OUT endpoint armed so the host can send continuously
- Register CAN RX callbacks (enqueue received frames/error frames and trigger transmission)

### 4.2 UnbindEndpoints

Teardown typically includes:

- Close endpoints and return them to `EndpointPool`
- Clear key state (including host_format negotiation state and per-channel enable flags)

---

## 5. Host → Device (Bulk OUT)

After receiving one OUT frame, the device:

1. Parses `WireHeader` and validates `channel` and the corresponding channel object
2. Determines Classic/FD by `flags` and checks whether the channel is enabled (e.g., FD requires both device and host to enable it)
3. Converts the wire frame into a CAN/FDCAN pack and submits it to the corresponding channel’s TX queue
4. If `echo_id != 0xFFFFFFFF`, enqueues an echo event to be sent back via Bulk IN
5. Re-arms OUT reception (when queue capacity allows)

---

## 6. Device → Host (Bulk IN)

Device-to-host traffic comes from two sources:

1. TX echo (higher priority): used by the host to track transmit completion
2. RX reports: Classic/FD frames received by the channels, plus optional error frames

Transmission policy:

- A send is started only when the IN endpoint is idle
- Dequeue order: echo first, then RX reports
- The IN complete callback triggers the next send attempt for continuous output

---

## 7. Control plane: Vendor Requests (gs_usb BREQ)

`GsUsbClass` does not implement standard Class Requests; all control-plane operations are done via Vendor Requests (gs_usb BREQ).

### 7.1 Reads (Device → Host)

Common read requests (per-channel or global) include:

- Bit timing constants / extended constants (FD capability)
- Device configuration (channel count, version, etc.)
- Timestamp (microseconds, low 32 bits)
- Termination state, per-channel error state
- USER_ID (from RAM or Database)

### 7.2 Writes (Host → Device)

Common write requests (per-channel) include:

- `HOST_FORMAT`: host format negotiation
- `BITTIMING`: arbitration phase bit timing
- `DATA_BITTIMING`: data phase bit timing (FD)
- `MODE`: START/RESET and mode flags (loopback/listen-only/one-shot, etc.)
- Error-frame reporting enable, Identify GPIO, termination control, USER_ID write

### 7.3 HOST_FORMAT requirement

The host must first complete format negotiation via `HOST_FORMAT`. If negotiation has not succeeded, some configuration requests (such as BITTIMING, MODE, etc.) are rejected to force the host to negotiate first.

---

## 8. Error frames and timestamps

### 8.1 Error frames (SocketCAN semantics)

Classic CAN error packs can be converted to SocketCAN-compatible error frames (e.g., `CAN_ERR_FLAG`). Whether they are reported is controlled by the per-channel error-frame enable flag.

### 8.2 Timestamps

When timestamps are enabled for a channel, the device appends `timestamp_us` to the end of the wire frame (4 bytes, microseconds, low 32 bits). The current implementation takes this value directly from the low 32 bits of `LibXR::Timebase::GetMicroseconds()`. If timestamps are not enabled for the channel, the field is omitted.

---

## 9. Examples

### 9.1 Classic CAN (2 channels)

```cpp
using Dev = LibXR::USB::GsUsbClass<2>;

Dev gsusb(/*in_ep*/LibXR::USB::Endpoint::EPNumber::EP1,
          /*out_ep*/LibXR::USB::Endpoint::EPNumber::EP2,
          {&can1, &can2},
          /*rx_queue*/64,
          /*echo_queue*/64,
          /*identify*/&led_gpio,
          /*termination*/{&term1_gpio, &term2_gpio},
          /*db*/&db);

// USB device class list: {{&gsusb}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

### 9.2 FDCAN (1 channel)

```cpp
using Dev = LibXR::USB::GsUsbClass<1>;

Dev gsusb(/*in_ep*/LibXR::USB::Endpoint::EPNumber::EP1,
          /*out_ep*/LibXR::USB::Endpoint::EPNumber::EP2,
          {&fdcan1});
```

On Linux, the device is typically enumerated by the `gs_usb` driver as a SocketCAN interface (e.g., `can0`). `ip link set can0 up type can bitrate ...` and tools such as `cansend` / `candump` then transmit and receive.
