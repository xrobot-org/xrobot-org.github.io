---
id: xrusb-plat-dev-ch32
title: CH32 USB 实现
sidebar_position: 2
---

# CH32 USB 实现

CH32 当前主线主要覆盖三类 USB 设备路径，如下所示。
对于带 UID 的芯片（如 CH32V2/V3 系列），**设备序列号建议使用芯片内置 UID，在构造函数最后以地址+长度的形式传入**。

| 当前主线路径 | 对应类 | 角色 | 说明 |
| ------------ | ------ | ---- | ---- |
| `USB_DEVICE_FS` | `LibXR::CH32USBDeviceFS` | 从机 | FSDEV 设备路径 |
| `USBFS/OTG FS` | `LibXR::CH32USBOtgFS` | 主机/从机中的设备侧 | OTG FS 设备路径 |
| `USBHS/OTG HS` | `LibXR::CH32USBOtgHS` | 主机/从机中的设备侧 | OTG HS 设备路径 |

> 说明：对于常见 CH32V2/V3 系列，UID 为 96bit（12 字节），可以从 0x1FFFF7E8 连续读取 12 字节作为序列号来源。

## `CH32USBDeviceFS`（FSDEV）

`CH32USBDeviceFS` 只支持下面这种端点声明方式，建议非 EP0 端点缓冲区大小为 128 字节：

1. `{{ep0_buffer}, ...}`: 直接传入缓冲区即可，除了EP0都会被分割为IN/OUT缓冲区，端点号自动递增

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
    /* Serial Number UID（从 CH32 UID 读取的十六进制字节数组） */
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
```

## `CH32USBOtgFS`（OTG FS）

`CH32USBOtgFS` 当前主线使用与 OTG FS 控制器相对应的端点声明方式，端点号从 `EP0` 开始自动递增。

1. `{ep0_buf_fs}`：声明 EP0 缓冲区
2. `{ep1_in_buf_fs, true}`：声明单向 IN 端点
3. `{ep2_out_buf_fs, false}`：声明单向 OUT 端点
4. `{ep3_shared_buf_fs}`：声明共用单个缓冲区条目的双向端点

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
    /* Serial Number UID（从 CH32 UID 读取的十六进制字节数组） */
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
```

## `CH32USBOtgHS`（OTG HS）

`CH32USBOtgHS` 支持三种端点声明方式，非 EP0 端点缓冲区大小推荐为 1024 字节，端点号自动递增：

1. `{ep0_buffer_hs}`: 直接传入EP0端点的缓冲区  
1. `{ep1_buffer_tx_hs, true}`：传入缓冲区并开启双缓冲  
   - ep1_buffer_tx_hs: EP1 端点的缓冲区  
   - true: 是否配置为IN端点  
1. `{ep2_buffer_tx_hs, ep2_buffer_rx_hs}`：传入双向端点的缓冲区，不开启双缓冲；参数顺序为 **TX/IN 在前、RX/OUT 在后**（`EPConfig(buffer_tx, buffer_rx)`）

```cpp
LibXR::CH32USBOtgHS usb_dev_hs(
    /* EP */
    {
        {ep0_buf_hs},                    // EP0
        {ep1_in_buf_hs, true},           // EP1 IN（单向，双缓冲）
        {ep2_out_buf_hs, false},         // EP2 OUT（单向，双缓冲）
        {ep3_in_buf_hs, ep3_out_buf_hs}  // EP3 双向（不启双缓冲）
    },
    /* vid pid bcd */
    0x1D50, 0x6199, 0x0100,
    /* language */
    {&LANG_PACK_EN_US},
    /* config */
    {{&cdc2}},
    /* Serial Number UID（从 CH32 UID 读取的十六进制字节数组） */
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
```
