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
specific differences are hidden behind `ReadPort / WritePort` and the completion model. The usual
send path first pushes data and operation info into the port, then the driver loads the current
block when hardware becomes writable. The receive path works in the opposite direction: bytes come
from DMA, FIFO, or a system call, then enter the `ReadPort` queue, and finally
`ProcessPendingReads(...)` satisfies pending reads.

That is also why, in many implementations, `ReadFun(...)` does not actively read hardware. It only
returns `PENDING`. Real progress happens later in DMA interrupt, UART interrupt, or worker threads.

## MCU path

`STM32UART` and `CH32UART` are the typical MCU implementations. Their common shape is clear:
permanent DMA on the receive side, double buffering on the transmit side, user-facing reads and
writes going through `ReadPort / WritePort`, and completion driven by DMA-complete interrupts or
idle events.

The key on the receive side is not merely "DMA is enabled". DMA stays active continuously. ISR only
needs to compare the current write pointer with the last processed position, push the new byte range
into the software queue, and call `ProcessPendingReads(true)`. That removes the extra beat of
"stopping and rearming" the receiver. Software only chases the hardware write pointer.

The transmit side has a different rhythm. `STM32UART` and `CH32UART` do not start a new DMA
transfer directly on every `Write(...)`. They first check which buffer is available between active
and pending: if DMA is idle, write to the active buffer and start immediately; if DMA is busy, write
the next data into the pending buffer and switch to it after the transfer-complete interrupt. The
important part is not double buffering by itself, but the ordering inside the completion interrupt:
continue the next transfer first, then finalize the previous operation state. Reverse that order and
the gap between packets grows immediately on high-frequency paths.

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

In `LinuxUART`, the advancing context is no longer ISR or DMA. It is threads. The implementation
opens `/dev/tty*`, configures `termios`, and creates dedicated RX and TX threads. The public
interface stays unchanged, but the internal progress model becomes blocking `read(...)` and
`write(...)` loops. Here the focus is less on interrupt-level latency and more on device discovery,
serial parameter handling, and user-space blocking semantics.

## What this design optimizes for

Across platforms, the priorities stay the same:

- on receive, keep hardware feeding data continuously while software pulls as needed
- on transmit, keep the next block prepared while the current one is still being sent
- keep completion short so the next transfer can start quickly

If those three conditions hold, the driver is usually in good shape.
