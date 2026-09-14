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

At the top level, UART drivers expose `SetConfig(...)`, `Write(...)`, and `Read(...)`. The platform-
specific differences are hidden behind `ReadPort / WritePort` and the completion model. The send
path first queues data and operation metadata, then the backend uses `GetWriteQueue()` to move
released bytes into storage it can retain. The receive path works in the opposite direction: bytes
come from DMA, FIFO, or a system call, enter through `GetReadQueue()`, and are then `Publish()`ed so
the port can satisfy pending reads.

The port/backend boundary therefore carries progress notifications and short-lived queue access,
not the old `ReadFun` / `PENDING` return protocol. Real hardware progress still happens in DMA
interrupts, UART interrupts, or the Linux I/O thread.

## MCU path

`STM32UART` and `CH32UART` are the typical MCU implementations. Their common shape is clear:
permanent DMA on the receive side, double buffering on the transmit side, and user-facing reads and
writes going through `ReadPort / WritePort`. An application write can complete once the backend has
accepted the whole request into stable storage; DMA completion later switches buffers and advances
physical transmission.

The key on the receive side is not merely "DMA is enabled". DMA stays active continuously. ISR only
needs to compare the current write pointer with the last processed position, push the new byte range
through `GetReadQueue(true)`, and call `Publish()`. That removes the extra beat of "stopping and
rearming" the receiver. Software only chases the hardware write pointer.

The transmit side has a different rhythm. `STM32UART` and `CH32UART` do not start a new DMA
transfer directly on every `Write(...)`. They first check which buffer is available between active
and pending: if DMA is idle, write to the active buffer and start immediately; if DMA is busy, write
the next data into the pending buffer and switch to it after the transfer-complete interrupt. The
interrupt still needs to continue the pending transfer before doing the remaining hardware
bookkeeping. The application `WriteOperation` may already have completed when the backend accepted
the bytes, so port completion and wire completion are separate points.

## ESP32 path

`ESP32UART` keeps the same port abstraction but chooses its backend according to chip capability.
When GDMA exists it uses DMA; otherwise it falls back to FIFO plus UART interrupts. Regardless of the
backend, the transmit side still keeps active/pending double slots, and the receive side still
follows the same rule: push bytes into the port queue first, then process pending reads.

`ESP32CDCJtag` is also worth calling out. It still derives from `LibXR::UART`, but its backend is
the `USB Serial/JTAG` controller rather than a classic UART peripheral. It keeps the UART
abstraction, but it is not part of the generic XRUSB `DeviceCore`. From the driver-design point of
view the same rule still applies: prepare the next transmit block, push received bytes into
`ReadPort`, and let the backend transport differ underneath.

## Linux path

In `LinuxUART`, the advancing context is no longer ISR or DMA. It is a thread. The implementation
opens `/dev/tty*` with nonblocking I/O, configures `termios`, and uses one `io_thread_` with `poll`
to advance receive, transmit, and configuration events. `eventfd` wakes the service loop, and
transmit progress can use `writev`. The public interface stays unchanged; the timing model now also
includes kernel buffering and scheduler latency.

## What this design optimizes for

Across platforms, the priorities stay the same:

- on receive, keep hardware feeding data continuously while software pulls as needed
- on transmit, keep the next block prepared while the current one is still being sent
- keep completion short so the next transfer can start quickly

If those three conditions hold, the driver is usually in good shape.
