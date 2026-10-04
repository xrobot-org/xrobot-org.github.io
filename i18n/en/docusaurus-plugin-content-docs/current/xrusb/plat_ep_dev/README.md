---
id: xrusb-plat-dev
title: Platform-Specific Implementations
sidebar_position: 1
---

# Platform-Specific Implementations

This section describes how XRUSB implements USB device and endpoint backends on different platforms, and how a device object is constructed.

It is recommended to derive the device serial number from the platform-provided Unique ID (UID).

## Contents

- [STM32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-stm32)
- [CH32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-ch32)
- [ESP32 USB Implementation](/docs/xrusb/plat_ep_dev/xrusb-plat-dev-esp)

## Constructing a device object

The excerpt below is from the `User/app_main.cpp` the code generator produces for an STM32F103 project. The chip uses the FSDEV controller, and the device has one CDC serial port:

```cpp
alignas(4) static uint8_t usb_fs_ep0_in_buf[8];
alignas(4) static uint8_t usb_fs_ep0_out_buf[8];
alignas(4) static uint8_t usb_fs_ep1_in_buf[128];
alignas(4) static uint8_t usb_fs_ep1_out_buf[128];
alignas(4) static uint8_t usb_fs_ep2_in_buf[16];

// ...

  // USB FS: 1 CDC
  static constexpr auto usb_fs_strings = USB::DescriptorStrings::MakeLanguagePack(
      USB::DescriptorStrings::Language::EN_US, "XRobot", "STM32 XRUSB USB CDC Demo",
      "XRUSB-DEMO-");
  static USB::CDCUart usb_fs_cdc(USB::Endpoint::EPNumber::EP1,
                                 USB::Endpoint::EPNumber::EP1,
                                 USB::Endpoint::EPNumber::EP2, 128, 128, 3);
  static STM32USBDeviceDevFs usb_fs(&hpcd_USB_FS,
                                    {{usb_fs_ep0_in_buf, usb_fs_ep0_out_buf, 8, 8},
                                     {usb_fs_ep1_in_buf, usb_fs_ep1_out_buf, 128, 128},
                                     {usb_fs_ep2_in_buf, 16, true}},
                                    USB::DeviceDescriptor::PacketSize0::SIZE_8, 0x1D50,
                                    0x6199, 0x100, {&usb_fs_strings}, {{&usb_fs_cdc}},
                                    {reinterpret_cast<void*>(UID_BASE), 12});
  usb_fs.Init(false);
  usb_fs.Start(false);
```

The device constructor takes, in order: the peripheral handle, the endpoint declaration list, the EP0 packet size, VID, PID, bcdDevice, the language-pack list, the configuration list (each configuration is a group of device classes), and optionally the address and length of the raw UID bytes. The third string of the language pack is the serial-number prefix; the stack converts the UID to a hexadecimal string and appends it. The values of `VID / PID / bcdDevice` and the serial number follow [VID/PID and serial usage conventions](/docs/xrusb/xrusb-id); if a device class must match a specific host ecosystem, the class-specific page takes priority.

The parts that vary by platform:

- the USB device object itself, for example `STM32USBDevice...` or `CH32USBDevice...`
- endpoint-buffer declaration style
- low-level resource organization such as FIFO / PMA / DMA

Classes such as `CDCUart` and `HIDKeyboard` are used the same way on every platform: they are passed in the configuration list of the device constructor.

## Endpoint numbers

A device class is given its endpoint numbers at construction; for `CDCUart`, the first three arguments are the data IN, data OUT and notification IN endpoints. The endpoint declaration list of the device constructor determines which endpoint numbers exist on the device, their directions and their buffers. When the device's `Init()` is called, each device class takes its endpoints from the declared ones by endpoint number and direction; if the list has no matching endpoint, or another device class has already taken it, an `ASSERT` fires. Therefore:

- one direction of one endpoint number can be given to only one device class;
- a device class that uses only an IN endpoint passes `EP_INVALID` as its OUT endpoint number, for example `HIDKeyboard` without its OUT endpoint;
- every endpoint number and direction a device class uses must appear in the declaration list.

How each platform maps the declaration list to endpoint numbers:

| Platform | Device object | Mapping |
| --- | --- | --- |
| STM32 FSDEV | `STM32USBDeviceDevFs` | Entry i (counting from 0) is EPi. `{in_buf, out_buf, in_size, out_size}` declares both IN and OUT; `{buf, size, is_in}` declares one direction |
| STM32 OTG | `STM32USBDeviceOtgFS`, `STM32USBDeviceOtgHS` | The OUT list and the IN list are numbered separately from EP0: entry i of the OUT list is EPi OUT, entry i of the IN list is EPi IN |
| CH32 | `CH32USBDeviceFS`, `CH32USBOtgFS`, `CH32USBOtgHS` | Entry i is EPi; see [CH32 USB Implementation](./ch32_usb.md) for the declaration forms |
| ESP32-S3 | `ESP32USBDevice` | Entry i is EPi; see [ESP32 USB Implementation](./esp_usb.md) for the declaration forms |

In the example above, entry 1 of the declaration list is EP1 IN and OUT and entry 2 is EP2 IN, matching EP1 (data) and EP2 (notification) of `CDCUart`. To add a keyboard `HIDKeyboard` to the same device, the keyboard uses only an IN endpoint, EP3, and the declaration list gains entry 3. Below is hand-written device construction code; the parts identical to the example above are left out:

```cpp
#include "hid_keyboard.hpp"

alignas(4) static uint8_t usb_fs_ep3_in_buf[16];

// ...

  static USB::HIDKeyboard usb_fs_keyboard(USB::Endpoint::EPNumber::EP3,
                                          USB::Endpoint::EPNumber::EP_INVALID);
  static STM32USBDeviceDevFs usb_fs(&hpcd_USB_FS,
                                    {{usb_fs_ep0_in_buf, usb_fs_ep0_out_buf, 8, 8},
                                     {usb_fs_ep1_in_buf, usb_fs_ep1_out_buf, 128, 128},
                                     {usb_fs_ep2_in_buf, 16, true},
                                     {usb_fs_ep3_in_buf, 16, true}},
                                    USB::DeviceDescriptor::PacketSize0::SIZE_8, 0x1D50,
                                    0x6199, 0x100, {&usb_fs_strings},
                                    {{&usb_fs_cdc, &usb_fs_keyboard}},
                                    {reinterpret_cast<void*>(UID_BASE), 12});
```

Buffer rules:

- An endpoint that a device class configures with double buffering (such as the CDC data endpoints) splits its software buffer into two halves. On STM32 the maximum packet size is the smallest of the endpoint type's limit, the hardware buffer size (PMA or FIFO) and half the software buffer.
- On STM32 FSDEV, software buffer lengths are even, the PMA used by all endpoints does not exceed `LIBXR_STM32_USB_PMA_SIZE`, and the declaration list has fewer entries than the endpoint count set in CubeMX (`hpcd->Init.dev_endpoints`).
- On STM32 OTG, `rx_fifo_size` is at least 64 times the number of OUT entries, and `rx_fifo_size` plus the FIFO sizes of all IN endpoints does not exceed `USB_OTG_FS_TOTAL_FIFO_SIZE` (1280 bytes by default, 4096 bytes on H7 and N6) or `USB_OTG_HS_TOTAL_FIFO_SIZE` (4096 bytes by default).

If either of the last two rules is not met, the device constructor triggers an `ASSERT`.

## Additional notes

- `ESP32-S3` uses `ESP32USBDevice`.
- On `ESP32-C3 / ESP32-C6`, the USB Serial/JTAG controller is used by the UART driver `ESP32CDCJtag`; see [UART Driver Design](../../adv_coding/driver/uart_driver.md).
