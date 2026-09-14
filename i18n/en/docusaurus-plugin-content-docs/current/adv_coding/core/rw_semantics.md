---
id: adv-coding-core-rw-semantics
title: I/O Completion Semantics and Port State Machines
sidebar_position: 1
---

# I/O Completion Semantics and Port State Machines

For the basic API, see [I/O read/write abstraction](/en/docs/basic_coding/core/core-rw) and the [Operation model](/en/docs/basic_coding/core/core-op). This page focuses on why completion is organized this way.

The model still has three layers. `Operation` describes how completion is reported. `ReadPort / WritePort` own request state, queues, and completion handoff. Concrete drivers move hardware data into a port or consume released data from it. Timeout, waiter ownership, and late-completion state stay in the port or driver that owns the request instead of being packed into `Operation` itself.

`Operation` is intentionally small: it carries `CALLBACK`, `BLOCK`, `POLLING`, or `NONE` plus the corresponding notification target. In `BLOCK` mode the semaphore wakes the waiter; the final result remains in the port or driver. That lets the layer that owns request state also decide what a timeout or late completion is still allowed to touch.

## 1. `ReadPort` state machine

`ReadPort` stores a phase and a "data was published, recheck" hint in one atomic state word. The phases are:

| State | Meaning |
| ---- | ---- |
| `IDLE` | A new read may be admitted |
| `CLAIMED` | One path owns request processing or dequeue |
| `PENDING` | A request is waiting for enough data |
| `CLAIMED_WITH_WAITER` | A timeout path waits for safe processing handoff |
| `BLOCK_CLAIMED` | Completion has claimed a BLOCK request |

A separate `EVENT_BIT` can coexist with any phase. It does not mean "read complete". It records that the producer published data across a handoff point and the queue must be checked again after current processing ownership is released. Keeping it orthogonal to the phase prevents a producer/consumer race from losing the fact that new data arrived.

A positive-length read copies into the caller buffer only when the full requested length is available. A zero-length read waits only for nonempty data and consumes nothing. Before a completion path touches a BLOCK destination it claims completion ownership, which makes the buffer owner explicit when timeout and completion race.

There is also an important ordering rule on non-BLOCK callbacks: request-processing ownership is released before the user callback runs. That callback can therefore submit the next non-BLOCK read without recursively finding the previous phase still occupied.

---

## 2. `WritePort` state machine

The write side must track both producer ownership and how many requests have actually been released to the backend consumer. The low three bits hold the phase; the remaining bits count released requests.

| State | Meaning |
| ---- | ---- |
| `IDLE` | A new writer may be admitted |
| `LOCKED` | A producer is preparing a request or Stream batch |
| `BLOCK_WAITING` | A submitted BLOCK caller awaits completion |
| `BLOCK_CLAIMED` | The backend has claimed BLOCK completion |
| `BLOCK_DETACHED` | The call timed out while its request remains queued |
| `BLOCK_RETIRE_WAITING` | A later BLOCK caller waits for the old request to retire |

Separating released-request count from producer phase matters: while a producer prepares a later request, the backend may continue consuming earlier requests that are already released. Bytes in a `Stream` batch are not a new request until `Commit()` releases them.

There is one backend consumer. `GetWriteQueue()`, dequeue, settlement when that interface is destroyed, and any completion callback triggered by settlement belong to one serialized consumption path. The port manages publication and request settlement; the driver's DMA buffers, registers, and active/pending state remain driver-owned.

---

## 3. What "complete" means to a port

Older revisions used a driver-returned `PENDING` / non-`PENDING` result to distinguish background work. The current `WritePort` no longer uses that protocol. `WriteFun(WritePort&, bool)` is a **void progress notification**; a backend consumes released front requests through `GetWriteQueue()`.

The actual write-completion boundary is: **all bytes of that request have been consumed by the backend into storage it can retain after the dequeue call returns.** When `WriteQueue` settlement observes that the full request has been consumed, it triggers the request's `Operation` completion.

That creates an important distinction:

- port completion: the backend accepted the whole request;
- DMA completion: one DMA block finished moving;
- UART wire completion: the final stop bit left the transmitter.

These can happen at different times. An STM32 UART may copy a request into active/pending DMA buffers and complete the port request while DMA and wire transmission continue. Operations such as RS485 direction switching that depend on "the wire is empty" must use the corresponding hardware completion event rather than `WriteOperation` completion.

Read completion has a different boundary. A positive-length `ReadPort` completes only after the full requested data has been copied into the caller's destination. `Operation` unifies notification style; it does not redefine every hardware action as one generic "done" instant.

## 4. `BLOCK` timeout is not one universal cancel

The timeout in `ReadOperation(sem, timeout)` / `WriteOperation(sem, timeout)` is a relative wait duration, but what remains after timeout depends on the port.

A read port can cancel an unfinished software read. The important rule is not "immediately set IDLE" but **do not return while an old completion path can still access the caller's destination**. If completion already claimed that buffer, the timeout path waits for the handoff to finish. The call may therefore return after the requested timeout and return the completion result instead.

Writes are different. Once admitted, source bytes have already been copied into the port queue. Timeout stops the synchronous caller from waiting; it does not withdraw those queued bytes. The backend may still transmit them. `BLOCK_DETACHED` and `BLOCK_RETIRE_WAITING` separate an old request that is still retiring from a later BLOCK caller that wants to enter.

That is why a non-idempotent command should not simply be retransmitted after timeout under the assumption that the first attempt did nothing. Sequence numbers, acknowledgement, or de-duplication belong at the protocol layer.

## 5. Queue clearing, reconfiguration, and reset are separate concerns

The current `ReadPort` has no universal `Reset()` that simultaneously cancels a request, clears bytes, and stops hardware. `ClearQueuedData()` discards bytes already queued; it returns `BUSY` with an active request and does not stop UART/DMA.

Keeping these actions separate avoids a familiar race:

1. upper layers consider a reset complete;
2. an old DMA/IRQ completion arrives later;
3. that old completion touches state or notification storage already reused by a new request.

A concrete backend that needs abort/reconfiguration must first make its hardware and backend buffers quiescent, then reopen the port-side path. Clearing a software queue cannot be used as proof that hardware stopped.

## 6. Where `AsyncBlockWait` fits

`AsyncBlockWait` is not a replacement for `ReadPort / WritePort` state machines. It is a small waiter-handoff primitive for driver paths that present a synchronous call over asynchronous hardware:

| State | Meaning |
| ---- | ---- |
| `IDLE` | No active waiter |
| `PENDING` | A waiter is armed and awaiting completion |
| `CLAIMED` | Completion has claimed the notification |
| `DETACHED` | Timeout detached the caller |

The usual ordering is: call `Start(sem)` first, then expose hardware that might complete immediately. Completion uses `TryPost(...)` to claim the waiter. `Wait(timeout)` can move an unclaimed waiter to `DETACHED`. If completion wins first, the waiter finishes the completion already assigned to it; if timeout detaches first, late completion only retires state and does not post the old waiter again.

This mechanism owns **notification handoff**, not hardware cancellation. Whether DMA stopped, receive data was copied back, or an external buffer is safe to destroy remains the concrete driver's responsibility.

---

## 7. A useful way to read the state machines

Treat a port as a request/completion ownership handoff mechanism.

It is not primarily deciding which UART produced a byte or how DMA registers are configured. It decides:

- who currently owns the request;
- which data has been released to the other side;
- which waiter/callback owns completion;
- who may still access the old buffer or semaphore after timeout;
- whether a late completion should hand off normally or only retire silently.

With that view, the phases in `read_port.*`, `write_port.*`, and `operation.hpp` line up with the races they are solving. Hardware-specific DMA, FIFO, endpoint, and wire completion stays outside that ownership boundary.
