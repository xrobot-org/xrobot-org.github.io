---
id: xrusb-plat-dev
title: 平台相关实现
sidebar_position: 1
---

# 平台相关实现

本节介绍 XRUSB 在不同平台上的 USB 设备与端点实现，以及设备对象的基本构造方式。
设备序列号建议基于平台提供的芯片唯一ID（UID）生成。

## 目录

- [STM32 USB 实现](./stm32_usb.md)
- [CH32 USB 实现](./ch32_usb.md)
- [ESP32 USB 实现](./esp_usb.md)

例如：

```cpp
/* USB Classes：CDC 用 EP1（数据 IN/OUT）和 EP2（通知 IN），键盘用 EP3 IN */
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
        /* Serial Number 字符串前缀（可读） */
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
    /* Serial Number UID（UID 原始字节的地址和长度，可选） */
    {addr, size});
usb.Init(false);
usb.Start(false);
```

示例中的 `VID / PID / bcdDevice` 只是构造形状示意。真正给项目选值时，应先看 [VID/PID 与 Serial 使用约定](/docs/xrusb/xrusb-id)；如果某个设备类需要兼容特定主机生态，则以该设备类页面的说明为准。

随平台变化的部分：

- USB 设备类本体，例如 `STM32USBDevice...`、`CH32USBDevice...`
- 端点缓冲区声明方式
- FIFO / PMA / DMA 等底层资源组织

`CDCUart`、`HIDKeyboard` 等设备类在各平台上的用法相同：通过设备构造函数的 class 列表传入，class 列表之后是可选的 UID 参数。

补充说明：

- `ESP32-S3` 使用 `ESP32USBDevice`。
- `ESP32-C3 / ESP32-C6` 的 USB Serial/JTAG 控制器由 UART 驱动 `ESP32CDCJtag` 使用，见 [ESP32 USB 实现](./esp_usb.md)。
