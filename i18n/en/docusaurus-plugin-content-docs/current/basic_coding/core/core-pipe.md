---
id: core-pipe
title: Pipe — Unidirectional Pipe
sidebar_position: 12
---

# Pipe — Unidirectional Pipe

`Pipe` connects a `WritePort` and a `ReadPort` through one SPSC byte queue to form a one-way channel: the writer copies data into the queue and the reader copies it from the same queue into its buffer, with no intermediate buffer between the two ports. It is used for data forwarding and loopback tests between threads, tasks or ISRs and tasks.

---

## Feature Overview

- The write port owns a queue of `buffer_size` bytes; the read port reads that queue directly.
- A write completes once its data is queued and the reader is notified, without waiting for the data to be read; a pending read is satisfied by the write and may complete inside the write call.
- Completion modes on both ends are those of `ReadPort` / `WritePort`, selected by `Operation`.

---

## Public API

```cpp
class Pipe {
public:
  // Construct with the capacity (bytes) of the shared data queue
  explicit Pipe(size_t buffer_size);

  // Non-copyable / non-assignable
  Pipe(const Pipe&) = delete;
  Pipe& operator=(const Pipe&) = delete;
  ~Pipe();

  // Port access
  ReadPort&  GetReadPort();
  WritePort& GetWritePort();
};
```

- `buffer_size`: shared queue capacity in bytes; must be greater than 0 and cannot change.
- `Pipe` has no `Size()` or similar methods; use the port interfaces via `GetReadPort()` / `GetWritePort()`.
- The destructor neither cancels requests nor frees the queue storage.

---

## Usage

`Pipe` works as an in-memory pipe with a built-in loopback driver: a write notifies the read side, which satisfies a pending read.

```cpp
LibXR::Pipe pipe(256);

auto& r = pipe.GetReadPort();
auto& w = pipe.GetWritePort();

std::atomic<LibXR::ReadOperation::OperationPollingStatus> rs{
    LibXR::ReadOperation::OperationPollingStatus::READY};
std::atomic<LibXR::WriteOperation::OperationPollingStatus> ws{
    LibXR::WriteOperation::OperationPollingStatus::READY};
LibXR::ReadOperation rop(rs);
LibXR::WriteOperation wop(ws);

uint8_t buf[16];
const uint8_t data[16] = {};

r({buf, sizeof(buf)}, rop);    // not enough data yet: the read pends, rs becomes RUNNING
w({data, sizeof(data)}, wop);  // the write completes the read: rs and ws become DONE
```

> `Pipe` write completion means the bytes entered the shared queue; it does not wait for the reader to consume them. When the queue lacks space, the write returns `FULL`.
