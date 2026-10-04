---
id: adv-coding-core-rw-semantics
title: I/O Completion Semantics and Port State Machines
sidebar_position: 1
---

# I/O Completion Semantics and Port State Machines

For the basic APIs, see [I/O Read/Write Abstraction](/en/docs/basic_coding/core/core-rw) and
[Operation Model](/en/docs/basic_coding/core/core-op). This page describes the state machines of
`ReadPort` and `WritePort`, the interface between a driver backend and a port, and when read and
write requests complete.

## 1. Division of work

A read or write involves three parts:

- `Operation` describes how the caller is notified on completion: run a callback, post a semaphore,
  store a polling status, or send no notification.
- `ReadPort` / `WritePort` own the byte queue and the request state. They admit requests, decide
  completion, and hand off between timeout and completion.
- The driver backend (the backend below) produces and consumes bytes through short-lived interfaces
  provided by the port: `ReadQueue` to write received bytes, `WriteQueue` to take bytes for sending.

`WritePort` tells the backend that new data is available through `WriteFun`
(`void(WritePort& port, bool in_isr)`). The function has no return value and only reports progress;
the port settles the result of a request when the backend takes its data. On the read side, the
backend writes received data into the queue as it arrives.

## 2. `Operation` and `BLOCK`

`Operation` holds only the notification mode and the matching borrowed pointer (callback, semaphore
with timeout, or polling status). A write request's `Operation` is stored together with the request
length in an SPSC queue, so `operation.hpp` uses `static_assert` to require that it is trivially
copyable and trivially destructible. Request lifetime, waiter ownership, and timeout handoff are
managed by the port's state word.

In `BLOCK` mode, `UpdateStatus()` only posts the semaphore and carries no result. The port writes the
result into its own `block_result_` before posting, and the waiter reads it after waking. The timeout
given to `Operation(sem, timeout)` is a relative duration passed unchanged to `Semaphore::Wait`; the
default is `UINT32_MAX`.

A semaphore serves one `BLOCK` call at a time, until that call returns. The port treats a successful
`Wait` as completion of the request and reads `block_result_`. A semaphore used for `BLOCK`
therefore starts at 0 (the default of the `Semaphore` constructor) and is not shared with other
calls: an extra count in the semaphore makes `Wait` return at once, and the port handles it as the
completion of the current request.

## 3. `ReadPort`

### 3.1 Backend interface

`ReadPort(buffer_size = 128)` allocates an SPSC byte queue whose only producer is the backend; the
backend serializes its receive entry points, such as a DMA interrupt, a UART interrupt, or an I/O
thread. With `buffer_size` 0 the port allocates no queue, and a `Pipe` binds its shared queue at
construction.

For each receive, the backend:

1. Calls `GetReadQueue(in_isr)` to obtain a `ReadQueue`, a short-lived object that cannot be copied
   or moved.
2. Writes bytes with `PushBatch(data, size)` or `PushWithWriter(limit, writer)`, using only one of
   the two on one `ReadQueue`. `PushBatch` writes everything and returns `OK` when there is room, and
   returns `FULL` without a partial write otherwise. `PushWithWriter` passes up to two FIFO-ordered
   free spans to a callback, which returns the number of bytes it wrote. `EmptySize()` and
   `Capacity()` help decide the amount beforehand.
3. Calls `Publish()` once. The call is required even when no bytes were written; destroying a
   `ReadQueue` does not publish, and a development-build assertion catches a missing call.

When bytes were written, `Publish()` drives the pending read using the `in_isr` given to
`GetReadQueue`. The read may complete inside `Publish()`, and the completion callback of a
non-`BLOCK` read runs there inline.

The following excerpt is from `STM32UART::HandleRxData` in `driver/st/stm32_uart.cpp`. Receive DMA
runs continuously in circular mode; the backend derives the new bytes from the difference between
the DMA write position and the previous position, writes as many as the queue has room for, and
drops the rest:

```cpp
auto queue = _read_port.GetReadQueue(in_isr);
size_t accepted = std::min(first_size + second_size, queue.EmptySize());

if (accepted != 0U)
{
  const size_t first_accepted = std::min(first_size, accepted);
  if (first_accepted != 0U)
  {
    [[maybe_unused]] const auto push_batch_result =
        queue.PushBatch(rx_buf + last_pos, first_accepted);
    DEV_ASSERT_FROM_CALLBACK(push_batch_result == ErrorCode::OK, in_isr);
    accepted -= first_accepted;
  }
  // ... (the second span after the DMA buffer wraps is also written with PushBatch)
}

last_rx_pos_ = curr_pos == dma_size ? 0U : curr_pos;
queue.Publish();
```

When queue space becomes available, the port calls the virtual function
`OnReadQueueSpaceAvailable(bool in_isr)`: once after a positive-size read takes data from the queue
and before the completion notification, and once after a successful `ClearQueuedData`, even if the
queue was already empty. The default implementation does nothing. A backend whose reception pauses
when the queue is full overrides it in a derived class to resume reception, or to record a hint for
the current producer to recheck, serialized with its other receive entry points. For example,
`CDCUart` re-arms its OUT endpoint here when reception is paused; the circular DMA of `STM32UART`
runs continuously, and `STM32UART` does not override the function.

### 3.2 Read requests

`ReadPort` keeps at most one pending read request. On submission the port checks, in order: an
unbound queue returns `NOT_SUPPORT`; occupied request processing (a pending request already exists,
or another context is processing) returns `BUSY`; a positive size above the queue capacity returns
`SIZE_ERR`.

A positive-size request is copied in one piece only when the queue holds enough data; otherwise the
whole request stays pending until a later `Publish()`. A zero-size request completes when the queue
is nonempty, consumes no data, and may use a null address.

A request whose data is already available at submission completes within the call: a non-`BLOCK`
request notifies completion immediately, and a `BLOCK` request returns `OK` directly without posting
the semaphore. When data is short, a non-`BLOCK` request returns `OK` to mean admitted and completes
later in the backend's `Publish()`; a `BLOCK` request waits in the call for completion or timeout.

The completion callback of a non-`BLOCK` read runs after the port leaves the processing phase, so the
callback may submit the next non-`BLOCK` read. A `BLOCK` read is called only from a thread; until it
returns, the same port accepts no other read request or `ClearQueuedData` call, and the `BLOCK` read
does not overlap a live non-`BLOCK` read.

### 3.3 State

The `ReadPort` state is one 32-bit atomic: the low bits hold the request phase and the top bit is
`EVENT_BIT`.

| Phase | Meaning |
| --- | --- |
| `IDLE` | Available for a read request or `ClearQueuedData` |
| `CLAIMED` | One party has exclusive request or dequeue access: the submitter checking and copying data, `Publish()` checking the pending request, or `ClearQueuedData` clearing the queue |
| `PENDING` | A read request is pending and waiting for data |
| `CLAIMED_WITH_WAITER` | A `BLOCK` wait timed out while a processor held `CLAIMED`; the timed-out caller waits for the processor's handoff |
| `BLOCK_CLAIMED` | The completion side has claimed the `BLOCK` completion; the waiter returns the phase to `IDLE` after reading the result |

`EVENT_BIT` coexists with any phase and means that data has been published since the last
observation. Every `Publish()` that wrote bytes sets it; the bit counts no bytes, and several
publishes merge into one. It is cleared on entering `CLAIMED` from `IDLE` or `PENDING`. A submitter
that sees the bit before making its request pending rechecks the queue; when `Publish()` puts a
request with insufficient data back to `PENDING` and sees the bit, it runs another round. Data
published while the port is `CLAIMED` is therefore seen by a later check.

### 3.4 `BLOCK` timeout

When a `BLOCK` read times out, the port acts on the current phase:

- `PENDING`: the request is withdrawn, the phase returns to `IDLE`, and the call returns `TIMEOUT`.
  Queued data stays for the next read.
- `CLAIMED`: a processor (for example the backend's `Publish()`) is checking the request. The
  timed-out caller changes the phase to `CLAIMED_WITH_WAITER` and keeps waiting. If the processor
  finds enough data, it completes the request and the call returns `OK`; if data is still short, the
  processor withdraws the request and wakes the caller, and the call returns `TIMEOUT`.
- `BLOCK_CLAIMED`: the completion side has claimed it; the call waits for the semaphore handoff and
  returns the completion result.

In the last two cases the call returns only after the processor stops accessing the receive buffer,
which can exceed the timeout. In all three cases the read request has ended when the call returns.

### 3.5 Clearing the receive queue

`ClearQueuedData(in_isr)` discards the bytes already queued and then calls
`OnReadQueueSpaceAvailable`. It must first move from `IDLE` to `CLAIMED`, so it returns `BUSY` while
a request is pending or another context is dequeuing, and `NOT_SUPPORT` for an unbound queue.
Clearing only advances the consumer position and may run alongside backend writes; data arriving at
the same time may survive or be discarded.

## 4. `WritePort`

### 4.1 Write flow

`WritePort(queue_size = 3, buffer_size = 128)` allocates two queues: a request queue of
`queue_size` entries, each holding a request's length and `Operation`, and a data queue of
`buffer_size` bytes. With `queue_size` 0 no request queue is allocated and the port uses the
complete-on-admission mode of `Pipe`: a write completes as soon as its data is queued and the reader
is notified, and a `BLOCK` write does not wait. The port accepts writes once `WriteFun` is bound
(`Writable()`).

A write proceeds as follows:

1. If the port is not writable, the call returns `NOT_SUPPORT`. A zero-size write returns `OK` at
   once without notifying the backend, and a non-`BLOCK` request completes inline.
2. A CAS moves the phase from `IDLE` to `LOCKED`; on failure the call returns `BUSY` (for the
   exception see 4.4).
3. If the data queue lacks space or the request queue lacks a slot, the phase returns to `IDLE` and
   the call returns `FULL`, with no partial admission. A `BLOCK` write also returns `FULL` and does
   not wait for queue space.
4. The data is copied into the data queue and the request into the request queue; a single CAS then
   leaves `LOCKED` and increments the released-request count. A non-`BLOCK` request returns the phase
   to `IDLE`; a `BLOCK` request enters `BLOCK_WAITING`.
5. `WriteFun(port, in_isr)` is called in the caller's context. A non-`BLOCK` request then returns
   `OK`, meaning admitted; a `BLOCK` request waits for completion and returns its result.

After the call returns, the caller's source buffer can be reused.

`LOCKED` protects only the copy and publish steps. A non-`BLOCK` write has already returned the phase
to `IDLE` in step 4, so the next writer can enter while the previous one is still inside `WriteFun`.
`WriteFun` may therefore run concurrently in several threads, or in a thread and an ISR, and the
backend's own transmit-complete interrupt also advances transmission. The backend serializes these
entry points. `STM32UART` uses its `tx_service_` member of type `SerializedService`: `WriteFun` and
each UART interrupt submit events through `tx_service_.Invoke(...)`; the caller that claims
execution handles all events in turn, the other callers only record their events and return, and
the recorded events are handled before execution is released.

```cpp
void STM32UART::WriteFun(WritePort& port, bool in_isr)
{
  auto* uart = LibXR::ContainerOf(&port, &STM32UART::_write_port);

  uart->tx_service_.Invoke(TX_EVENT_WRITE, in_isr,
                           [uart](uint32_t events, bool owner_in_isr)
                           { uart->HandleTxService(events, owner_in_isr); });
}
```

### 4.2 Backend interface

The backend calls `GetWriteQueue(in_isr)` to obtain a `WriteQueue` for the front request; with no
released request the interface is empty (`Empty()` is true). `AvailableSize()` is the remaining size
of the front request, excluding later requests. Each `WriteQueue` permits at most one of the
following calls:

- `PopAll(dst)`: copies the whole front remainder to `dst`.
- `PopWithWriter(limit, writer)`: passes up to `limit` bytes (up to two spans) to a callback, which
  returns the number of bytes it accepted and may accept only part; 0 means no progress this time.
- `FailFront(reason)`: discards the front remainder and ends that request with the error code
  `reason`, for an unrecoverable error after a partial transfer.

Only bytes already copied into storage the backend can keep (a DMA buffer, a hardware FIFO, and so
on) count as accepted. Destroying the `WriteQueue` settles the progress: the port removes the front
request from the request queue and notifies completion only after all its bytes have been taken;
after a partial take the request stays, and the backend obtains a new interface later to continue.
The completion notification may run a user callback inline during destruction; a write submitted
from that callback calls `WriteFun` again, and the backend records that notification and rechecks
the queue. The event recording of `SerializedService` meets this requirement.

A write request completes when the backend accepts its data, at a storage boundary defined by the
backend. The following excerpt is from `STM32UART::FillTx`: when DMA is idle, the backend copies the
front request into the active half of the DMA double buffer, `queue` is destroyed at the closing
brace, and the request completes there; when DMA is busy, a block of the same structure copies the
request into the pending half. A `BLOCK` write may therefore return while its data is still in the
transmit buffer.

```cpp
size_t size = 0U;
{
  auto queue = _write_port.GetWriteQueue(in_isr);
  if (queue.Empty())
  {
    return;
  }
  size = queue.AvailableSize();
  DEV_ASSERT_FROM_CALLBACK(size <= dma_buff_tx_.Size(), in_isr);
  queue.PopAll(dma_buff_tx_.ActiveBuffer());
  dma_buff_tx_.SetActiveLength(size);
}
```

`STM32UART` constructs its `WritePort` with a data queue half the size of the DMA transmit buffer, so
a single request always fits into one half.

### 4.3 State

The `WritePort` state is also one 32-bit atomic: the low 3 bits hold the phase and the remaining bits
the released-request count, that is, the number of requests the backend may consume. While a
producer holds `LOCKED` to prepare a new request, the backend can therefore keep consuming requests
released earlier.

| Phase | Meaning |
| --- | --- |
| `IDLE` | Available for a new write; non-`BLOCK` requests may still be queued for the backend |
| `LOCKED` | A producer is copying data and preparing a request; also held while a `WritePort::Stream` owns producer access |
| `BLOCK_WAITING` | A `BLOCK` request is released and the caller is waiting for completion |
| `BLOCK_CLAIMED` | The backend has claimed completion of the `BLOCK` request and then writes the result and posts the semaphore; the caller returns the phase to `IDLE` after reading the result |
| `BLOCK_DETACHED` | The `BLOCK` call timed out and returned; the request is still queued |
| `BLOCK_RETIRE_WAITING` | A later `BLOCK` write is waiting for the timed-out request to leave the queue |

While the phase is not `IDLE`, a new write returns `BUSY` (except the `BLOCK` write described in
4.4). A `BLOCK` request thus holds producer access exclusively from submission until it leaves the
queue.

### 4.4 `BLOCK` timeout

When a `BLOCK` write times out:

- `BLOCK_WAITING`: the phase changes to `BLOCK_DETACHED` and the call returns `TIMEOUT`. The data
  stays queued and the backend sends it as usual; when the old request completes, the port returns
  the phase to `IDLE` directly without accessing the original caller's semaphore.
- `BLOCK_CLAIMED`: the backend has claimed completion; the call waits for the semaphore handoff and
  returns the actual result, which can exceed the timeout.

During `BLOCK_DETACHED`, other writes return `BUSY`. A `BLOCK` write no larger than `Capacity()` may
first wait for the old request to retire: the phase changes to `BLOCK_RETIRE_WAITING`, and when the
old request completes, the port hands `LOCKED` directly to this writer and wakes it; the writer then
continues from step 3 of 4.1 and waits for its own completion. Each of the two waits uses the
request's timeout; if the first wait times out, the call returns `TIMEOUT` and submits no data.

### 4.5 Batched writes

`WritePort::Stream` merges several appends into one request: it takes `LOCKED` at construction or in
`Acquire()`, each `Write()` appends directly to the data queue, and `Commit()` or destruction submits
the batch as one request, with the completion and timeout rules above. During `BLOCK_DETACHED`,
`Acquire()` returns `BUSY` at once and does not wait for the old request to retire. `Stream` is used
only from threads.

## 5. Late completion and semaphore counts

The semaphore in a port only wakes the caller; ownership of completion is decided by the phase. The
completion side first moves the phase to `BLOCK_CLAIMED` with a CAS and only then writes the result
and posts.

A late completion occurs where a request outlives the wait. On the read side the request has ended
when the call returns (see 3.4), so no late completion arises. On the write side and in
`AsyncBlockWait`, the request survives the timeout: the write request is still queued, or the
driver's hardware transaction is still running, and completion arrives later. If that completion
still posted the original semaphore, the semaphore would keep an extra count, and the next `BLOCK`
call on the same semaphore would take it as its own completion. `BLOCK_DETACHED` in `WritePort` and
`DETACHED` in `AsyncBlockWait` make a late completion only clean up the state, without posting.
Section 2 requires a semaphore that starts at 0 and is not shared for the same reason: to exclude
extra counts from outside the port.

## 6. `AsyncBlockWait`

Synchronous transactions inside a driver that do not go through `ReadPort` / `WritePort`, such as
the `BLOCK` transfers of some SPI and I2C drivers, use `AsyncBlockWait` from `operation.hpp` for the
same wait handoff. Its states, call order, and common mistakes are described in
[BLOCK Timeout and Completion Handoff](../driver/block_timeout_semantics.md).

## 7. Source files

- `src/core/rw/operation.hpp`: `Operation`, `AsyncBlockWait`, `WriteFun`
- `src/core/rw/read_port.hpp`, `src/core/rw/read_port.cpp`: `ReadPort`, `ReadQueue`
- `src/core/rw/write_port.hpp`, `src/core/rw/write_port.cpp`: `WritePort`, `WriteQueue`
- `src/core/rw/write_stream.cpp`: `WritePort::Stream`
- `src/utils/serialized_service.hpp`: `SerializedService`
- `driver/st/stm32_uart.cpp`: the backend example used on this page
