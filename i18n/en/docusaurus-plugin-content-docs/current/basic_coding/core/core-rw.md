---
id: core-rw
title: IO Read/Write Abstraction
sidebar_position: 8
---

# IO Read/Write Abstraction

This module defines the generic `ReadPort` and `WritePort` interface classes for cross-platform encapsulation of various I/O behaviors such as asynchronous, blocking, and polling. It binds completion feedback mechanisms via the `Operation` model. To adapt to different underlying drivers, simply implement the corresponding read/write functions and assign them to the port object to gain full asynchronous I/O capability.

The current mainline implementation of `ReadPort`, `WritePort`, and `WritePort::Stream` mainly uses atomic state machines and lock-free structures such as `SPSCQueue` for the **software-side queuing and completion handoff**. That should not be over-expanded into a claim that the entire read/write path can never involve system calls; actual syscalls, DMA starts, or hardware accesses still depend on the concrete RX producer and `WriteFun` backend.

> Note: the default constructors of `ReadPort` / `WritePort` create internal lock-free queues and buffers (one-time allocation/initialization during construction) to hold data and write metadata.

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
ReadPort(size_t buffer_size = 128);
```

Construction allocates the receive byte queue. A zero capacity leaves the port without a receive queue.

### Submitting a read

```cpp
ErrorCode operator()(RawData data, ReadOperation &op, bool in_isr = false);
```

A positive-length request copies into `data` only after the complete length is available. A zero-length request waits for the queue to become nonempty and consumes no bytes.

For non-`BLOCK`, `OK` means admission; completion can be inline or deferred. For `BLOCK`, `OK` means the data handoff completed. A request larger than capacity returns `SIZE_ERR`; occupied request processing returns `BUSY`.

Keep the destination and callback/polling objects alive until completion. A `BLOCK` destination remains valid through function return.

### Queries

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Readable() const;
```

Unbound ports report zero sizes. `Readable()` means a receive queue exists; it does not mean bytes are currently available.

### Backend RX production

`ReadPort` no longer binds the old `ReadFun`. A backend that has received bytes through DMA, FIFO, or another source writes them through a short-lived producer:

```cpp
auto queue = read_port.GetReadQueue(in_isr);
queue.PushBatch(data, size);
queue.Publish();
```

`Publish()` advances pending reads and can run completion callbacks in the current context. Call it at the end of every production scope; destruction does not publish automatically. Backends serialize producers for one port. A Pipe reader borrows the writer's queue and does not use this ordinary backend-production API.

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

`queue_size` counts queued write requests and `buffer_size` counts payload bytes. Ordinary backends use a positive request capacity. Pipe uses `queue_size == 0` admission-completion mode.

### Binding backend progress

```cpp
WritePort &operator=(WriteFun fun);
```

`WriteFun` is:

```cpp
using WriteFun = void (*)(WritePort& port, bool in_isr);
```

It is a progress notification and returns no completion result. Ordinary backends consume released requests through `GetWriteQueue()`.

### Submitting a write

```cpp
ErrorCode operator()(ConstRawData data, WriteOperation &op, bool in_isr = false);
```

Admission copies the entire source into the internal byte queue, so caller storage can be reused after return.

- non-`BLOCK` `OK` means admitted;
- insufficient request or byte capacity returns `FULL`;
- producer-state conflict returns `BUSY`;
- an unavailable port returns `NOT_SUPPORT`;
- requests are not partially admitted;
- zero-length writes succeed after capability checking without notifying the backend.

Write completion means that the backend accepted the entire request, not that physical transmission ended. A UART backend can complete the `WriteOperation` after copying bytes into active/pending DMA storage while DMA and the wire keep running.

### Queries

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Writable() const;
```

`Writable()` means byte storage exists and `WriteFun` is bound. It does not reserve a request slot or byte capacity for the next call.

### Backend consumption

Ordinary backends obtain the released front through:

```cpp
auto queue = write_port.GetWriteQueue(in_isr);
```

They advance one request with `PopAll()`, `PopWithWriter()`, or `FailFront()`. Destruction of `WriteQueue` settles progress; completion fires only after the full request has been consumed.

Backend consumption, settlement, and the completion callbacks it triggers must be serialized. Do not keep a raw pointer into the port queue for later DMA access; move accepted bytes into storage the backend can retain before the dequeue method returns.

## STDIO Interface

LibXR provides a global `STDIO` interface that can be bound to `ReadPort` / `WritePort` instances and used with the `Printf(...)` function to output debug information.

```cpp
LibXR::STDIO::write_ = &uart.write_port_;
LibXR::STDIO::Printf<"Hello, %d">(123);
```

Implementation note: the current `Printf` path uses the shared STDIO write session and an internal mutex for formatting/serialization, and chooses between the normal write path and the stream/bulk write path depending on whether `STDIO::write_stream_` is configured.

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

`WritePort::Stream` provides a chained batch-write capability similar to C++ streams, making it suitable for high-throughput, large-packet, or consecutive multi-block write scenarios. Its goal is to **lock the port resource once, write data in batches, and reduce queue pressure and fragmentation**.

### Key Features

- **Stream-style chained writing**: Supports multiple `<<` operations to append multiple segments into the write buffer.
- **Automatic Batch Submission**: Unsubmitted data is automatically committed upon destruction, and you can also call `Commit()` manually at any time.

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
    ErrorCode Commit();
};
```

Semantics highlights:

- `Stream(WritePort*, WriteOperation)`: tries to acquire the write lock and checks that the write-metadata queue has at least 1 free slot; if it cannot lock or the queue is full, the stream starts in an unlocked state.
- `operator<<`: if unlocked, it retries acquiring the write lock; if it still fails, this `<<` writes nothing. If locked and there is enough capacity (`size_ + data.size_ <= cap_`), it appends data into the write buffer; if capacity would be exceeded, no partial write is performed (the segment is ignored).
- `Commit()`: submits the currently accumulated data as a single write request and triggers the underlying write; then resets `size_` to 0. After committing, it refreshes available capacity based on the queue free slots, and may release the write lock when needed.
- `~Stream()`: if there is uncommitted data, it is committed automatically, then the write lock is released.

---

`ReadPort` and `WritePort` are the core interfaces of the LibXR I/O abstraction layer. They provide unified data buffering and completion feedback mechanisms, suitable for data stream scenarios such as UART, network, and file systems.

## Current implementation boundaries

- `ReadPort(buffer_size)` creates its internal `SPSCQueue<uint8_t>` only when `buffer_size > 0`; with a zero capacity, the current implementation allows `queue_data_ == nullptr`, so APIs such as `Size()` / `EmptySize()` must not be used blindly.
- `WritePort(queue_size, buffer_size)` currently constructs `queue_info_` and `queue_data_` separately; `queue_data_` is likewise allowed to be null when `buffer_size == 0`.
- The “thread-safe” claim for `ReadPort` / `WritePort` mainly describes the current software-side queue, busy-state, and completion-handoff logic. Whether the concrete RX producer and `WriteFun` path are re-entrant or ISR-safe still depends on the backend implementation.
