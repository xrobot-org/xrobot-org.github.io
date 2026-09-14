---
id: xrusb-plat-dev
title: Platform-Specific Implementations
sidebar_position: 1
---

# Platform-Specific Implementations

This section describes how XRUSB implements USB device and endpoint backends on different platforms, and what the common device-construction shape looks like.

**It is recommended to derive the device serial number from the platform-provided Unique ID (UID).**

## Contents

- [STM32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-stm32)
- [CH32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-ch32)
- [ESP32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-esp)

Example:

```cpp
/* USB Classes */
using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::CDCUart cdc_uart(EP::EP1, EP::EP1, EP::EP2);
LibXR::USB::HIDKeyboard hid_keyboard(EP::EP3, EP::EP_INVALID, false);

static constexpr auto LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        /* Language Code */
        LibXR::USB::DescriptorStrings::Language::EN_US, 
        /* Manufacturer */
        "XRobot",
        /* Product */
        "XRUSB USB CDC Demo", 
        /* Serial Number string prefix (human-readable) */
        "XRUSB-DEMO-");


XXXUSBDevice usb(
    /* USB Hardware and Endpoints config */
    ..., 
    /* EP0 Packet Size */
    USB::DeviceDescriptor::PacketSize0::SIZE_8,
    /* Vendor ID */
    0x1D50,
    /* Product ID */
    0x6199,
    /* BcdDevice */
    0x0100,
    /* Language Pack */
    LANG_PACK,
    /* Classes */
    {{&cdc_uart, &hid_keyboard}},
    /* Serial Number UID (hex byte array, optional) */
    {addr, size});
```

The `VID / PID / bcdDevice` values in the example are only showing the constructor shape. For real project values, check [VID/PID and serial usage conventions](/docs/xrusb/xrusb-id) first. If one device class must match a specific host ecosystem, the class-specific page takes priority.

What actually changes across platforms is:

- the USB device object itself, for example `STM32USBDevice...` or `CH32USBDevice...`
- endpoint-buffer declaration style
- low-level resource organization such as FIFO / PMA / DMA

Upper-layer classes such as `CDCUart` and `HIDKeyboard` are generally wired in the same way: pass them through the final class list of the device constructor.

Additional notes:

- for `ESP32-S3`, mainline provides a dedicated `ESP32USBDevice` device-side implementation;
- for `ESP32-C3 / ESP32-C6`, current mainline more commonly uses `ESP32CDCJtag` as a USB Serial/JTAG UART backend, which is not part of the generic XRUSB device-controller path.
