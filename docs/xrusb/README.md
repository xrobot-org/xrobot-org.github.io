---
id: xrusb
title: XRUSB协议栈
sidebar_position: 9
---

# XRUSB

XRUSB 是 LibXR 中的 USB 设备协议栈。它由平台侧 USB 设备/端点实现与上层 USB Device Class 组合而成，主要面向设备侧（Device）开发。

## 主要特性

- 现代 C++ 实现
- 无锁数据结构
- 双缓冲与 DMA 路径优化
- 端点号由各设备类的构造参数指定，配置切换时从端点池取得
- 构造期一次性内存申请
- 中断驱动与中断安全设计

## 设备协议栈支持

| 协议 | 支持状态 | 说明 |
|------|----------|------|
| CDC-ACM | 支持 | 封装为 LibXR 的 UART 适配 |
| HID | 支持 | 标准键盘/鼠标/手柄类可直接使用，其他类型需自行派生 |
| UAC | 支持 | UAC1 麦克风 |
| GSUSB | 支持（CAN/FDCAN） | 面向 Linux SocketCAN |
| DAPLinkV1 | 支持（SWD；JTAG 需通过 `SetJtag()` 提供后端） | 面向 CMSIS-DAP v1 HID 主机工具链 |
| DFU Runtime | 支持 | 处理运行时 `DETACH` 并延后跳转 bootloader |
| DFU Bootloader | 支持 | 支持 `DNLOAD / UPLOAD / GETSTATUS / ABORT / CLRSTATUS / manifest` 流程 |
| DAPLinkV2 | 支持（SWD；JTAG 需通过 `SetJtag()` 提供后端） | 面向 CMSIS-DAP v2 Bulk 主机工具链 |

## BOS / 平台能力支持

| 能力 | 支持状态 | 说明 |
|------|----------|------|
| WebUSB | 支持 | 用于 DFU runtime / bootloader 等场景 |
| WinUSB MS OS 2.0 | 支持 | 用于 DAPLinkV2 以及当前 DFU runtime / bootloader 路径在 Windows 下的免驱发现 |

补充说明：

- 上表列出设备类和 BOS 实现中已有的能力；
- 是否真正对外发布某项 BOS capability，还取决于具体设备类构造参数，例如是否提供 WebUSB landing page URL、是否沿用默认 WinUSB 元数据作用域等。

## 平台支持

| 平台 | 设备类 / 控制器 | 支持情况 | 测试设备 |
|------|------------------------------|----------|----------|
| STM32 | `STM32USBDeviceDevFs` / FSDEV | 支持 | STM32F103 / STM32G431 |
| STM32 | `STM32USBDeviceOtgFS` / `USB_OTG_FS` | 支持（Device） | STM32F401 / STM32F407 |
| STM32 | `STM32USBDeviceOtgHS` / `USB_OTG_HS` | 支持（Device） | STM32F407 / STM32H750 |
| ESP32-S3 | `ESP32USBDevice` / `USB_OTG_FS` | 支持（Device） | ESP32-S3 |
| CH32 | `CH32USBDeviceFS` / `USB_DEVICE_FS` | 支持 | CH32V203 |
| CH32 | `CH32USBOtgFS` / `USBFS` | 支持（Device） | CH32V307 / CH32V203 / CH32V208 |
| CH32 | `CH32USBOtgHS` / `USBHS` | 支持（Device） | CH32V305 / CH32V307 |

## 目录

- [平台相关实现](/docs/xrusb/plat_ep_dev)
- [设备协议栈](/docs/xrusb/dev_stack)
- [VID/PID 与 Serial 使用约定](/docs/xrusb/xrusb-id)

## 说明

- 平台相关实现页主要讲不同 MCU/SoC 上的 USB 设备与端点实现方式；
- 设备协议栈页主要讲各个 USB Device Class 的行为与接口；
- `VID/PID` 页只讨论 XRUSB 通用默认约定，不覆盖像 CMSIS-DAP 兼容这种特殊设备标识策略。
- 本节只介绍设备侧（Device）协议栈。
