---
id: xrusb-plat-dev
title: 平台相关实现
sidebar_position: 1
---

# 平台相关实现

本节介绍 XRUSB 在不同平台上的 USB 设备与端点实现，以及设备对象的构造方式。
设备序列号建议基于平台提供的芯片唯一ID（UID）生成。

## 目录

- [STM32 USB 实现](./stm32_usb.md)
- [CH32 USB 实现](./ch32_usb.md)
- [ESP32 USB 实现](./esp_usb.md)

## 设备对象的构造

以下节选自代码生成器为 STM32F103 工程生成的 `User/app_main.cpp`。该芯片使用 FSDEV 控制器，设备带一路 CDC 串口：

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

设备构造函数的参数依次为：外设句柄、端点声明列表、EP0 包长、VID、PID、bcdDevice、语言包列表、配置列表（每个配置是一组设备类），以及可选的 UID 原始字节的地址和长度。语言包的第三个字符串是序列号前缀，协议栈把 UID 转换为十六进制字符串追加在它之后。`VID / PID / bcdDevice` 和序列号的取值见 [VID/PID 与 Serial 使用约定](/docs/xrusb/xrusb-id)；如果某个设备类需要兼容特定主机生态，则以该设备类页面的说明为准。

随平台变化的部分：

- USB 设备类本体，例如 `STM32USBDevice...`、`CH32USBDevice...`
- 端点缓冲区声明方式
- FIFO / PMA / DMA 等底层资源组织

`CDCUart`、`HIDKeyboard` 等设备类在各平台上的用法相同：通过设备构造函数的配置列表传入。

## 端点号

设备类在构造时给出自己使用的端点号，例如 `CDCUart` 的前三个参数依次是数据 IN、数据 OUT 和通知 IN 端点。设备构造函数的端点声明列表决定设备上有哪些端点号、各自的方向和缓冲区。调用设备的 `Init()` 时，每个设备类按“端点号 + 方向”从声明的端点中取出自己的端点；声明列表中没有对应的端点，或该端点已被其他设备类取走时，触发 `ASSERT`。因此：

- 同一端点号的同一方向只能分给一个设备类；
- 只用 IN 端点的设备类，OUT 端点号传 `EP_INVALID`，例如不启用 OUT 端点的 `HIDKeyboard`；
- 设备类用到的每个端点号和方向都要在声明列表中出现。

各平台的声明列表与端点号的对应规则如下：

| 平台 | 设备对象 | 对应规则 |
| --- | --- | --- |
| STM32 FSDEV | `STM32USBDeviceDevFs` | 第 i 项（从 0 计）对应 EPi。`{in_buf, out_buf, in_size, out_size}` 声明 IN 和 OUT 两个方向，`{buf, size, is_in}` 只声明一个方向 |
| STM32 OTG | `STM32USBDeviceOtgFS`、`STM32USBDeviceOtgHS` | OUT 列表和 IN 列表各自从 EP0 起编号：OUT 列表第 i 项是 EPi OUT，IN 列表第 i 项是 EPi IN |
| CH32 | `CH32USBDeviceFS`、`CH32USBOtgFS`、`CH32USBOtgHS` | 第 i 项对应 EPi，声明方式见 [CH32 USB 实现](./ch32_usb.md) |
| ESP32-S3 | `ESP32USBDevice` | 第 i 项对应 EPi，声明方式见 [ESP32 USB 实现](./esp_usb.md) |

上例中，声明列表第 1 项是 EP1 的 IN 和 OUT，第 2 项是 EP2 IN，与 `CDCUart` 的 EP1（数据）和 EP2（通知）对应。在同一设备上再加一个键盘 `HIDKeyboard`，键盘只用 IN 端点，取 EP3，声明列表相应增加第 3 项。以下是手写的设备构造代码，与上例相同的部分省略：

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

缓冲区的规则：

- 设备类按双缓冲配置的端点（例如 CDC 的数据端点）把软件缓冲区平分为两半。STM32 上，最大包长取端点类型的上限、硬件缓冲区（PMA 或 FIFO）大小和半个软件缓冲区三者中的最小值。
- STM32 FSDEV 的软件缓冲区长度为偶数，全部端点占用的 PMA 不超过 `LIBXR_STM32_USB_PMA_SIZE`，声明列表的项数小于 CubeMX 中设置的端点数（`hpcd->Init.dev_endpoints`）。
- STM32 OTG 的 `rx_fifo_size` 不小于 64 乘以 OUT 列表的项数，`rx_fifo_size` 与各 IN 端点 FIFO 大小之和不超过 `USB_OTG_FS_TOTAL_FIFO_SIZE`（默认 1280 字节，H7、N6 为 4096 字节）或 `USB_OTG_HS_TOTAL_FIFO_SIZE`（默认 4096 字节）。

后两条不满足时，设备构造函数触发 `ASSERT`。

## 补充说明

- `ESP32-S3` 使用 `ESP32USBDevice`。
- `ESP32-C3 / ESP32-C6` 的 USB Serial/JTAG 控制器由 UART 驱动 `ESP32CDCJtag` 使用，见[串口驱动设计](../../adv_coding/driver/uart_driver.md)。
