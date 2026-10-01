---
id: stm32-code-gen-uart
title: UART and Terminal
sidebar_position: 11
---

# UART and Terminal

LibXR supports two types of UART interfaces: **Hardware UART** and **USB CDC**. Both can be used for serial communication and terminal interaction.

- **Hardware UART** requires interrupt and DMA enabled;  
- **USB CDC** requires enabling the USB peripheral and corresponding interrupts. Please disable other USB stacks (such as STM32 USB library, USBX, etc.) to avoid conflicts with XRUSB.  
- On STM32, it is **recommended to base the USB device serial number on the MCU Unique ID (UID)** and pass it as `{reinterpret_cast<void*>(UID_BASE), 12}` in the USB device constructor.

## UART Code Examples

```cpp
// Hardware UART
STM32UART usart1(&huart1, usart1_rx_buf, usart1_tx_buf, 5);

// USB CDC Full-Speed (FS) OTG
static constexpr auto USB_OTG_FS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US,
        "XRobot",
        "STM32 XRUSB USB_OTG_FS CDC Demo",
        /* Human-readable serial number prefix */
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
    /* Serial Number UID (12 bytes read from STM32 UID) */
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
        /* Human-readable serial number prefix */
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
    /* Serial Number UID (12 bytes read from STM32 UID) */
    {reinterpret_cast<void*>(UID_BASE), 12}
);
usb_hs.Init(false);
usb_hs.Start(false);

// USB CDC Full-Speed (FS) Device
static constexpr auto USB_FS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US,
        "XRobot",
        "STM32 XRUSB USB CDC Demo",
        /* Human-readable serial number prefix */
        "XRUSB-DEMO-");

LibXR::USB::CDCUart usb_fs_cdc(128, 128, 3);

STM32USBDeviceDevFs usb_fs_dev(
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
    /* Serial Number UID (12 bytes read from STM32 UID) */
    {reinterpret_cast<void*>(UID_BASE), 12}
);
usb_fs_dev.Init(false);
usb_fs_dev.Start(false);
```

## Terminal Code Examples

```cpp
// If using hardware UART
STDIO::read_ = usart1.read_port_;
STDIO::write_ = usart1.write_port_;

// If using USB CDC
STDIO::read_ = usb_otg_fs_cdc.read_port_;
STDIO::write_ = usb_otg_fs_cdc.write_port_;

// Create a virtual file system
RamFS ramfs("XRobot");

// Create the terminal
Terminal<32, 32, 5, 5> terminal(ramfs);

// Method 1: Run as a task (default)
auto terminal_task = Timer::CreateTask(terminal.TaskFun, &terminal, 10);
Timer::Add(terminal_task);
Timer::Start(terminal_task);

// Method 2: Run as a thread (independent thread)
LibXR::Thread terminal_thread;
terminal_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                       static_cast<LibXR::Thread::Priority>(3));
```

## Configuration File Explanation

You can control UART and terminal behavior through the configuration file:

```yaml
# Select the default UART source for terminal binding (usb_otg_fs_cdc, usart1, etc.)
# Leave empty ('') to disable terminal
terminal_source: usb_otg_fs_cdc

# Terminal-related settings (optional)
Terminal:
  read_buff_size: 32        # Terminal read buffer size
  max_line_size: 32         # Maximum line size
  max_arg_number: 5         # Maximum argument number
  max_history_number: 5     # Maximum history number
  run_as_thread: true       # Run as a thread
  thread_stack_depth: 1024  # Thread stack depth (only effective under thread mode)
  thread_priority: 3        # Thread priority (only effective under thread mode)

# Hardware UART configuration
USART:
  usart1:
    tx_buffer_size: 128
    rx_buffer_size: 128
    dma_section: ''
    tx_queue_size: 5

# USB CDC configuration
USB:
  usb_otg_fs:
    enable: true
    # EP0 packet size (only 8/16/32/64 supported)
    ep0_packet_size: 8

    # DMA buffer size (for EP1 IN/OUT user buffers)
    tx_buffer_size: 128     # ep1_in_buf size
    rx_buffer_size: 128     # ep1_out_buf size

    # Hardware FIFO (PCD/USB peripheral internal FIFO configuration)
    tx_fifo_size: 128
    rx_fifo_size: 256

    # CDC internal FIFO and queues
    cdc_tx_fifo_size: 128
    cdc_rx_fifo_size: 128
    cdc_queue_size: 3

    # Optional: put endpoint DMA buffers in a specific section
    dma_section: ""

    # Optional: USB device descriptors
    vid: 0x1D50
    pid: 0x6199
    bcd: 0x0100
    manufacturer: "XRobot"
    product: "STM32 XRUSB USB_OTG_FS CDC Demo"
    serial: "XRUSB-DEMO-"
```

---

## Code Generation Command

After modifying `libxr_config.yaml`, use one of the following commands to regenerate the code:

```bash
# Regenerate the entire project
libxr stm32 setup -d .
```

Or:

```bash
# Regenerate only app_main.cpp
libxr gen -i ./.config.yaml -o ./User/app_main.cpp
```
