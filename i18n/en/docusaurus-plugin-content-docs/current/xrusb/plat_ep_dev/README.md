---
id: xrusb-plat-dev
title: Platform-Specific Implementations
sidebar_position: 1
---

# Platform-Specific Implementations

This section describes how XRUSB implements USB device and endpoint backends on different platforms, and what the common device-construction shape looks like.

It is recommended to derive the device serial number from the platform-provided Unique ID (UID).

## Contents

- [STM32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-stm32)
- [CH32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-ch32)
- [ESP32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-esp)

Example:

```cpp
/* USB Classes: CDC uses EP1 (data IN/OUT) and EP2 (notification IN); keyboard uses EP3 IN */
LibXR::USB::CDCUart cdc_uart(LibXR::USB::Endpoint::EPNumber::EP1,
                             LibXR::USB::Endpoint::EPNumber::EP1,
                             LibXR::USB::Endpoint::EPNumber::EP2);
LibXR::USB::HIDKeyboard hid_keyboard(LibXR::USB::Endpoint::EPNumber::EP3,
                                     LibXR::USB::Endpoint::EPNumber::EP_INVALID);

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
    {&LANG_PACK},
    /* Classes */
    {{&cdc_uart, &hid_keyboard}},
    /* Serial Number UID (address and length of the raw UID bytes, optional) */
    {addr, size});
usb.Init(false);
usb.Start(false);
```

The `VID / PID / bcdDevice` values in the example are only showing the constructor shape. For real project values, check [VID/PID and serial usage conventions](/docs/xrusb/xrusb-id) first. If one device class must match a specific host ecosystem, the class-specific page takes priority.

The parts that vary by platform:

- the USB device object itself, for example `STM32USBDevice...` or `CH32USBDevice...`
- endpoint-buffer declaration style
- low-level resource organization such as FIFO / PMA / DMA

Classes such as `CDCUart` and `HIDKeyboard` are used the same way on every platform: they are passed in the class list of the device constructor, followed by the optional UID argument.

Additional notes:

- `ESP32-S3` uses `ESP32USBDevice`.
- On `ESP32-C3 / ESP32-C6`, the USB Serial/JTAG controller is used by the UART driver `ESP32CDCJtag`; see [ESP32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-esp).
