---
id: adv-coding-drv-uart-driver
title: 串口驱动设计
sidebar_position: 2
---

# 串口驱动设计

`LibXR::UART` 对外只有一套接口，平台差异都压在发送路径、接收路径和推进上下文里。无论是裸机 MCU、RTOS 还是 Linux 用户态，这条抽象都不变；变化的是底层如何把字节送进 `ReadPort`，以及如何把待发送数据从 `WritePort` 推给硬件。

## 统一抽象

UART 驱动对上统一暴露 `SetConfig(...)`、`Write(...)` 和 `Read(...)`，平台差异由驱动与 `ReadPort / WritePort` 之间的接口承担。发送路径先把数据和请求复制进 `WritePort`，再通过 `WriteFun` 通知驱动；驱动在硬件可发送时用 `GetWriteQueue(in_isr)` 取出队头请求，复制进自己的缓冲区或硬件 FIFO。接收路径相反：DMA、FIFO 或系统调用取得字节后，驱动用 `GetReadQueue(in_isr)` 取得接收入队接口，`PushBatch` 写入新增数据，再调用一次 `Publish()`，由 `ReadPort` 满足挂起的读请求。

驱动不处理单个读请求，接收的推进发生在 DMA 中断、UART 中断或 I/O 线程里。

## MCU 路径

`STM32UART` 和 `CH32UART` 是最典型的 MCU 实现。两者的共同点很明确：接收侧使用常驻 DMA，发送侧使用双缓冲，用户侧读写统一经过 `ReadPort / WritePort`，完成通知由 DMA 完成中断或空闲事件推进。

接收侧的关键在于 DMA 一直保持活跃。ISR 根据当前写指针和上次位置算出新增区间，用 `PushBatch` 写入 `GetReadQueue(true)` 取得的接收队列，再调用 `Publish()`。这样接收路径没有“停下来重新 arm”这一拍，软件只负责追赶硬件写指针。

发送侧则是另一套节奏。`STM32UART` 和 `CH32UART` 都不会在每次 `Write(...)` 时简单地直接起一次 DMA，而是先看当前 active/pending 哪块缓冲可用：DMA 空闲就直接写 active 区并启动；DMA 正忙就把下一笔数据写进 pending 区，等发送完成中断切过去。写请求在数据复制进 active 或 pending 区时完成，因此 `BLOCK` 写返回时数据可能仍在发送。发送完成中断先切换到 pending 区并启动下一次 DMA，再从队列取下一笔请求填入新的 pending 区，使两次传输之间的空窗尽量短。

## ESP32 路径

`ESP32UART` 仍然沿用同一套端口抽象，但内部会按芯片能力选择后端。有 GDMA 时走 DMA 路径，没有则退回 FIFO + UART 中断。GDMA 路径的发送侧使用 active/pending 双缓冲，请求复制进发送半区时完成；FIFO 路径用 `PopWithWriter` 按硬件 FIFO 实际接收的字节数消费请求，不暂存第二块数据。两条路径的接收侧都先把字节写入 `ReadPort` 队列，再推进挂起读。

`ESP32CDCJtag` 同样继承 `LibXR::UART`，底层使用 ESP32 的 `USB Serial/JTAG` 控制器，不属于 XRUSB 的 `DeviceCore`。发送字节写入硬件 FIFO 后才从 `WriteQueue` 消费（`PopWithWriter`），接收字节通过 `ReadQueue` 写入 `ReadPort`。

## Linux 路径

`LinuxUART` 的上下文已经不再是 ISR 和 DMA，而是线程。它打开 `/dev/tty*`（也可按 USB VID/PID、接口名称或序列号匹配设备）并配置 `termios`；一个 I/O 线程负责打开、关闭、重连、配置和收发，端口回调只唤醒该线程。写请求在数据被 Linux 内核接收时完成。这里不再追求中断级时延，而更关心设备发现、串口参数配置和用户态阻塞语义。

## 这套设计在意什么

把不同平台的实现摊开来看，重点其实一直没变：接收侧要尽量做到“硬件持续喂数据，软件按需取”；发送侧要尽量做到“当前块还在发，下一块已经准备好”；完成通知要尽量短路径地推进下一次传输。这三点决定了驱动在热路径上的实际表现。
