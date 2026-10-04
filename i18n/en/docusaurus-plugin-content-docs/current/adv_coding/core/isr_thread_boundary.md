---
id: adv-coding-core-isr-thread-boundary
title: ISR, Callback, and Thread Boundaries
sidebar_position: 2
---

# ISR, Callback, and Thread Boundaries

For the basic background, see [Design Concepts](/en/docs/concept),
[ASync](/en/docs/basic_coding/system/async), and
[Semaphore](/en/docs/basic_coding/system/semaphore). This page describes how work is divided between
ISRs, callbacks, and threads.

## Concurrency on a single-core MCU

In LibXR, the core issue is not "whether the system has multiple cores". It is how data and state
are handed across ISRs, callbacks, and threads. A single-core MCU still has concurrency: tasks
interrupt each other through scheduling, ISRs preempt threads, and DMA or peripherals advance on
their own schedule. Once a high-frequency path mixes in waiting, long critical sections, or
dependencies on wakeup order, the result is usually jitter, state skew, and collisions between
timeout, reset, and late completion.

## What should stay in ISR

The more stable default rule is: ISR handles handoff and short progression, while the thread
handles expanded follow-up work. Handoff means buffer switching, counters and timestamps, endpoint
rearm, DMA continuation, pushing data into a software queue, or waking a waiter or worker. As long
as the boundary is explicit and execution time is bounded, these actions should stay in ISR or in a
callback-safe path. What should not go there is blocking waits, complex protocol parsing, resource
allocation, or anything that only works if thread wakeup order happens to line up.

## Why `mutex` is not the default

LibXR does not use a `mutex` by default for exchange between an ISR and a task: an ISR must not
block, most RTOSes do not allow taking a `mutex` in an ISR, and wrapping it in a critical section
makes interrupt-off time hard to bound. Tasks use a `mutex` or bounded critical sections among
themselves; between an ISR and a task, `FromISR` primitives, an SPSC ring, a mailbox, or a sequence
counter come first. Heavier CAS/lock-free structures are used only when measurement shows a
benefit.

## The role of atomics

That also clears up a common misunderstanding: CAS and atomics are not SMP-only tools. They remain
useful on a single-core MCU because they solve read-modify-write races between ISR preemption and a
thread, lightweight ownership claims, and small handoff states such as `busy`, `pending`, or
`detached`. Single-core does not mean race-free. It only means the race happens across context
switches instead of on multiple cores at the same time.

## `FromCallback` is not the same as ISR

Callback context and ISR context should not be collapsed into one thing. `FromCallback` means "the
current path needs callback-safe semantics"; it does not automatically mean "we are inside a hard
interrupt right now". That is why the code now leans on `ASSERT_FROM_CALLBACK(...)`,
`PostFromCallback(in_isr)`, and `ActiveFromCallback(..., in_isr)` instead of treating every
callback-safe path as ISR. Once those two are mixed together, semantics drift quickly: paths that
only need callback safety get forced into stricter ISR rules, while actions that really must stay in
ISR get pushed down into ordinary callbacks.

## Why `BLOCK` cannot enter ISR

Using `BLOCK` inside an ISR is an error: `BLOCK` eventually reaches a wait path such as
`sem->Wait(...)`, and waiting inside an ISR breaks this boundary. An ISR only posts work, advances
state, and wakes; waiting for a result happens in thread context. `Operation::UpdateStatus()` can use `PostFromCallback(in_isr)` to keep completion
notification callback-safe, but that does not make `BLOCK` itself valid in ISR.

## Freshness-first paths

Control and state-estimation paths often get the queue choice wrong. If the system really cares
about the latest value rather than preserving every historical sample, the better default is usually
`latest + seq` or a single-slot mailbox instead of a deep queue. Deep queues fit cases where all
samples must be preserved and delayed consumption is acceptable. On freshness-first paths, they only
drag old-but-still-valid data further into the system. For these cases, it is better to write the
contract directly: "data older than two control periods must not be used", "`drop_oldest` is
allowed", "overflow / drop counters must be exposed".

## Where `ASync` fits

`ASync` is the common submission interface in this division: a callback or ISR performs only the
short handoff and passes the remaining work to `ASync` with `AssignJobFromCallback(job, in_isr)`. On
systems with threads a worker thread runs the job; on systems without threads
(`LIBXR_NOT_SUPPORT_MUTI_THREAD`) a software Timer runs it in normal context, and a long job delays
other callbacks on the same Timer.

## A practical rule of thumb

Three questions decide where a step belongs:

- is this step part of hardware handoff
- is its execution time short and bounded
- does it need waiting, resource allocation, or dependence on scheduler order

If the first two are yes and the third is no, it usually belongs in ISR or a callback-safe path.
Otherwise it should be pushed down into a thread.
