---
id: xrusb-dev-stack-hid
title: HID
sidebar_position: 2
---

# HID Device Stack

This section describes XRUSB’s USB HID (Human Interface Device) device-class implementation and how to extend it. It covers:

- The template HID base class `LibXR::USB::HID<REPORT_DESC_LEN, TX_REPORT_LEN, RX_REPORT_LEN>`
- Automatic generation of the configuration-descriptor block (Interface + HID Descriptor + Endpoint Descriptors)
- Optional Interrupt OUT (Output Report over Interrupt OUT)
- Standard request `GET_DESCRIPTOR` (HID / Report Descriptor)
- A handling framework for HID class requests (`GET_REPORT/SET_REPORT/GET_IDLE/SET_IDLE/GET_PROTOCOL/SET_PROTOCOL`)
- Input Report transmission and IN/OUT completion callbacks
- Typical derived classes: mouse, keyboard, gamepad

---

## 1. Base Class Overview

### 1.1 `LibXR::USB::HID<REPORT_DESC_LEN, TX_REPORT_LEN, RX_REPORT_LEN>`

`HID` is a template HID base class (derived from `DeviceClass`). Template parameters fix report and descriptor sizes at compile time, making it convenient to implement devices such as keyboards, mice, and gamepads.

Template parameters:

- `REPORT_DESC_LEN`: Report Descriptor length (bytes)
- `TX_REPORT_LEN`: Maximum Input Report length (Interrupt IN endpoint max packet size)
- `RX_REPORT_LEN`: Maximum Output Report length (Interrupt OUT endpoint max packet size)
  - Using the Interrupt OUT endpoint requires a suitable `RX_REPORT_LEN` and `enable_out_endpoint = true` in the constructor

Constructor:

```cpp
HID(Endpoint::EPNumber in_ep_num, Endpoint::EPNumber out_ep_num,
    bool enable_out_endpoint = false, uint8_t in_ep_interval = 10,
    uint8_t out_ep_interval = 10,
    const char* interface_string = DEFAULT_INTERFACE_STRING);  // "XRUSB HID"
```

- `out_ep_num`: pass `Endpoint::EPNumber::EP_INVALID` when the OUT endpoint is not enabled
- `in_ep_interval` / `out_ep_interval`: written to the endpoint descriptors as `bInterval`; the base class defaults to 10, while `HIDMouse`, `HIDKeyboard` and `HIDGamepadT` default to 1
- Derived classes: `HIDMouse(in_ep_num, in_ep_interval = 1, interface_string)`, `HIDKeyboard(in_ep_num, out_ep_num, enable_out_endpoint = false, in_ep_interval = 1, out_ep_interval = 1, interface_string)`, `HIDGamepadT(in_ep_num, interface_string)`

The base class provides:

- Endpoint allocation and configuration: Interrupt IN (required) + Interrupt OUT (optional)
- Automatic configuration-descriptor block generation
- `GET_DESCRIPTOR` (HID / Report) responses
- A HID class-request handling framework (override/extend in derived classes)
- Input Report send helper: `SendInputReport(...)`
- IN/OUT transfer-completion hooks: `OnDataInComplete(...)` / `OnDataOutComplete(...)`

---

## 2. Descriptor and Endpoint Layout

### 2.1 Interface

The HID base class contributes one HID interface and does not use an IAD:

- `bInterfaceClass = 0x03` (HID)
- `bNumEndpoints = 1` (IN only) or `2` (IN + OUT)

### 2.2 HID Descriptor (0x21)

The configuration descriptor includes a HID class descriptor (9 bytes). Key fields:

- `bcdHID = 0x0111` (HID v1.11)
- `bNumDescriptors = 1`
- `bReportDescriptorType = 0x22`
- `wReportDescriptorLength = REPORT_DESC_LEN`

### 2.3 Endpoints

| Endpoint            | Dir | Type      | Max Packet Size   | Purpose                          |
| ------------------- | --- | --------- | ----------------: | -------------------------------- |
| IN endpoint         | IN  | INTERRUPT | `TX_REPORT_LEN`   | Device → Host Input Report       |
| OUT endpoint (opt.) | OUT | INTERRUPT | `RX_REPORT_LEN`   | Host → Device Output Report      |

Polling interval:

- `in_ep_interval_` / `out_ep_interval_` are written into endpoint descriptors as `bInterval`

Note: `bInterval` semantics differ by speed (FS is typically 1 ms frames; HS uses microframe encoding). This implementation organizes parameters in “millisecond” terms; the final interpretation depends on the underlying USB controller/stack.

---

## 3. Lifecycle: Bind / Unbind

### 3.1 Bind (Initialization)

During initialization, the class typically:

1. Records the interface number and clears runtime flags
2. Allocates Interrupt IN from `EndpointPool` and configures it with `TX_REPORT_LEN`
3. If `enable_out_endpoint` is enabled in the constructor: allocates Interrupt OUT and configures it with `RX_REPORT_LEN`
4. Generates and submits the configuration-descriptor block (Interface + HID Descriptor + Endpoint Descriptors)
5. Registers endpoint completion callbacks (IN required; OUT optional)
6. If OUT is enabled: starts the first OUT receive (subsequent receives are re-armed automatically)
7. Sets `inited_ = true`

### 3.2 Unbind (Release)

During unbind, the class typically:

- Clears `inited_`, closes and returns IN/OUT endpoints to `EndpointPool`
- Sets endpoint pointers to null

---

## 4. Standard Request: `GET_DESCRIPTOR` (HID / Report)

The base class handles the standard request `GET_DESCRIPTOR`:

- `DescriptorType = 0x21`: returns the HID Descriptor
- `DescriptorType = 0x22`: returns the Report Descriptor
- Other types (e.g., Physical 0x23): not supported

Returned data is truncated to `wLength` to avoid exceeding the host-requested length.

Derived classes must provide the Report Descriptor (called by the base class):

```cpp
virtual ConstRawData GetReportDesc() = 0;
```

---

## 5. HID Class Requests and Data Stage

The base class supports common HID Class-Specific Requests:

- `GET_REPORT`
  - Uses the high byte of `wValue` to distinguish `INPUT/OUTPUT/FEATURE`, then calls derived hooks to produce response data
- `SET_REPORT`
  - Performs basic validation in the Setup stage and prepares to receive data
  - When the Data stage arrives, invokes a derived hook to process the payload
- `GET_IDLE / SET_IDLE`
  - Maintains `idle_rate_` (units of 4 ms; many implementations only support `report_id = 0`)
- `GET_PROTOCOL / SET_PROTOCOL`
  - Maintains `protocol_` (BOOT / REPORT)

Recommended hooks to override as needed:

- Report retrieval: `OnGetInputReport(...)` / `OnGetLastOutputReport(...)` / `OnGetFeatureReport(...)`
  - The base implementation of `OnGetLastOutputReport(...)` returns empty data; returning the last Output Report over a control transfer requires overriding it in the derived class
- Report setting: `OnSetReport(...)` (Setup stage) and `OnSetReportData(...)` (Data stage)
- Custom extensions: `OnCustomClassRequest(...)` / `OnCustomClassData(...)`
  - Requests not handled directly by the base class return `NOT_SUPPORT` by default

---

## 6. Data Path: Interrupt IN/OUT

### 6.1 Sending an Input Report: `SendInputReport(...)`

Typical behavior:

1. Validates initialization and endpoint availability
2. Validates `0 < report_len <= TX_REPORT_LEN`
3. Validates the IN endpoint is idle; otherwise returns `BUSY`
4. Copies the report into the IN endpoint buffer and starts the transfer

Common return-code semantics (subject to stack definitions):

- `OK`: transfer started successfully
- `BUSY`: endpoint is still transferring
- `ARG_ERR`: invalid report length
- `FAILED/NO_BUFF`: endpoint/buffer unavailable

### 6.2 Receiving an Output Report (Interrupt OUT, optional)

If the OUT endpoint is enabled, the base class continuously receives:

- Starts one OUT receive after Bind
- After each OUT completion:
  - Calls `OnDataOutComplete(in_isr, data)` so the derived class can consume the data
  - Automatically re-arms to receive the next packet

This path is suitable for “asynchronous Output Reports” such as keyboard LED states or gamepad vibration commands.

### 6.3 IN Completion Callback

After an IN transfer completes, `OnDataInComplete(in_isr, data)` is called. Typical uses:

- Advancing a send queue (send the next report)
- Statistics/monitoring (throughput, link state, etc.)

---

## 7. Typical Derived Classes (Overview)

### 7.1 `HIDMouse`

- Report format matches the HID Boot mouse
- Input Report: commonly 4 bytes (Buttons + X + Y + Wheel)
- IN endpoint only

### 7.2 `HIDKeyboard`

- Report format matches the HID Boot keyboard
- Input Report: commonly 8 bytes (Modifier + Reserved + 6 KeyCodes)
- Optional OUT endpoint (e.g., 1-byte LED)
- Can also support host LED updates via control endpoint (`SET_REPORT`)

Current derived-class helpers also include:

- `SetOnLedChangeCallback(...)`
- `GetNumLock()`
- `GetCapsLock()`
- `GetScrollLock()`

### 7.3 `HIDGamepadT`

- Template gamepad (e.g., 4 axes + 8 buttons)
- Input Report and Report Descriptor are fixed at compile time
- Typically provides convenience send APIs to update axes and button bitmap

Two ready-to-use aliases are also provided:

- `HIDGamepad = HIDGamepadT<0, 2047, 1>`
- `HIDGamepadBipolar = HIDGamepadT<-2048, 2047, 1>`

`HIDGamepad` is suitable for unipolar ranges, while `HIDGamepadBipolar` is suitable for bipolar inputs centered around zero.

---

## 8. Usage Examples (Conceptual)

Note: How the USB device framework registers the class list depends on the upper-layer `usb_dev` implementation. The examples below illustrate typical usage only.

### 8.1 Mouse

```cpp
#include "hid_mouse.hpp"

LibXR::USB::HIDMouse hid_mouse(LibXR::USB::Endpoint::EPNumber::EP1);

// usb_dev class list: {{&hid_mouse}}
// usb_dev.Init(false);
// usb_dev.Start(false);

hid_mouse.Move(LibXR::USB::HIDMouse::LEFT, 10, 0);
hid_mouse.Release();
```

### 8.2 Keyboard (with LED callback)

```cpp
#include "hid_keyboard.hpp"

// IN and OUT both on EP1; true enables the optional Interrupt OUT endpoint for LED reports
LibXR::USB::HIDKeyboard hid_kbd(LibXR::USB::Endpoint::EPNumber::EP1,
                                LibXR::USB::Endpoint::EPNumber::EP1, true);

// Send: Shift + A
hid_kbd.PressKey({LibXR::USB::HIDKeyboard::KeyCode::A},
                 LibXR::USB::HIDKeyboard::Modifier::LEFT_SHIFT);
hid_kbd.ReleaseAll();

// Optional: register a LED-state change callback
hid_kbd.SetOnLedChangeCallback(
    LibXR::Callback<bool, bool, bool>::Create(
        [](bool in_isr, int, bool num_lock, bool caps_lock, bool scroll_lock) {
          (void)in_isr;
          (void)num_lock;
          (void)caps_lock;
          (void)scroll_lock;
        },
        0));
```

### 8.3 Gamepad

```cpp
#include "hid_gamepad.hpp"

LibXR::USB::HIDGamepad gamepad(LibXR::USB::Endpoint::EPNumber::EP1);
gamepad.Send(1024, 1024, 1024, 1024, LibXR::USB::HIDGamepad::BTN1);

LibXR::USB::HIDGamepadBipolar bipolar_gamepad(LibXR::USB::Endpoint::EPNumber::EP2);
bipolar_gamepad.SendAxes(0, -512, 512, 0);
```

---

## 9. Extension Guidance (Derived-Class Implementation)

Implementing a new HID derived class typically requires:

1. Provide the Report Descriptor (implement `GetReportDesc()`)
2. Define and manage the Input Report data structure (length must not exceed `TX_REPORT_LEN`)
3. If Output/Feature is needed:
   - Control transfer: override `OnSetReport(...) / OnSetReportData(...)`
   - Interrupt OUT endpoint: reserve enough `RX_REPORT_LEN`, enable `enable_out_endpoint` in the constructor, and override `OnDataOutComplete(...)`

If continuous sending or queueing is needed, implement “send next report” scheduling in `OnDataInComplete(...)`.
