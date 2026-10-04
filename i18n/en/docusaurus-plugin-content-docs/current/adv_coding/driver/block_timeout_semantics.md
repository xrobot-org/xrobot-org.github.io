---
id: adv-coding-drv-block-timeout-semantics
title: BLOCK Timeout and Completion Handoff
sidebar_position: 4
---

# BLOCK Timeout and Completion Handoff

This page describes what a `BLOCK` timeout means on an asynchronous completion path: after the
caller stops waiting, whether the backend still completes, and if it does, whether that completion
may still wake the original waiter or access the original buffer.

## 1. What a `BLOCK` timeout actually means

A `BLOCK` timeout limits the caller's synchronous wait window. It does not mean every piece of backend work is automatically withdrawn.

For `ReadPort`, an unfinished software read can be cancelled, but the call must not return while an old completion path can still access the caller's destination. If completion already claimed the handoff, the waiter finishes that handoff before returning.

For `WritePort`, accepted bytes have already been copied into the port queue. Timeout does not withdraw them, and the backend may still transmit them. "The call returned `TIMEOUT`" and "the command did not happen" are not equivalent statements.

Transaction-style `SPI / I2C` drivers decide separately whether DMA can be stopped, a peripheral can be reset, or staging storage can be reclaimed safely. A waiter state machine cannot perform those hardware actions on its own.

## 2. Why detach semantics exist

If timeout only clears the wait state, the following happens:

1. the caller returned `TIMEOUT`;
2. an old hardware completion arrives later;
3. it posts the old semaphore again or touches a notification object already reused by a later call.

The wait path therefore needs an explicit answer to "does this waiter still belong to the caller?" `AsyncBlockWait` uses `DETACHED` for a caller that timed out. `WritePort` has its own `BLOCK_DETACHED` / `BLOCK_RETIRE_WAITING` phases for a call that returned while its queued request is still retiring.

Detach tells late completion that the old waiter is no longer a valid wakeup target; the backend work
itself continues.

## 3. What `AsyncBlockWait` solves

`AsyncBlockWait` provides a standard handoff for a driver that exposes a synchronous call over asynchronous completion.

| State | Meaning |
| ---- | ---- |
| `IDLE` | No active waiter |
| `PENDING` | A waiter is armed |
| `CLAIMED` | Completion claimed the notification |
| `DETACHED` | Timeout detached the waiter |

`Start(sem)` first publishes the waiter as `PENDING`. Completion (`TryPost(...)`) writes the result
and posts only after it successfully changes `PENDING -> CLAIMED`. The timeout path changes an
unclaimed `PENDING` waiter into `DETACHED`. If completion wins first, `Wait()` must finish the post
already assigned to the current call even if its first bounded semaphore wait just expired. A late
completion that sees `DETACHED` only returns the state to `IDLE` and does not post.

`Cancel()` returns the state to `IDLE` without posting when the hardware fails to start.
`AsyncBlockWait` does not check whether the previous transfer has ended: `Start()` always enters
`PENDING`, and a late completion of an older transfer arriving after that claims the new waiter. A
driver therefore confirms that the hardware is idle before calling `Start()`; for example,
`STM32SPI` returns `BUSY` unless the HAL state is `HAL_SPI_STATE_READY`.

This model handles waiter ownership only; stopping DMA and the state of the caller buffer are the
concrete driver's responsibility.

---

## 4. Common bugs

### 4.1 Hardware starts before the waiter is armed

The classic bad ordering is:

1. arm hardware / start DMA / enable completion interrupt;
2. then call `block_wait_.Start(...)`.

If hardware completes quickly, ISR can arrive before a legal waiter exists to claim the notification. Arm the waiter first, then expose hardware to a completion path that may run immediately.

### 4.2 Treating a stale semaphore token as current completion

If the same semaphore is reused across multiple `BLOCK` calls and the wait path only checks
`sem->Wait(timeout) == OK`, a token left behind by the previous call can be misread as the current
completion.

Request state must identify the owner first: the completion side of the current operation must
have moved the wait state to `CLAIMED` (`AsyncBlockWait`'s `CLAIMED`, or the port's
`BLOCK_CLAIMED`). The semaphore is a wakeup channel, not the request identity.

### 4.3 Returning on timeout without handling ownership

After timeout returns, the old completion path can still mutate shared state, post the semaphore
again, or even overwrite the ownership of a new waiter.

Before returning, either cancel the software request safely or detach its waiter so late completion retires silently. If completion has already claimed the request, finish that handoff.

### 4.4 Completion says success but the caller buffer is stale

This often appears in "asynchronous hardware + synchronous API" reads. Completion reports success while DMA data still lives in staging storage, or a late completion writes into caller memory after timeout.

A correct driver therefore defines not only who gets posted, but also what state the caller-visible buffer has on successful return and who may still access it after timeout.

---

## 5. Why timeout and final result can differ

When timeout races completion, two broad outcomes exist.

### Timeout wins first

- the waiter detaches from `PENDING`;
- the call returns `TIMEOUT`;
- late completion no longer wakes that caller and only retires its own state.

### Completion claims first

- completion changes the waiter to `CLAIMED`;
- the bounded semaphore wait may still have just returned timeout;
- completion ownership already belongs to this call;
- the wait path finishes the matching post and returns the actual completion result.

The timeout is therefore a wait window, not a strict wall-clock upper bound on the function. Ownership at the race decides the final result.

## 6. Why `ReadPort` and `WritePort` differ

A read port borrows the caller's destination. After timeout, the important guarantee is that no old completion can still touch that buffer when the call returns. It can cancel an unfinished software read and, if needed, wait for a completion path that already claimed the buffer.

A write port copied the caller's source on admission, so the source buffer can be reused after the
call returns. The timeout problem is how the old queued request retires without touching a
semaphore owned by a call that already returned. `BLOCK_DETACHED` / `BLOCK_RETIRE_WAITING` cover
this case.

A read timeout guarantees that the destination buffer is no longer accessed after the call
returns; a write timeout does not cancel a transfer that was already accepted.

## 7. Clearing a queue and hardware abort

`ReadPort::ClearQueuedData()` discards bytes already queued and returns `BUSY` with an active request. It does not cancel that request and does not stop UART/DMA.

A concrete abort/reconfiguration/reset path must make its own hardware and buffers quiescent, prevent old completion from touching released storage, and finish any port/waiter handoff. Clearing software bytes is only one possible step.

This is the same question as with timeout: what matters is who can still modify old state after the
call returns.

## 8. A practical checklist

A `BLOCK` driver path is checked for the following points:

- was the waiter armed before hardware could complete;
- after timeout, was completion ownership detached or safely cancelled;
- can late completion wake a caller that already returned;
- on success, is caller-visible receive data already updated;
- after timeout, can DMA/ISR still access caller-owned storage;
- for writes, does the caller know the timed-out request may still execute.
