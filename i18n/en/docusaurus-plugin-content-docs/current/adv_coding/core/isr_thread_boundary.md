---
id: adv-coding-core-isr-thread-boundary
title: ISR, Callback, and Thread Boundaries
sidebar_position: 2
---

# ISR, Callback, and Thread Boundaries

For the basic background, see [Design Concepts](/docs/concept),
[ASync](/docs/basic_coding/system/async), and
[Semaphore](/docs/basic_coding/system/semaphore). This page describes how work is divided between
ISRs, callbacks, and threads.

## Concurrency on a single-core MCU

A single-core MCU has concurrency too: tasks are interrupted by the scheduler, ISRs preempt threads,
and DMA and peripherals advance at their own pace. `LibXR` is concerned with how data and state are
handed over between ISRs, callbacks and threads. Once a high-frequency path mixes in waiting, long
critical sections or a dependence on scheduling order, the usual results are latency jitter, state
mismatches, and interference between timeouts, resets and late completions.

## What an ISR is responsible for

The default division is that the ISR hands over and advances, and the thread does the follow-up
work. Handing over means switching buffers, updating counters and timestamps, re-arming endpoints,
continuing DMA, pushing data into a software queue, and waking a waiter or worker. These actions have
clear boundaries and an estimable duration, and they are done in the ISR or a callback. What stays out
of the ISR is blocking waits, complex protocol parsing, resource allocation, and any logic that can
only finish correctly if threads wake up in a particular order.

## Why `mutex` is not the default

LibXR does not use a `mutex` by default for exchange between an ISR and a task: an ISR must not
block, most RTOSes do not allow taking a `mutex` in an ISR, and wrapping it in a critical section
makes interrupt-off time hard to bound. Tasks use a `mutex` or bounded critical sections among
themselves; between an ISR and a task, `FromISR` primitives, an SPSC ring, a mailbox, or a sequence
counter come first. Heavier CAS/lock-free structures are used only when measurement shows a
benefit.

## The role of atomics

`CAS` and atomic operations are needed on a single-core MCU as well. They resolve read-modify-write
races when an ISR preempts a thread, ownership-state claims, and the handover of lightweight states
such as `busy/pending/detached`. On a single-core system, races happen between context switches.

## `FromCallback` and ISR

Callback context and ISR context are two different cases. The `FromCallback` interfaces mean that
the call site needs semantics usable from a callback, and whether it runs in a hard interrupt is given
by the `in_isr` argument, as in `ASSERT_FROM_CALLBACK(...)`, `PostFromCallback(in_isr)` and
`ActiveFromCallback(..., in_isr)`. Keeping the two apart means that paths that only need callback
safety do not carry ISR restrictions, and actions that can only be done in an ISR are not moved into
ordinary callbacks.

## Why `BLOCK` cannot be used in an ISR

Using `BLOCK` inside an ISR is an error. `BLOCK` always ends in a wait path such as
`sem->Wait(...)`, and waiting in an ISR breaks the boundary above, so an ISR only submits, switches
state and posts, and waiting for a result happens only in thread context.
`Operation::UpdateStatus()` uses `PostFromCallback(in_isr)` so that the completion notification can be
sent from an ISR; this concerns only the notifying side, and the `BLOCK` wait still happens only in a
thread.

## Paths that need only the latest value

Control and state-estimation paths usually need only the latest value and do not need to keep every
old sample; `latest + seq` or a single-slot mailbox suits them. Deep queues suit cases where every
sample must be kept and delayed consumption is acceptable; on a path that needs only the latest value,
a deep queue feeds outdated but still valid data into the following computation. Such paths should
state their contract explicitly, for example "data older than two control periods must not be used",
"`drop_oldest` is allowed", "overflow / drop counters must be exposed".

## Where `ASync` fits

`ASync` is the common submission interface in this division: a callback or ISR performs only the
short handoff and passes the remaining work to `ASync` with `AssignJobFromCallback(job, in_isr)`. On
systems with threads a worker thread runs the job; on systems without threads
(`LIBXR_NOT_SUPPORT_MUTI_THREAD`) a software Timer runs it in normal context, and a long job delays
other callbacks on the same Timer.

## Choosing where work runs

Three questions decide where a piece of work belongs, in this order: whether it is part of the
hardware handoff; whether its execution time is short and bounded; and whether it needs to wait,
allocate resources or depend on scheduling order. If the first two hold and the third does not, it
goes into the ISR or a callback; otherwise it runs in a thread.
