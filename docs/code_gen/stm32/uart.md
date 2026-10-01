---
id: stm32-code-gen-uart
title: 串口与终端
sidebar_position: 11
---

# 串口与终端

LibXR 支持两种串口类型：**硬件串口** 和 **USB CDC**。它们均可用于串口通信与终端交互。

- **硬件串口** 需启用中断与 DMA；
- **USB CDC** 需启用 USB 外设与对应中断。请关闭其他的 USB 协议栈（STM32 USB库，USBX 等），防止与 XRUSB 冲突；
- 在 STM32 平台上，**USB 设备序列号建议基于芯片唯一 ID（UID）生成，在构造函数最后以 `{reinterpret_cast<void*>(UID_BASE), 12}` 的形式传入**。

## 串口代码示例

```cpp
// 硬件串口
STM32UART usart1(&huart1, usart1_rx_buf, usart1_tx_buf, 5);

// USB CDC Full-Speed (FS) OTG
static constexpr auto USB_OTG_FS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US,
        "XRobot",
        "STM32 XRUSB USB_OTG_FS CDC Demo",
        /* 序列号字符串前缀（可读） */
        "XRUSB-DEMO-");

LibXR::USB::CDCUart usb_otg_fs_cdc(128, 128, 3);
STM32USBDeviceOtgFS usb_fs(
    &hpcd_USB_OTG_FS,
    256,
    {usb_otg_fs_ep0_out_buf, usb_otg_fs_ep1_out_buf},
    {{usb_otg_fs_ep0_in_buf, 8}, {usb_otg_fs_ep1_in_buf, 128}, {usb_otg_fs_ep2_in_buf, 16}},
    USB::DeviceDescriptor::PacketSize0::SIZE_8,
    0x1D50, 0x6199, 0x0100,
    {&USB_OTG_FS_LANG_PACK},
    {{&usb_otg_fs_cdc}},
    /* Serial Number UID（从 STM32 UID 读取的 12 字节） */
    {reinterpret_cast<void*>(UID_BASE), 12}
);
usb_fs.Init(false);
usb_fs.Start(false);

// USB CDC High-Speed (HS) OTG
static constexpr auto USB_OTG_HS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US,
        "XRobot",
        "STM32 XRUSB USB_OTG_HS CDC Demo",
        /* 序列号字符串前缀（可读） */
        "XRUSB-DEMO-");

LibXR::USB::CDCUart usb_otg_hs_cdc(128, 128, 3);

STM32USBDeviceOtgHS usb_hs(
    &hpcd_USB_OTG_HS,
    256,
    {usb_otg_hs_ep0_out_buf, usb_otg_hs_ep1_out_buf},
    {{usb_otg_hs_ep0_in_buf, 8}, {usb_otg_hs_ep1_in_buf, 128}, {usb_otg_hs_ep2_in_buf, 16}},
    USB::DeviceDescriptor::PacketSize0::SIZE_8,
    0x1D50, 0x6199, 0x0100,
    {&USB_OTG_HS_LANG_PACK},
    {{&usb_otg_hs_cdc}},
    /* Serial Number UID（从 STM32 UID 读取的 12 字节） */
    {reinterpret_cast<void*>(UID_BASE), 12}
);
usb_hs.Init(false);
usb_hs.Start(false);

// USB CDC Full-Speed (FS) DEVICE
static constexpr auto USB_FS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US,
        "XRobot",
        "STM32 XRUSB USB CDC Demo",
        /* 序列号字符串前缀（可读） */
        "XRUSB-DEMO-");

LibXR::USB::CDCUart usb_fs_cdc(128, 128, 3);

STM32USBDeviceDevFs usb_fs(
    &hpcd_USB_FS,
    {
        {usb_fs_ep0_in_buf, usb_fs_ep0_out_buf, 8, 8},
        {usb_fs_ep1_in_buf, usb_fs_ep1_out_buf, 128, 128},
        {usb_fs_ep2_in_buf, 16, true}
    },
    USB::DeviceDescriptor::PacketSize0::SIZE_8,
    0x1D50, 0x6199, 0x0100,
    {&USB_FS_LANG_PACK},
    {{&usb_fs_cdc}},
    /* Serial Number UID（从 STM32 UID 读取的 12 字节） */
    {reinterpret_cast<void*>(UID_BASE), 12}
);
usb_fs.Init(false);
usb_fs.Start(false);
```

如果你启用的是 `USB_OTG_HS` 或 `USB_FS DEVICE`，生成出来的设备类会变，但 `CDCUart` 的配置形状和终端接法是一致的。具体设备实现细节看 [XRUSB 协议栈](/docs/xrusb)。

## 终端代码示例

```cpp
// 如果使用硬件串口
STDIO::read_ = usart1.read_port_;
STDIO::write_ = usart1.write_port_;

// 如果使用 USB CDC
STDIO::read_ = usb_otg_fs_cdc.read_port_;
STDIO::write_ = usb_otg_fs_cdc.write_port_;

// 创建虚拟文件系统
RamFS ramfs("XRobot");

// 创建终端
Terminal<32, 32, 5, 5> terminal(ramfs);

// 方式一：作为任务运行（默认）
auto terminal_task = Timer::CreateTask(terminal.TaskFun, &terminal, 10);
Timer::Add(terminal_task);
Timer::Start(terminal_task);

// 方式二：作为线程运行（独立线程）
LibXR::Thread terminal_thread;
terminal_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                       static_cast<LibXR::Thread::Priority>(3));
```

## 配置文件说明

可通过配置文件控制串口与终端行为：

```yaml
# 选择默认终端绑定的串口（usb_otg_fs_cdc 或 usart1 等），留空('')表示不启用终端
terminal_source: usb_otg_fs_cdc

# 终端相关配置（可选）
Terminal:
  read_buff_size: 32      # 终端读取缓冲区大小
  max_line_size: 32       # 每行最大字符数
  max_arg_number: 5       # 每行最大参数个数
  max_history_number: 5   # 历史命令个数
  run_as_thread: true     # 是否作为线程运行
  thread_stack_depth: 1024  # 线程栈深度（仅在线程下有效）
  thread_priority: 3      # 线程优先级（仅在线程下有效）

# 硬件串口配置
USART:
  usart1:
    tx_buffer_size: 128
    rx_buffer_size: 128
    dma_section: ''
    tx_queue_size: 5

# USB CDC 配置
USB:
  usb_otg_fs:
    enable: true
    # EP0 包大小（仅允许 8/16/32/64）
    ep0_packet_size: 8

    # DMA 缓冲区大小（用于 EP1 IN/OUT 的用户态缓冲）
    tx_buffer_size: 128
    rx_buffer_size: 128

    # 硬件 FIFO（PCD/USB 外设内部 FIFO 配置）
    tx_fifo_size: 128
    rx_fifo_size: 256

    # CDC 端内 FIFO 与队列
    cdc_tx_fifo_size: 128
    cdc_rx_fifo_size: 128
    cdc_queue_size: 3

    # 可选：将端点 DMA 缓冲区放入指定段
    dma_section: ''

    # 可选：USB 设备描述符
    vid: 0x1D50
    pid: 0x6199
    bcd: 0x0100
    manufacturer: "XRobot"
    product: "STM32 XRUSB USB_OTG_FS CDC Demo"
    serial: "XRUSB-DEMO-"
```

---

## 生成代码命令

修改 `libxr_config.yaml` 后，可使用以下任一命令重新生成代码：

```bash
# 重新生成整个工程
libxr stm32 setup -d .
```

或：

```bash
# 只重新生成app_main.cpp
libxr gen -i ./.config.yaml -o ./User/app_main.cpp
```
