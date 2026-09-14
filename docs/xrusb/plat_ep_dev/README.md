---
id: xrusb-plat-dev
title: 平台相关实现
sidebar_position: 1
---

# 平台相关实现

本节介绍 XRUSB 在不同平台上的 USB 设备与端点实现，以及设备对象的基本构造方式。
**设备序列号建议基于平台提供的芯片唯一ID（UID）生成。**

## 目录

- [STM32 USB 实现](./stm32_usb.md)
- [CH32 USB 实现](./ch32_usb.md)
- [ESP32 USB 实现](./esp_usb.md)

例如：

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
    LANG_PACK,
    /* Classes */
    {{&cdc_uart, &hid_keyboard}},
    /* Serial Number UID（十六进制字节数组，可选） */
    {addr, size});
```

示例中的 `VID / PID / bcdDevice` 只是构造形状示意。真正给项目选值时，应先看 [VID/PID 与 Serial 使用约定](/docs/xrusb/xrusb-id)；如果某个设备类需要兼容特定主机生态，则以该设备类页面的说明为准。

这里真正因平台而变的是：

- USB 设备类本体，例如 `STM32USBDevice...`、`CH32USBDevice...`
- 端点缓冲区声明方式
- FIFO / PMA / DMA 等底层资源组织

而 `CDCUart`、`HIDKeyboard` 这类上层 class 的接法基本是一致的：都在设备构造函数最后通过 class 列表传进去。

补充说明：

- 对于 `ESP32-S3`，当前主线里有独立的 `ESP32USBDevice` 设备侧实现；
- 对于 `ESP32-C3 / ESP32-C6`，当前主线更多是通过 `ESP32CDCJtag` 提供 USB Serial/JTAG UART 路径，这不属于 XRUSB 的通用设备控制器实现。
