---
id: adv-coding-drv-uart-driver
title: UART Driver Design
sidebar_position: 2
---

# UART Driver Design

`LibXR::UART` presents one public interface; platform differences lie in the transmit path, the receive path and the context that advances them. Bare-metal MCUs, RTOSes and Linux user space use the same interface. What differs is how bytes enter `ReadPort` and how pending transmit data is handed from `WritePort` to the hardware.

## Unified abstraction

At the top level, UART drivers expose `SetConfig(...)`, `Write(...)`, and `Read(...)`; platform differences sit in the interface between the driver and `ReadPort / WritePort`. On the send path, data and the request are copied into `WritePort`, which notifies the driver through `WriteFun`; when the hardware can transmit, the driver takes the front request with `GetWriteQueue(in_isr)` and copies it into its own buffer or the hardware FIFO. The receive path works the other way: after DMA, a FIFO, or a system call delivers bytes, the driver obtains the producer interface with `GetReadQueue(in_isr)`, writes the new bytes with `PushBatch`, and calls `Publish()` once, which lets `ReadPort` satisfy a pending read.

The driver does not handle individual read requests; receive progress happens in the DMA interrupt, the UART interrupt, or an I/O thread.

## MCU path

`STM32UART` and `CH32UART` are the typical MCU implementations: permanent DMA on the receive side, double buffering on the transmit side, and user-facing reads and writes going through `ReadPort / WritePort`.

On the receive side, DMA keeps running. The ISR computes the new byte range from the current write pointer and the last position, writes it with `PushBatch` into the receive queue obtained from `GetReadQueue(true)`, and calls `Publish()`. The receive path therefore has no gap for stopping and restarting DMA; software only follows the hardware write pointer.

On the transmit side, each write first checks the active and pending buffers: when DMA is idle, the data is written into the active buffer and DMA starts immediately; when DMA is busy, the data is written into the pending buffer, and the transmit-complete interrupt switches to it. A write request completes when its data is copied into the active or pending buffer, so a `BLOCK` write may return while the data is still being sent. The transmit-complete interrupt first switches to the pending buffer and starts the next DMA transfer, then takes the next request from the queue into the new pending buffer, which keeps the gap between transfers short.

## ESP32 path

`ESP32UART` keeps the same port abstraction and chooses its backend according to chip capability: with GDMA it uses DMA, otherwise FIFO plus UART interrupts. On the GDMA path the transmit side uses active/pending double buffering and a request completes when it is copied into a transmit half; on the FIFO path `PopWithWriter` consumes each request by the number of bytes the hardware FIFO accepted, without staging a second block. On both paths received bytes go into the `ReadPort` queue before pending reads are processed.

`ESP32CDCJtag` also derives from `LibXR::UART`. Its backend is the `USB Serial/JTAG` controller built into the ESP32-C3 and ESP32-C6, and its code is in `driver/esp/esp_cdc_jtag.*`. It reads and writes the controller's hardware FIFO directly, without the XRUSB `DeviceCore` and `EndpointPool`. Transmit bytes are consumed from `WriteQueue` (`PopWithWriter`) after the hardware FIFO accepts them, and received bytes enter `ReadPort` through `ReadQueue`.

The constructor takes the receive queue capacity, the transmit queue capacity, the write request queue length and the initial configuration; the values in the example below are the defaults:

```cpp
LibXR::ESP32CDCJtag usb_jtag_uart(
    1024,
    512,
    5,
    {115200, LibXR::UART::Parity::NO_PARITY, 8, 1});
```

- It is compiled only for ESP32-C3 and ESP32-C6.
- It supports only 8 data bits, no parity and 1 stop bit; `SetConfig()` returns `ARG_ERR` for any other configuration.
- The ESP-IDF primary console uses the same controller; with `CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG=y` compilation fails, so the option is disabled in menuconfig before `ESP32CDCJtag` is used.

## Linux path

`LinuxUART` is advanced by a thread. It opens `/dev/tty*` in nonblocking mode (or matches a device by USB VID/PID, interface name, or serial number) and configures `termios`; one I/O thread (`io_thread_`) uses `poll` to handle open, close, reconnect, configuration, and transfer, port callbacks only wake that thread through an `eventfd`, and transmit data is written with `writev`. A write request completes when the Linux kernel accepts the data. The public interface stays unchanged and hardware events become kernel file-descriptor events; the considerations are device discovery, serial parameter handling, kernel buffering, and scheduler latency.

## Design goals

The implementations on all platforms share three goals: on receive, the hardware keeps writing data and software takes it as needed; on transmit, the next block is prepared while the current one is being sent; and completion starts the next transfer by the shortest path. These three points determine how a driver performs on high-frequency paths.
