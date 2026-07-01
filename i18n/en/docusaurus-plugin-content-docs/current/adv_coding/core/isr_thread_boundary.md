---
id: adv-coding-core-isr-thread-boundary
title: ISR, Callback, and Thread Boundaries
sidebar_position: 2
---

# ISR, Callback, and Thread Boundaries

For the basic background, see [Design Concepts](/en/docs/concept),
[ASync](/en/docs/basic_coding/system/async), and
[Semaphore](/en/docs/basic_coding/system/semaphore). This page goes straight to the boundaries that
are easiest to get wrong in the implementation.

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

Many people reach for `mutex` first, but it is not the default primitive for ISR-task exchange. The
reason is simple: ISR must stay non-blocking, and many RTOSes do not allow taking a `mutex` inside
ISR at all. Even if you force it with a critical section, the result often degenerates into
unbounded interrupt-off time. A more practical default is: use `mutex` or bounded critical sections
between tasks, and prefer `FromISR` primitives, `SPSC ring`, mailbox, or sequence-based handoff
between ISR and task. Heavier CAS/lock-free structures only make sense when measurement shows they
are worth it.

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

`BLOCK` inside ISR is a hard error, not a style issue. `BLOCK` eventually reaches a wait path such
as `sem->Wait(...)`. Once that is placed in ISR, the system boundary is gone. The proper split is
always: ISR only posts work, advances state, and wakes; the actual waiting for a result belongs to a
thread context. `Operation::UpdateStatus()` can use `PostFromCallback(in_isr)` to keep completion
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

`ASync` should also be read in terms of this boundary. It does not make a long task safe simply by
moving it elsewhere. It is closer to a unified submission surface: do the short handoff in
callback or ISR, and move the rest to a thread when the system has one. The practical caveat is that
on no-thread implementations, `ASync` currently degenerates into a synchronous direct call wrapper.
It unifies submission semantics, but it does not guarantee a real background thread exists.

## A practical rule of thumb

To make a quick engineering decision, ask three things:

- is this step part of hardware handoff
- is its execution time short and bounded
- does it need waiting, resource allocation, or dependence on scheduler order

If the first two are yes and the third is no, it usually belongs in ISR or a callback-safe path.
Otherwise it should be pushed down into a thread.
