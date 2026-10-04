---
id: adv-coding-driver-block-timeout-semantics
title: BLOCK Timeout and Completion Handoff
sidebar_position: 3
---

# BLOCK Timeout and Completion Handoff

This page describes what a `BLOCK` timeout means on an asynchronous completion path: after the
caller stops waiting, whether the backend still completes, and if it does, whether that completion
may still wake the original waiter.

## 1. What `BLOCK timeout` really means

`BLOCK` timeout limits the caller's synchronous waiting window. It does not guarantee that an
accepted backend operation has been cancelled. In other words, returning `TIMEOUT` does not mean the
hardware has stopped. If the backend was already started, late completion can still arrive.

## 2. Why detach semantics exist

If timeout clears the port or waiter state directly, the following happens:

1. the caller already returned `TIMEOUT`
2. the old backend completion arrives later
3. that completion wakes a new caller or leaves a stale semaphore token behind

So the right thing here is not "hard clear everything". The waiter must first be detached, then
late completion must finish silently, and only after the old handoff drains can the port reopen.
States such as `BLOCK_DETACHED` exist to express exactly that.

## 3. What `AsyncBlockWait` solves

`AsyncBlockWait` is intentionally narrow. It gives drivers a standard handoff helper for paths that
look synchronous from the outside but wait on asynchronous completion internally. It does not cancel
hardware. It only makes ownership of completion explicit: `Start(sem)` attaches a waiter in
`PENDING`, `TryPost(...)` only wakes when `PENDING -> CLAIMED` succeeds, and `Wait(timeout)` turns
the waiter into `DETACHED` after timeout. If a late completion only sees `DETACHED`, it must clean
up silently and must not post again. `Cancel()` returns the state to `IDLE` without posting when the
hardware fails to start. `AsyncBlockWait` does not check whether the previous transfer has ended:
`Start()` always enters `PENDING`, and a late completion of an older transfer arriving after that
claims the new waiter. A driver therefore confirms that the hardware is idle before calling
`Start()`; for example, `STM32SPI` returns `BUSY` unless the HAL state is `HAL_SPI_STATE_READY`.

## 4. Common bugs

### 4.1 Hardware starts before the waiter is armed

This is the most common one.

Wrong order:

1. arm hardware / start DMA / enable interrupts
2. then call `block_wait_.Start(...)`

Risk:

- completion happens too quickly
- ISR fires before waiter setup finishes
- the wakeup is lost

Correct order:

1. arm the waiter first
2. only then expose hardware to ISR / DMA / completion paths

### 4.2 Treating an old semaphore token as the current completion

If the same semaphore is reused across multiple `BLOCK` calls and the wait path only checks
`sem->Wait(timeout) == OK`, then a token left behind by the previous call can be misread as the
current completion. What matters is whether the completion side of the current operation has moved
the wait state to `CLAIMED` (`AsyncBlockWait`'s `CLAIMED`, or the port's `BLOCK_CLAIMED`). Without
that ownership check, the wakeup may just be a
stale token.

### 4.3 Returning on timeout without detach

After timeout returns, the old completion path can still mutate shared state, post the semaphore again, or even overwrite the
ownership of a new waiter. Before returning on timeout, the completion side must be told explicitly
that this waiter no longer belongs to the current caller.

### 4.4 Completion says success, but caller-visible buffer is still old

This often shows up in mixed "asynchronous completion + synchronous surface" paths. Completion
reports success, but DMA or ISR data was never copied back into the caller-visible buffer. For APIs
such as `MemRead` or `ReadAndWrite`, that is more dangerous than a timeout because the result looks
successful while the data is still stale.

## 5. Why `TIMEOUT` and the final result may differ

When timeout races completion, two outcomes exist.

### timeout wins first

- waiter detaches successfully from `PENDING`
- the call returns `TIMEOUT`
- late completion only performs silent cleanup

### completion claims first

- completion has already claimed the waiter
- timeout may appear to return first from `Wait()`
- but the code must still wait for the completion already owned by this waiter
- the return value becomes final `block_result_`, not `TIMEOUT`

So `BLOCK timeout` is not simply "timeout means failure". The real answer depends on who finally
owns that completion.

## 6. Why `SPI / I2C` hits this easily

Compared with long-lived streaming paths such as UART or USB, `SPI / I2C` is more often written in
the shape of "launch one transaction, then wait synchronously in a thread". The surface looks
synchronous, but the backend is still driven by DMA, IRQ, and a state machine. Treating the
synchronous surface as a synchronous implementation leads to problems such as arming the waiter
after the hardware starts, stale semaphore tokens after timeout, and late completions that do not
stay silent.

## 7. A practical checklist

A `BLOCK` driver path is checked for four points:

- is the waiter armed before hardware becomes visible
- does timeout explicitly detach
- does late completion stay silent after detach
- does the final result match the actual caller-visible buffer contents
