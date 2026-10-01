---
id: stm32-code-gen-uart
title: 串口与终端
sidebar_position: 11
---

# 串口与终端

生成器为两类串口生成代码：硬件串口（USART、UART、LPUART）和 USB CDC 虚拟串口。两者都可以作为终端的输入输出。

硬件串口在 CubeMX 中需要开启中断，并为使用的收发方向开启 DMA。USB CDC 需要开启 USB 外设及其中断，并且不启用 CubeMX 的 USB_DEVICE 中间件或 USBX，XRUSB 协议栈直接使用 PCD 句柄。

## 串口代码示例

硬件串口：

```cpp
static STM32UART usart1(&huart1,
            usart1_rx_buf, usart1_tx_buf, 5);
```

只接收的串口没有发送 DMA，发送缓冲区为 `{nullptr, 0}`：

```cpp
static STM32UART usart3(&huart3,
            usart3_rx_buf, {nullptr, 0}, 5);
```

USB CDC，OTG FS（STM32F407 工程）：

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

OTG HS 生成相同形式的代码，设备类型为 `STM32USBDeviceOtgHS`，对象名为 `usb_hs`，CDC 串口为 `usb_otg_hs_cdc`。

USB CDC，FS 设备（STM32F103 工程）：

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

`CDCUart` 用 EP1 收发数据、EP2 发送通知，后三个参数依次是 CDC 的接收 FIFO、发送 FIFO 和队列长度。设备构造函数的最后一个参数把 STM32 芯片唯一 ID（12 字节）作为 USB 序列号。USB 设备协议栈见 [XRUSB 协议栈](/docs/xrusb)。

## 终端代码示例

`terminal_source` 指定的串口作为标准输入输出，同时生成 RamFS 和 Terminal 对象，默认由软件定时器每 10 ms 运行一次终端：

```cpp
STDIO::read_ = usart1.read_port_;
STDIO::write_ = usart1.write_port_;

static RamFS ramfs("XRobot");
static Terminal<32, 32, 5, 5> terminal(ramfs);
static auto terminal_task = Timer::CreateTask(terminal.TaskFun, &terminal, 10);
Timer::Add(terminal_task);
Timer::Start(terminal_task);
```

`Terminal.run_as_thread` 为 `true` 时，终端改为在独立线程中运行：

```cpp
static LibXR::Thread term_thread;
term_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                   static_cast<LibXR::Thread::Priority>(3));
```

USB CDC 作为终端时，`terminal_source` 写 CDC 串口的名字，例如 `usb_otg_fs_cdc`。`terminal_source` 为空时不生成终端；它不是已生成的串口对象时，`libxr gen` 给出警告，不初始化终端。

## 配置文件说明

以下片段来自 STM32F407 工程的 `User/libxr_config.yaml`：

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

`USART` 下的设置对 USART、UART 和 LPUART 都适用。`tx_buffer_size` 和 `rx_buffer_size` 是 DMA 缓冲区大小，`tx_queue_size` 是发送队列长度，`dma_section` 见 [高速缓存](./cache.md)。

`USB` 下每个 USB 外设（`usb_fs`、`usb_otg_fs`、`usb_otg_hs`）有一组设置。首次生成时只写入 `enable: false`，此时不生成 USB 代码；改为 `true` 后再次生成，其余设置以默认值补齐：

- `ep0_packet_size`：EP0 包大小，只能是 8、16、32 或 64，其他值给出警告并改为 8；
- `tx_buffer_size`、`rx_buffer_size`：EP1 收发缓冲区大小；
- `tx_fifo_size`：EP1 发送端点的硬件 FIFO 大小；
- `rx_fifo_size`：OTG 外设共享的接收 FIFO 大小；
- `dma_section`：端点缓冲区所在的链接段；
- `cdc_tx_fifo_size`、`cdc_rx_fifo_size`、`cdc_queue_size`：`CDCUart` 的 FIFO 和队列长度；
- `vid`、`pid`、`bcd` 和三个描述符字符串，默认使用 1d50:6199。

生成器补上的数值以十进制写入，例如默认的 vid 0x1D50 写作 `vid: 7504`；文件中已有的十六进制写法保持不变。CubeMX 中的 USB_DEVICE 等中间件不对应任何 USB 设置，也不生成代码。

`Terminal` 的前四项是 `Terminal` 模板参数，依次为读取缓冲区大小、单行最大长度、最大参数个数和历史命令条数。`terminal_source` 非空时另外写入 `run_as_thread`（默认 `false`），它为 `true` 时再写入 `thread_stack_depth`（默认 1024）和 `thread_priority`（默认 3）。

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
