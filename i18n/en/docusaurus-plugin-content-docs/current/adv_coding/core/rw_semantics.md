---
id: adv-coding-core-rw-semantics
title: I/O Completion Semantics and Port State Machines
sidebar_position: 1
---

# I/O Completion Semantics and Port State Machines

For the basic APIs, see [I/O Read/Write Abstraction](/en/docs/basic_coding/core/core-rw) and
[Operation Model](/en/docs/basic_coding/core/core-op). This page focuses on why the completion
model is organized this way.

The current LibXR I/O completion model has three layers: `Operation` describes how completion is
reported, `ReadPort / WritePort` own the queueing, busy state, and completion handoff, and the
concrete driver only has to move hardware to the boundaries of "request accepted" or "request
completed". The more complex state machine lives in the port, not in `Operation`, and that is
intentional.

`Operation` is deliberately kept small and trivially copyable. It only carries the completion mode
itself: `CALLBACK`, `BLOCK`, `POLLING`, or `NONE`, plus the small payload required by that mode.
This keeps lifecycle, waiter ownership, and timeout handoff state out of `Operation` itself. Once
`Operation` turns into a heavy object, copy cost goes up and the boundary between driver and port
starts to blur.

This matters most for `BLOCK`. In `BLOCK` mode, `Operation::UpdateStatus()` only does
`sem->PostFromCallback(in_isr)`. It does not store the final `ErrorCode` in semaphore semantics.
The final result is still handed off through the port-side `block_result_`. In other words, the
semaphore means "wake up and re-check ownership", not "this operation has definitely completed
legally". That distinction exists to block the most dangerous case: a waiter times out and returns,
then a late completion posts the same semaphore again, leaving stale tokens that a later call can
misread as its own completion.

## 1. `ReadPort` state machine

The core `ReadPort` states are:

| State | Meaning |
| ---- | ---- |
| `IDLE` | No pending read and no completion waiting to be handed off |
| `PENDING` | Request has been handed to the backend and is waiting for queue-side completion |
| `BLOCK_CLAIMED` | The wakeup for the current `BLOCK` waiter now belongs to this waiter |
| `BLOCK_DETACHED` | Timeout or reset detached the waiter; completion must stay silent |
| `EVENT` | Data arrived before a waiter was attached; the next call must re-check the queue |

The easiest one to misread is `EVENT`.

It does not mean "read completed". It means:

- data has already entered the software queue
- but there was no claimable pending read at that moment

So the next caller has to re-check `queue_data_`, instead of blindly issuing another backend read.

## 2. `WritePort` state machine

`WritePort` differs from `ReadPort` because the write path also has to manage queue modification
ownership.

Its core states are:

| State | Meaning |
| ---- | ---- |
| `IDLE` | No active submitter and no pending `BLOCK` waiter |
| `LOCKED` | The current submit path owns queue mutation rights |
| `BLOCK_WAITING` | A `BLOCK` waiter is attached but completion has not been claimed yet |
| `BLOCK_CLAIMED` | Completion has been claimed by the current waiter |
| `BLOCK_DETACHED` | Timeout or reset detached the waiter; completion must not post again |

The key point is:

- thread-safe multi-writer behavior does not come for free from the queue alone
- the outer safety boundary is the atomic `busy_` gate

Multiple threads do not race directly into driver `WriteFun()`. Only the path that acquires
`LOCKED` owns queue mutation and kickoff rights for that submission.

## 3. What "success" means to the port

The most important contract at the port layer is:

- driver returns `PENDING`: the backend accepted the request and completion will be handed off later
- driver returns anything other than `PENDING`: this call is already terminal

That is the meaning of "non-`PENDING` is terminal".

It has two direct consequences:

1. if the driver says it never entered `PENDING`, the port will not maintain later completion
   semantics for it
2. if the driver returns non-`PENDING` but hardware keeps running in the background, semantics drift

So the driver must be explicit about when hardware has really accepted the request, versus when it
is only temporarily busy and has not actually taken ownership yet. Once the `PENDING` / non-
`PENDING` boundary is wrong, the port believes the call is over while the backend keeps advancing in
the background. Then `BUSY`, `TIMEOUT`, and late completion all get tangled together.

## 4. `BLOCK` timeout is not cancellation

The `timeout` in `ReadOperation(sem, timeout)` / `WriteOperation(sem, timeout)` is:

- a relative wait duration
- passed to `Semaphore::Wait(timeout)`

It is not an absolute deadline, and it does not automatically cancel the backend.

So the real meaning of `BLOCK timeout` is only that the synchronous waiting window is bounded. If
the backend has already started, late completion can still happen. The important work after timeout
is not "stop the hardware immediately", but "fix ownership of completion". States such as
`BLOCK_DETACHED` exist to tell the completion path that the waiter no longer belongs to the original
caller and must only be cleaned up silently.

## 5. Why `Reset()` also follows detach semantics

`Reset()` is not implemented as a blunt state clear back to `IDLE`.

For `BLOCK` paths, it follows the same model as timeout:

1. detach the current waiter
2. keep late completion silent
3. reopen the port only after the old handoff has drained completely

That avoids races such as:

- the caller already returned because of timeout or reset
- the old backend completion arrives later
- that old completion wakes up a new call by mistake

So timeout and reset are the same class of problem here: detach ownership first, then wait for the
old handoff to drain.

## 6. Where `AsyncBlockWait` fits

`AsyncBlockWait` is not a replacement state machine for `ReadPort / WritePort`. It is better viewed
as a shared waiter handoff helper for drivers that internally need "synchronous surface, asynchronous
hardware".

Its states are straightforward:

| State | Meaning |
| ---- | ---- |
| `IDLE` | No active waiter |
| `PENDING` | Waiter is attached and waiting for completion |
| `CLAIMED` | Completion has been claimed by the waiter |
| `DETACHED` | Timeout detached the waiter; completion can only clean up silently |

It fits cases where:

- the driver does not go through the full `ReadPort / WritePort` path
- but still needs to synchronously wait for an asynchronous completion

For example, certain `SPI / I2C` `BLOCK` transactions.

## 7. The overall reading rule

Read the port as a "completion ownership transfer" mechanism.

What it really manages is not:

- where data comes from
- where data goes

It manages:

- who the current completion belongs to
- who is still allowed to speak after timeout
- whether late completion should wake someone or stay silent

The state names in `libxr_rw.*` follow from this view.
