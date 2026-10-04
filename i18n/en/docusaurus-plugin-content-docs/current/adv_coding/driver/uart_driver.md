---
id: adv-coding-drv-uart-driver
title: UART Driver Design
sidebar_position: 2
---

# UART Driver Design

`LibXR::UART` presents one public interface. Platform differences are pushed into the transmit path,
receive path, and the context that advances them. Whether the target is bare-metal MCU, RTOS, or
Linux user space, the abstraction is the same. What changes is how bytes enter `ReadPort`, and how
pending transmit data is pushed from `WritePort` into hardware.

## Unified abstraction

At the top level, UART drivers expose `SetConfig(...)`, `Write(...)`, and `Read(...)`; platform
differences sit in the interface between the driver and `ReadPort / WritePort`. On the send path,
data and the request are copied into `WritePort`, which notifies the driver through `WriteFun`; when
the hardware can transmit, the driver takes the front request with `GetWriteQueue(in_isr)` and
copies it into its own buffer or the hardware FIFO. The receive path works the other way: after DMA,
a FIFO, or a system call delivers bytes, the driver obtains the producer interface with
`GetReadQueue(in_isr)`, writes the new bytes with `PushBatch`, and calls `Publish()` once, which lets
`ReadPort` satisfy a pending read.

The driver does not handle individual read requests; receive progress happens in the DMA interrupt,
the UART interrupt, or an I/O thread.

## MCU path

`STM32UART` and `CH32UART` are the typical MCU implementations. Their common shape is clear:
permanent DMA on the receive side, double buffering on the transmit side, and user-facing reads and
writes going through `ReadPort / WritePort`.

On the receive side, DMA stays active continuously. ISR only needs to compare the current write
pointer with the last processed position, write the new byte range with `PushBatch` into the queue
from `GetReadQueue(true)`, and call `Publish()`. That removes the extra beat of
"stopping and rearming" the receiver. Software only chases the hardware write pointer.

The transmit side has a different rhythm. `STM32UART` and `CH32UART` do not start a new DMA
transfer directly on every `Write(...)`. They first check which buffer is available between active
and pending: if DMA is idle, write to the active buffer and start immediately; if DMA is busy, write
the next data into the pending buffer and switch to it after the transfer-complete interrupt. A
write request completes when its data is copied into the active or pending buffer, so a `BLOCK`
write may return while the data is still being sent. The transfer-complete interrupt first switches
to the pending buffer and starts the next DMA transfer, then takes the next request from the queue
into the new pending buffer, which keeps the gap between transfers short.

## ESP32 path

`ESP32UART` keeps the same port abstraction but chooses its backend according to chip capability.
When GDMA exists it uses DMA; otherwise it falls back to FIFO plus UART interrupts. On the GDMA path
the transmit side uses active/pending double buffering and a request completes when it is copied
into a transmit half; on the FIFO path `PopWithWriter` consumes each request by the number of bytes
the hardware FIFO accepted, without staging a second block. On both paths received bytes go into the
`ReadPort` queue before pending reads are processed.

`ESP32CDCJtag` also derives from `LibXR::UART`. Its backend is the ESP32 `USB Serial/JTAG`
controller, and it is not part of the XRUSB `DeviceCore`. Transmit bytes are consumed from
`WriteQueue` (`PopWithWriter`) after the hardware FIFO accepts them, and received bytes enter
`ReadPort` through `ReadQueue`.

## Linux path

In `LinuxUART`, progress is driven by a thread instead of ISR or DMA. The implementation opens
`/dev/tty*` in nonblocking mode (or matches a device by USB VID/PID, interface name, or serial
number) and configures `termios`; one I/O thread (`io_thread_`) uses `poll` to handle open, close,
reconnect, configuration, and transfer, port callbacks only wake that thread through an `eventfd`,
and transmit data is written with `writev`. A write request completes when the Linux kernel accepts
the data. The public interface stays unchanged; hardware events become kernel file-descriptor
events, and the focus is on device discovery, serial parameter handling, kernel buffering, and
scheduler latency.

## What this design optimizes for

Across platforms, the priorities stay the same:

- on receive, keep hardware feeding data continuously while software pulls as needed
- on transmit, keep the next block prepared while the current one is still being sent
- keep completion short so the next transfer can start quickly

If those three conditions hold, the driver is usually in good shape.
