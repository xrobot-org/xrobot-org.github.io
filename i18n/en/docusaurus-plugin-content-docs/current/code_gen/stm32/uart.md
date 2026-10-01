---
id: stm32-code-gen-uart
title: UART and Terminal
sidebar_position: 11
---

# UART and Terminal

The generator emits code for two kinds of serial ports: hardware UARTs (USART, UART, LPUART) and USB CDC virtual serial ports. Both can serve as the input and output of the terminal.

A hardware UART needs its interrupt enabled in CubeMX, and DMA for each direction in use. USB CDC needs the USB peripheral and its interrupt enabled, without the CubeMX USB_DEVICE middleware or USBX; the XRUSB stack works on the PCD handle directly.

## UART Code Examples

Hardware UART:

```cpp
static STM32UART usart1(&huart1,
            usart1_rx_buf, usart1_tx_buf, 5);
```

A receive-only UART has no transmit DMA, and its transmit buffer is `{nullptr, 0}`:

```cpp
static STM32UART usart3(&huart3,
            usart3_rx_buf, {nullptr, 0}, 5);
```

USB CDC on OTG FS (an STM32F407 project):

```cpp
static constexpr auto USB_OTG_FS_LANG_PACK = LibXR::USB::DescriptorStrings::MakeLanguagePack(LibXR::USB::DescriptorStrings::Language::EN_US, "XRobot", "STM32 XRUSB USB_OTG_FS CDC Demo", "XRUSB-DEMO-");
static LibXR::USB::CDCUart usb_otg_fs_cdc(LibXR::USB::Endpoint::EPNumber::EP1, LibXR::USB::Endpoint::EPNumber::EP1, LibXR::USB::Endpoint::EPNumber::EP2, 128, 128, 3);

static STM32USBDeviceOtgFS usb_fs(
    &hpcd_USB_OTG_FS,
    256,
    {usb_otg_fs_ep0_out_buf, usb_otg_fs_ep1_out_buf},
    {{usb_otg_fs_ep0_in_buf, 8}, {usb_otg_fs_ep1_in_buf, 128}, {usb_otg_fs_ep2_in_buf, 16}},
    USB::DeviceDescriptor::PacketSize0::SIZE_8,
    0x1D50, 0x6199, 0x100,
    {&USB_OTG_FS_LANG_PACK},
    {{&usb_otg_fs_cdc}},
    {reinterpret_cast<void *>(UID_BASE), 12}
);
usb_fs.Init(false);
usb_fs.Start(false);
```

OTG HS generates code of the same form, with the device type `STM32USBDeviceOtgHS`, the object `usb_hs` and the CDC port `usb_otg_hs_cdc`.

USB CDC on an FS device (an STM32F103 project):

```cpp
static constexpr auto USB_FS_LANG_PACK = LibXR::USB::DescriptorStrings::MakeLanguagePack(LibXR::USB::DescriptorStrings::Language::EN_US, "XRobot", "STM32 XRUSB USB CDC Demo", "XRUSB-DEMO-");
static LibXR::USB::CDCUart usb_fs_cdc(LibXR::USB::Endpoint::EPNumber::EP1, LibXR::USB::Endpoint::EPNumber::EP1, LibXR::USB::Endpoint::EPNumber::EP2, 128, 128, 3);

static STM32USBDeviceDevFs usb_fs(
    &hpcd_USB_FS,
    {
        {usb_fs_ep0_in_buf, usb_fs_ep0_out_buf, 8, 8},
        {usb_fs_ep1_in_buf, usb_fs_ep1_out_buf, 128, 128},
        {usb_fs_ep2_in_buf, 16, true}
    },
    USB::DeviceDescriptor::PacketSize0::SIZE_8,
    0x1D50, 0x6199, 0x100,
    {&USB_FS_LANG_PACK},
    {{&usb_fs_cdc}},
    {reinterpret_cast<void *>(UID_BASE), 12}
);
usb_fs.Init(false);
usb_fs.Start(false);
```

`CDCUart` uses EP1 for data and EP2 for notifications; its last three arguments are the CDC receive FIFO, transmit FIFO and queue length. The last argument of the device constructor makes the STM32 unique ID (12 bytes) the USB serial number. See [XRUSB Stack](/docs/xrusb) for the USB device stack.

## Terminal Code Examples

The UART named by `terminal_source` becomes the standard input and output, RamFS and Terminal objects are generated, and by default the software timer runs the terminal every 10 ms:

```cpp
STDIO::read_ = usart1.read_port_;
STDIO::write_ = usart1.write_port_;

static RamFS ramfs("XRobot");
static Terminal<32, 32, 5, 5> terminal(ramfs);
static auto terminal_task = Timer::CreateTask(terminal.TaskFun, &terminal, 10);
Timer::Add(terminal_task);
Timer::Start(terminal_task);
```

With `Terminal.run_as_thread` set to `true`, the terminal runs in a thread of its own instead:

```cpp
static LibXR::Thread term_thread;
term_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                   static_cast<LibXR::Thread::Priority>(3));
```

For a USB CDC terminal, `terminal_source` names the CDC port, for example `usb_otg_fs_cdc`. An empty `terminal_source` generates no terminal; when it is not a generated serial port object, `libxr gen` logs a warning and does not set up the terminal.

## Configuration File Explanation

The following excerpt comes from `User/libxr_config.yaml` of an STM32F407 project:

```yaml
terminal_source: usart1
USART:
  usart1:
    tx_buffer_size: 128
    rx_buffer_size: 128
    dma_section: ''
    tx_queue_size: 5
USB:
  usb_otg_fs:
    enable: true
    ep0_packet_size: 8
    tx_buffer_size: 128
    rx_buffer_size: 128
    rx_fifo_size: 256
    tx_fifo_size: 128
    dma_section: ''
    cdc_tx_fifo_size: 128
    cdc_rx_fifo_size: 128
    cdc_queue_size: 3
    vid: 7504
    pid: 24985
    bcd: 256
    manufacturer: XRobot
    product: STM32 XRUSB USB_OTG_FS CDC Demo
    serial: XRUSB-DEMO-
Terminal:
  read_buff_size: 32
  max_line_size: 32
  max_arg_number: 5
  max_history_number: 5
  run_as_thread: false
```

The settings under `USART` apply to USART, UART and LPUART alike. `tx_buffer_size` and `rx_buffer_size` are the DMA buffer sizes, `tx_queue_size` is the transmit queue length, and `dma_section` is described in [Cache](./cache.md).

Under `USB`, each USB peripheral (`usb_fs`, `usb_otg_fs`, `usb_otg_hs`) has a group of settings. The first generation writes only `enable: false`, and no USB code is generated; after it is set to `true`, the next generation fills in the remaining settings with defaults:

- `ep0_packet_size`: EP0 packet size, one of 8, 16, 32 or 64; any other value is warned about and becomes 8;
- `tx_buffer_size`, `rx_buffer_size`: EP1 transmit and receive buffer sizes;
- `tx_fifo_size`: hardware FIFO size of the EP1 IN endpoint;
- `rx_fifo_size`: receive FIFO shared by the endpoints of an OTG peripheral;
- `dma_section`: linker section of the endpoint buffers;
- `cdc_tx_fifo_size`, `cdc_rx_fifo_size`, `cdc_queue_size`: FIFO and queue lengths of `CDCUart`;
- `vid`, `pid`, `bcd` and three descriptor strings, 1d50:6199 by default.

Values filled in by the generator are written in decimal, so the default vid 0x1D50 appears as `vid: 7504`; a hexadecimal value already in the file is kept as written. Middleware such as USB_DEVICE in CubeMX has no USB settings and generates no code.

The first four entries of `Terminal` are the `Terminal` template arguments: read buffer size, maximum line length, maximum number of arguments and number of history entries. A non-empty `terminal_source` adds `run_as_thread` (default `false`); when it is `true`, `thread_stack_depth` (default 1024) and `thread_priority` (default 3) are added as well.

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
