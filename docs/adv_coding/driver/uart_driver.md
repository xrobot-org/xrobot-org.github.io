---
id: adv-coding-drv-uart-driver
title: 串口驱动设计
sidebar_position: 2
---

# 串口驱动设计

`LibXR::UART` 对外只有一套接口，平台差异都压在发送路径、接收路径和推进上下文里。无论是裸机 MCU、RTOS 还是 Linux 用户态，这条抽象都不变；变化的是底层如何把字节送进 `ReadPort`，以及如何把待发送数据从 `WritePort` 推给硬件。

## 统一抽象

UART 驱动对上统一暴露 `SetConfig(...)`、`Write(...)` 和 `Read(...)`。真正的平台差异被压进 `ReadPort / WritePort` 和完成模型里。发送路径通常先把数据和操作信息写进端口，再由驱动在硬件可发送的时候装载当前块；接收路径则相反，先由 DMA、FIFO 或系统调用拿到字节，再把它们推进 `ReadPort` 的队列，由 `ProcessPendingReads(...)` 满足挂起读请求。

这也是为什么大多数实现里，`ReadFun(...)` 本身并不主动读硬件，而只是返回 `PENDING`。真正的推进发生在 DMA 中断、UART 中断或者读写线程里。

## MCU 路径

`STM32UART` 和 `CH32UART` 是最典型的 MCU 实现。两者的共同点很明确：接收侧使用常驻 DMA，发送侧使用双缓冲，用户侧读写统一经过 `ReadPort / WritePort`，完成通知由 DMA 完成中断或空闲事件推进。

接收侧的关键在于 DMA 一直保持活跃。ISR 只需要根据当前写指针和上次位置算出新增区间，把这段数据推进软件队列，再调用 `ProcessPendingReads(true)`。这样接收路径没有“停下来重新 arm”这一拍，软件只负责追赶硬件写指针。

发送侧则是另一套节奏。`STM32UART` 和 `CH32UART` 都不会在每次 `Write(...)` 时简单地直接起一次 DMA，而是先看当前 active/pending 哪块缓冲可用：DMA 空闲就直接写 active 区并启动；DMA 正忙就把下一笔数据写进 pending 区，等发送完成中断切过去。完成中断里的顺序是关键：先续上传输，再更新前一笔操作状态。只要顺序反过来，高频路径里的空窗就会立刻变长。

## ESP32 路径

`ESP32UART` 仍然沿用同一套端口抽象，但内部会按芯片能力选择后端。有 GDMA 时走 DMA 路径，没有则退回 FIFO + UART 中断。无论底层是哪条后端，发送侧都保留 active/pending 双槽，接收侧都以“先把字节推入端口队列，再处理挂起读请求”为准。

`ESP32CDCJtag` 也值得单独提一下。它对上同样继承 `LibXR::UART`，但底层不是传统 UART 外设，而是 `USB Serial/JTAG` 控制器。它保留了 UART 抽象，却不属于 XRUSB 的通用 `DeviceCore`。从驱动设计角度看，它依然遵循相同原则：发送侧准备下一块，接收侧把字节推进 `ReadPort`，只不过底层搬运方式从 UART DMA/FIFO 变成了 USB Serial/JTAG FIFO。

## Linux 路径

`LinuxUART` 的上下文已经不再是 ISR 和 DMA，而是线程。它直接打开 `/dev/tty*`，配置 `termios`，再分别创建 RX 和 TX 线程。对上接口保持不变，对内推进方式则改成线程循环 `read(...)` 和 `write(...)`。这里不再追求中断级时延，而更关心设备发现、串口参数配置和用户态阻塞语义。

## 这套设计在意什么

把不同平台的实现摊开来看，重点其实一直没变：接收侧要尽量做到“硬件持续喂数据，软件按需取”；发送侧要尽量做到“当前块还在发，下一块已经准备好”；完成通知要尽量短路径地推进下一次传输。这三点决定了驱动在热路径上的实际表现。
