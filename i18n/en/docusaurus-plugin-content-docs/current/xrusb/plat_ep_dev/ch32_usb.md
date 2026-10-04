---
id: xrusb-plat-dev-ch32
title: CH32 USB Implementation
sidebar_position: 2
---

# CH32 USB Implementation

CH32 has three USB device controllers, listed below.  
For devices with a hardware Unique ID (UID) such as CH32V2/V3, it is recommended to derive the USB device serial number from the chip UID and pass it to the USB device constructor as a `{pointer, length}` pair.

| Controller | Class | Role | Notes |
| --------------------- | ----- | ---- | ----- |
| `USB_DEVICE_FS` | `LibXR::CH32USBDeviceFS` | Device | FSDEV device path |
| `USBFS/OTG FS` | `LibXR::CH32USBOtgFS` | Device side of OTG FS | OTG FS device path |
| `USBHS/OTG HS` | `LibXR::CH32USBOtgHS` | Device side of OTG HS | OTG HS device path |

> Note: On common CH32V2/V3 parts, the UID is 96 bits (12 bytes) and can be read from 0x1FFFF7E8 as a contiguous 12-byte block.

## `CH32USBDeviceFS` (FSDEV)

`CH32USBDeviceFS` supports two endpoint declaration styles. The first entry is EP0, and the following entries are numbered in order from EP1. A buffer size of 128 bytes is recommended for non-EP0 endpoints:

1. `{ep1_buffer}`: bidirectional endpoint; the buffer is split in half into OUT (first half) and IN (second half); the EP0 entry is not split
2. `{ep2_buffer, true}`: unidirectional endpoint; the whole buffer belongs to that direction (`true` for IN, `false` for OUT)

```cpp
LibXR::CH32USBDeviceFS usb_dev(
    /* EP */
    {
        {ep0_buffer},
        {ep1_buffer},
        {ep2_buffer},
    },
    /* packet size */
    LibXR::USB::DeviceDescriptor::PacketSize0::SIZE_64,
    /* vid pid bcd */
    0x1D50, 0x6199, 0x0100,
    /* language */
    {&LANG_PACK_EN_US},
    /* config */
    {{&cdc1}},
    /* Serial Number UID (address and length of the raw CH32 UID bytes) */
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
```

## `CH32USBOtgFS` (OTG FS)

`CH32USBOtgFS` supports the following endpoint declaration styles; endpoint numbers increase in order from `EP0`.

1. `{ep0_buf_fs}`: declare the EP0 buffer
2. `{ep1_in_buf_fs, true}`: declare a unidirectional IN endpoint
3. `{ep2_out_buf_fs, false}`: declare a unidirectional OUT endpoint
4. `{ep3_shared_buf_fs}`: declare a bidirectional endpoint that shares one buffer entry

```cpp
LibXR::CH32USBOtgFS usb_dev_fs(
    /* EP */
    {
        {ep0_buf_fs},
        {ep1_in_buf_fs, true},
        {ep2_out_buf_fs, false},
        {ep3_shared_buf_fs},
    },
    /* packet size */
    LibXR::USB::DeviceDescriptor::PacketSize0::SIZE_64,
    /* vid pid bcd */
    0x1D50, 0x6199, 0x0100,
    /* language */
    {&LANG_PACK_EN_US},
    /* config */
    {{&cdc_fs}},
    /* Serial Number UID (address and length of the raw CH32 UID bytes) */
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
```

## `CH32USBOtgHS` (OTG HS)

`CH32USBOtgHS` supports three endpoint declaration styles. For non-EP0 endpoints, a buffer size of 1024 bytes is recommended. Endpoint numbers auto-increment:

1. `{ep0_buffer_hs}`: pass the EP0 buffer directly.  
2. `{ep1_buffer_tx_hs, true}`: pass the buffer and enable double buffering  
   - ep1_buffer_tx_hs: buffer for the EP1 endpoint  
   - true: whether this endpoint is configured as IN  
3. `{ep2_buffer_tx_hs, ep2_buffer_rx_hs}`: pass the IN (tx) and OUT (rx) buffers of a bidirectional endpoint without enabling double buffering  

```cpp
LibXR::CH32USBOtgHS usb_dev_hs(
    /* EP */
    {
        {ep0_buf_hs},                    // EP0
        {ep1_in_buf_hs, true},           // EP1 IN (unidirectional, double-buffered)
        {ep2_out_buf_hs, false},         // EP2 OUT (unidirectional, double-buffered)
        {ep3_in_buf_hs, ep3_out_buf_hs}  // EP3 bidirectional (IN first, then OUT; no double buffer)
    },
    /* vid pid bcd */
    0x1D50, 0x6199, 0x0100,
    /* language */
    {&LANG_PACK_EN_US},
    /* config */
    {{&cdc2}},
    /* Serial Number UID (address and length of the raw CH32 UID bytes) */
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
```
