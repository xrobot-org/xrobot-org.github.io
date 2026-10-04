---
id: adv-coding-drv-uart-driver
title: 串口驱动设计
sidebar_position: 2
---

# 串口驱动设计

`LibXR::UART` 对外只有一套接口，平台差异体现在发送路径、接收路径和推进它们的上下文中。裸机 MCU、RTOS 和 Linux 用户态使用同一套接口，区别在于底层如何把字节送进 `ReadPort`，以及如何把待发送数据从 `WritePort` 交给硬件。

## 统一抽象

UART 驱动对上统一暴露 `SetConfig(...)`、`Write(...)` 和 `Read(...)`，平台差异由驱动与 `ReadPort / WritePort` 之间的接口承担。发送路径先把数据和请求复制进 `WritePort`，再通过 `WriteFun` 通知驱动；驱动在硬件可发送时用 `GetWriteQueue(in_isr)` 取出队头请求，复制进自己的缓冲区或硬件 FIFO。接收路径相反：DMA、FIFO 或系统调用取得字节后，驱动用 `GetReadQueue(in_isr)` 取得接收入队接口，`PushBatch` 写入新增数据，再调用一次 `Publish()`，由 `ReadPort` 满足挂起的读请求。

驱动不处理单个读请求，接收的推进发生在 DMA 中断、UART 中断或 I/O 线程里。

## MCU 路径

`STM32UART` 和 `CH32UART` 是 MCU 上的典型实现：接收侧使用常驻 DMA，发送侧使用双缓冲，用户侧读写统一经过 `ReadPort / WritePort`。

接收侧的 DMA 一直保持运行。ISR 根据当前写指针和上次位置算出新增区间，用 `PushBatch` 写入 `GetReadQueue(true)` 取得的接收队列，再调用 `Publish()`。接收路径因此没有停止后重新启动 DMA 的间隔，软件只负责追赶硬件写指针。

发送侧在每次写入时先检查 active 和 pending 两块缓冲：DMA 空闲时，数据写入 active 区并立即启动 DMA；DMA 正忙时，数据写入 pending 区，等发送完成中断切换过去。写请求在数据复制进 active 或 pending 区时完成，因此 `BLOCK` 写返回时数据可能仍在发送。发送完成中断先切换到 pending 区并启动下一次 DMA，再从队列取下一笔请求填入新的 pending 区，使两次传输之间的空窗尽量短。

## ESP32 路径

`ESP32UART` 沿用同一套端口抽象，内部按芯片能力选择后端：有 GDMA 时走 DMA 路径，没有时使用 FIFO 和 UART 中断。GDMA 路径的发送侧使用 active/pending 双缓冲，请求复制进发送半区时完成；FIFO 路径用 `PopWithWriter` 按硬件 FIFO 实际接收的字节数消费请求，不暂存第二块数据。两条路径的接收侧都先把字节写入 `ReadPort` 队列，再推进挂起读。

`ESP32CDCJtag` 同样继承 `LibXR::UART`，底层是 ESP32-C3、ESP32-C6 内置的 `USB Serial/JTAG` 控制器，代码位于 `driver/esp/esp_cdc_jtag.*`。它直接读写控制器的硬件 FIFO，不经过 XRUSB 的 `DeviceCore` 和 `EndpointPool`。发送字节写入硬件 FIFO 后才从 `WriteQueue` 消费（`PopWithWriter`），接收字节通过 `ReadQueue` 写入 `ReadPort`。

构造函数的参数依次为接收队列容量、发送队列容量、写请求队列长度和初始配置，以下示例中的取值即各参数的默认值：

```cpp
LibXR::ESP32CDCJtag usb_jtag_uart(
    1024,
    512,
    5,
    {115200, LibXR::UART::Parity::NO_PARITY, 8, 1});
```

- 只在 ESP32-C3、ESP32-C6 上编译；
- 只支持 8 位数据、无校验、1 位停止位，`SetConfig()` 收到其他配置时返回 `ARG_ERR`；
- ESP-IDF 的主控制台使用同一个控制器，`CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG=y` 时编译报错，使用 `ESP32CDCJtag` 前在 menuconfig 中关闭该选项。

## Linux 路径

`LinuxUART` 由线程推进。它以非阻塞方式打开 `/dev/tty*`（也可按 USB VID/PID、接口名称或序列号匹配设备）并配置 `termios`；一个 I/O 线程（`io_thread_`）通过 `poll` 负责打开、关闭、重连、配置和收发，端口回调只通过 `eventfd` 唤醒该线程，发送用 `writev` 写出。写请求在数据被 Linux 内核接收时完成。对上接口保持不变，硬件事件换成了内核文件描述符事件，需要考虑的是设备发现、串口参数配置、内核缓冲和线程调度带来的时延。

## 设计目标

各平台的实现有三个共同目标：接收侧由硬件持续写入数据，软件按需取出；发送侧在当前块发送期间准备好下一块；完成通知以最短的路径启动下一次传输。这三点决定了驱动在高频路径上的表现。
