---
id: xrusb-plat-dev-esp
title: ESP32 USB Implementation
sidebar_position: 3
---

# ESP32 USB Implementation

The ESP platform currently has two USB-related implementation paths:

| Path | Target chips | Class | Notes |
| ---- | ------------ | ----- | ----- |
| Native USB Device | `ESP32-S3` | `LibXR::ESP32USBDevice` | XRUSB platform device implementation |
| USB Serial/JTAG | `ESP32-C3 / ESP32-C6` | `LibXR::ESP32CDCJtag` | UART backend, not part of the generic XRUSB DeviceCore path |

---

## Native `ESP32USBDevice` on ESP32-S3

`ESP32USBDevice` is the XRUSB device-side implementation for `ESP32-S3`. The code lives in:

- `driver/esp/esp_usb.hpp`
- `driver/esp/esp_usb_dev.hpp`
- `driver/esp/esp_usb_ep.hpp`

This path is responsible for:

- device and configuration descriptors
- endpoint objects and endpoint pool management
- FIFO allocation
- DWC2 device-core initialization
- interrupt dispatch and endpoint transfers

Current implementation characteristics:

- compiled only under `SOC_USB_OTG_SUPPORTED && CONFIG_IDF_TARGET_ESP32S3`
- currently constructed as a `USB 2.1 / Full-Speed Device`
- `EP0` must exist
- endpoint numbers increase according to the order of endpoint configuration entries

### Endpoint declaration style

`ESP32USBDevice::EPConfig` supports two forms:

1. `{buffer}`: declare one bidirectional endpoint
2. `{buffer, true/false}`: declare one single-direction endpoint
   - `true`: IN
   - `false`: OUT

The first config entry must be the `EP0` buffer. Later entries map to `EP1`, `EP2`, `EP3`, and so on in order.

```cpp
LibXR::ESP32USBDevice usb_dev(
    {
        {ep0_buffer},
        {ep1_buffer},
        {ep2_in_buffer, true},
        {ep3_out_buffer, false},
    },
    LibXR::USB::DeviceDescriptor::PacketSize0::SIZE_64,
    0x1D50, 0x6199, 0x0100,
    {&LANG_PACK_EN_US},
    {{&cdc_uart}},
    {uid_addr, uid_size});
```

Startup follows the same pattern as on other platforms:

```cpp
usb_dev.Init(false);
usb_dev.Start(false);
```

Notes:

- `VID / PID / bcdDevice / Serial` selection still follows [VID/PID and serial usage conventions](/docs/xrusb/xrusb-id)
- the last constructor argument is still an optional UID byte array used to build the device serial number

---

## `ESP32CDCJtag` on ESP32-C3 / ESP32-C6

The USB Serial/JTAG controller of the ESP32-C3 and ESP32-C6 is used by the UART driver `ESP32CDCJtag`; its constructor parameters and constraints are described in the "ESP32 path" section of [UART Driver Design](../../adv_coding/driver/uart_driver.md).
