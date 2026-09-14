---
id: adv-coding-drv-dbf
title: Double Buffering
sidebar_position: 1
---

# Double Buffering

Double buffering is mainly used for communication peripherals. At any given time, only one buffer is transmitting or receiving, while the other is being copied or written. The pre-write/post-read mechanism provided by double buffering can greatly increase interface throughput, even approaching the interface’s theoretical maximum bandwidth.

LibXR provides two primary double-buffering mechanisms:

1. Driver-embedded double buffering for low-speed interfaces, used primarily in UART. Data reads and writes go through a FIFO, resulting in two copies.
2. Double buffering for high-speed interfaces, used mainly for USB and SPI. Users can access the underlying buffers directly, enabling zero-copy transmission.

On UART transmit paths, port completion and DMA completion are separate. A `WriteOperation` may finish once the backend has copied the entire request into stable active/pending storage, while DMA and wire transmission continue. The transfer-complete ISR still switches buffers and keeps the hardware stream moving.

## 基本原理

Take UART as an example (actual reception may use circular DMA; not discussed here):

```mermaid
stateDiagram-v2
  [*] --> RUN

  state RUN {
    %% ================= TX (Transmit) =================
    [*] --> TX_Awrite_Bsend
    state "TX: A write / B send" as TX_Awrite_Bsend
    state "TX: B write / A send" as TX_Bwrite_Asend

    TX_Awrite_Bsend --> TX_Bwrite_Asend: TX complete (switch to A send, B idle → write)
    TX_Bwrite_Asend --> TX_Awrite_Bsend: TX complete (switch to B send, A idle → write)

    --
    %% ================= RX (Receive/Read) =================
    [*] --> RX_Arecv_Bread
    state "RX: A receive / B for app read" as RX_Arecv_Bread
    state "RX: B receive / A for app read" as RX_Brecv_Aread

    RX_Arecv_Bread --> RX_Brecv_Aread: A full/idle interrupt (hand off A to app, switch B to receive)
    RX_Brecv_Aread --> RX_Arecv_Bread: B full/idle interrupt (hand off B to app, switch A to receive)
  }
```
