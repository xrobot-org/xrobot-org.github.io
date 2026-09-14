---
id: core-pipe
title: Pipe — Unidirectional Pipe
sidebar_position: 12
---

# Pipe — Unidirectional Pipe

`Pipe` connects a `WritePort` and a `ReadPort` through the **same lock-free byte queue** into a **unidirectional** data channel: bytes written by the writer can be read directly by the reader, with no intermediate copy between ports (there is only a single copy into the shared queue). This class is suitable for efficient data forwarding and loopback tests between threads/tasks/ISRs and tasks.

---

## Feature Overview

- **Zero extra copies**: writer writes → goes directly into the shared queue → reader takes from the same queue.
- **ISR-friendly**: read-side progress is done via `shared-queue data notification` and can be triggered in either ISR or task context.
- **Consistent semantics with `ReadPort`/`WritePort`**: completion modes such as blocking/callback/polling are uniformly controlled by `Operation`.

---

## Public API

```cpp
class Pipe {
public:
  // Construct with the capacity (bytes) of the shared data queue
  Pipe(size_t buffer_size);

  // Non-copyable / non-assignable
  Pipe(const Pipe&) = delete;
  Pipe& operator=(const Pipe&) = delete;
  ~Pipe();

  // Port access
  ReadPort&  GetReadPort();
  WritePort& GetWritePort();
};
```

- `buffer_size`: total capacity of the shared queue (in bytes) used to hold written data. Immutable after creation.
- In the current implementation, the object is actually constructed as `ReadPort(0)` plus `WritePort(1, buffer_size)`:
  - the read side does not own an independent data-queue capacity of its own;
  - the write side uses a fixed metadata queue depth of `1`, while the shared byte-queue capacity is `buffer_size`.
- `Pipe` does not directly expose methods like `Size()` / `Reset()` - use the corresponding port interfaces via `GetReadPort()` / `GetWritePort()`.

---

## Usage

Use `Pipe` as an in-memory pipe with a built-in "loopback driver": writing triggers `WriteFun`, which then advances the read side to serve pending reads.

```cpp
LibXR::Pipe pipe(256);

auto& r = pipe.GetReadPort();
auto& w = pipe.GetWritePort();

// Typical: start a read first (may become PENDING), then write to drive it forward.
uint8_t buf[16];
LibXR::ReadOperation rop(status_or_cb_or_sem);
LibXR::WriteOperation wop(status_or_cb_or_sem);

r({buf, sizeof(buf)}, rop);           // may pend
w({some_data, some_len}, wop);        // writing notifies the reader to check the shared queue
```


Write completion means the bytes entered the shared queue; it does not wait for the reader to consume them. A full queue returns `FULL`.
