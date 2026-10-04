---
id: core-rw
title: IO Read/Write Abstraction
sidebar_position: 10
---

# IO Read/Write Abstraction

`libxr_rw.hpp` defines the generic `ReadPort` and `WritePort`, which wrap asynchronous, blocking and polling I/O behind one interface; the completion feedback is selected by `Operation`. This page describes the interface for calling the ports; the driver-backend side is summarized in [Driver backend interface](#driver-backend-interface) below.

> Note: `ReadPort` / `WritePort` allocate their internal queues once at construction and do not free them on destruction.

## Core Types

### ReadPort / WritePort

`ReadPort` and `WritePort` encapsulate the invocation process, buffer management, and synchronization mechanisms for read/write operations. Each call is accompanied by an `Operation` instance to explicitly specify the desired completion feedback behavior (callback, blocking, polling, or ignore).

### ReadOperation / WriteOperation

```cpp
typedef Operation<ErrorCode> ReadOperation;
typedef Operation<ErrorCode> WriteOperation;
```

These represent asynchronous I/O operations with a completion response behavior. Callbacks, semaphores, or polling status variables can be passed via the constructor - see the `core-op` page for details.

## ReadPort Interface

### Construction

```cpp
explicit ReadPort(size_t buffer_size = 128);
```

Creates a receive queue of `buffer_size` bytes (default 128). With 0 no queue is allocated and the port is not readable.

### Submitting a read

```cpp
ErrorCode operator()(RawData data, ReadOperation &op, bool in_isr = false);
```

A positive-length request copies into `data` only after the complete length is available. A zero-length request waits for the queue to become nonempty and consumes no bytes.

For non-`BLOCK`, `OK` means admission; completion can be inline or deferred. For `BLOCK`, `OK` means the data handoff completed. A request larger than capacity returns `SIZE_ERR`; occupied request processing returns `BUSY`; an unbound port returns `NOT_SUPPORT`; a `BLOCK` read that times out returns `TIMEOUT`.

`BLOCK` reads are thread-only; until one returns, the same port must not start another read or call `ClearQueuedData()`, nor overlap an outstanding non-`BLOCK` read.

Keep the destination and callback/polling objects alive until completion. A `BLOCK` destination remains valid through function return.

### Queries

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Readable() const;
```

The first three return queued bytes, free bytes and total capacity, all 0 when no queue is bound. `Readable()` means a receive queue exists; it does not mean bytes are currently available.

### Clearing queued bytes

```cpp
ErrorCode ClearQueuedData(bool in_isr = false);
```

This discards already queued receive bytes but does not cancel a pending read. It returns `BUSY` while a request or dequeue path is active. Success also notifies the receive side that space became available, allowing a backpressured backend to resume.

## WritePort Interface

### Construction

```cpp
WritePort(size_t queue_size = 3, size_t buffer_size = 128);
```

`queue_size` counts queued write requests and `buffer_size` counts payload bytes. A port with `queue_size == 0` is used by [Pipe](./core-pipe.md).

### Submitting a write

```cpp
ErrorCode operator()(ConstRawData data, WriteOperation &op, bool in_isr = false);
```

Admission copies the entire source into the internal byte queue, so caller storage can be reused after return.

- non-`BLOCK` `OK` means admitted; a `BLOCK` write returns the completion result or `TIMEOUT`, and queued data is still sent after a timeout (see [BLOCK Timeout and Completion Handoff](../../adv_coding/driver/block_timeout_semantics.md));
- insufficient request or byte capacity returns `FULL`;
- producer-state conflict returns `BUSY`;
- an unavailable port returns `NOT_SUPPORT`;
- requests are not partially admitted;
- zero-length writes succeed after capability checking without notifying the backend;
- `BLOCK` writes are thread-only; `BLOCK` and non-`BLOCK` writes on one port must not overlap.

Write completion means that the backend accepted the entire request, not that physical transmission ended. A UART backend can complete the `WriteOperation` after copying bytes into active/pending DMA storage while DMA and the wire keep running.

### Queries

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Writable() const;
```

`Size()`, `EmptySize()` and `Capacity()` return queued bytes (including uncommitted Stream appends), free bytes and total capacity of the byte queue. `Writable()` means byte storage exists and the driver has bound its progress function `WriteFun`. It does not reserve a request slot or byte capacity for the next call.

## Driver backend interface

A driver writes received bytes with `ReadPort::GetReadQueue()` and calls `Publish()`, binds a `WriteFun` to the `WritePort`, and takes pending data with `WritePort::GetWriteQueue()` from `WriteFun` or its transmit-complete interrupt. The call order, the concurrency rules and an STM32 UART example are in sections 3.1 and 4.2 of [I/O Completion Semantics and Port State Machines](../../adv_coding/core/rw_semantics.md); the overall structure of a UART driver is in [UART Driver Design](../../adv_coding/driver/uart_driver.md).

## STDIO Interface

LibXR provides a global `STDIO`; once `ReadPort` / `WritePort` are bound, `Printf` or `Print` writes debug output.

```cpp
LibXR::STDIO::write_ = uart.write_port_;
LibXR::STDIO::Printf<"Hello, %d">(123);
LibXR::STDIO::Print<"Hello, {}">(123);
```

`Printf` / `Print` format and write to `STDIO::write_` under an internal mutex and must be called from threads. They return the number of bytes committed; output beyond the write port's current free space is truncated. They return -1 when `write_` is unset or not writable, or when formatting or submission fails. If `STDIO::write_stream_` is set, output goes to that stream; otherwise each call uses a temporary `WritePort::Stream`.

## Usage Examples

For data size of 0, Write will return success directly, and Read will complete once any data is readable.

```cpp
// Blocking write to UART, timeout set to 100ms (default is infinite wait)
WriteOperation op_block(sem, 100);
uart.Write("Hello", op_block);

// Asynchronous read with callback
ReadOperation op_cb(callback);
uart.Read(buffer, op_cb);
```

---

## WritePort::Stream Batch Write Interface

`WritePort::Stream` merges several pieces of data into one write request, for writing multiple blocks in a row.

### Key Features

- Repeated `<<` or `Write()` calls append to one batch.
- `Commit()` submits the batch; destruction submits it automatically.

### Example Usage

```cpp
WriteOperation op;
// Typical batch write using stream interface
{
    WritePort::Stream s(&uart_port, op);
    s << data1 << data2 << data3;
    // s.Commit(); // Optional, auto-committed on destruction
}
```

### Interface Specification

```cpp
class WritePort::Stream {
public:
    Stream(WritePort* port, WriteOperation op);
    ~Stream();
    Stream& operator<<(const ConstRawData& data);
    [[nodiscard]] ErrorCode Write(ConstRawData data);
    [[nodiscard]] ErrorCode Write(std::string_view text);
    [[nodiscard]] ErrorCode Commit();
    [[nodiscard]] ErrorCode Acquire();
    [[nodiscard]] size_t EmptySize() const;
};
```

Semantics highlights:

- The constructor tries to acquire the port and does not report failure; call `Acquire()` to check or retry. `Acquire()` returns `OK` when acquired or already owned, `PTR_NULL` for a null port, `NOT_SUPPORT` when not writable, `BUSY` when occupied, and `FULL` when no request slot is free.
- `Write()` appends data and reports the result: `FULL` when space is insufficient, appending nothing from this call and keeping earlier appends. `<<` does the same without reporting failures.
- `Commit()` submits the batch and releases the port; a later `<<` / `Write()` re-acquires it and starts a new batch. An empty batch only completes non-BLOCK notifications.
- If the stream still owns the port on destruction, it behaves like `Commit()` and discards the result.
- Thread-only; completion notifications use `in_isr = false`.

---

`ReadPort` and `WritePort` are the core interfaces of the LibXR I/O abstraction layer. They provide unified data buffering and completion feedback mechanisms, suitable for data stream scenarios such as UART, network, and file systems.
