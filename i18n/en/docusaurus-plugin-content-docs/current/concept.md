---
id: concept
title: Design Concept
sidebar_position: 10
---

# Design Concept

This page describes the design choices of `LibXR` on a few core questions: how data flow is organized, what callbacks and interrupts are responsible for, how the completion of an I/O operation is expressed, and where the platform boundary lies. Many interfaces look restrained for these reasons.

## `Lock-free Data Structures and ISR-Driven Data Flow`

In device drivers, the core question is how data is handed over between the `ISR`, `DMA` and threads in a timely and controlled way. Once the handover depends on long critical sections, blocking waits or scheduling order, latency jitter, inconsistent state or data loss follow easily.

On sensitive paths such as UART, USB and DMA, `LibXR` therefore prefers pre-allocated buffers, ring queues, double buffering and explicit state transitions, turning the high-frequency path into a data flow driven by hardware events: interrupts hand data over and advance the state, and threads carry out the follow-up processing. The goal is **to keep sensitive paths from depending on mutexes, blocking OS queues or long interrupt-disabled sections**, rather than to be lock-free in form.

### Common Questions

#### Most MCUs are single-core. Is lock-free still needed?

Yes. The problem is the data handover when an `ISR` preempts a thread, when `DMA` or a peripheral advances at its own pace, and when threads and interrupts share state. Races occur on a single core as well; the difference is only that they happen between context switches rather than on several cores executing at once.

#### Why not use mutexes and OS queues on the I/O hot path?

They can be used, but not on the I/O hot path. When an `SPSC` ring queue solves a path, it is the better choice; `CAS` is only one means, not the goal. What is avoided is tying the high-frequency handover path to lock contention, thread wake-up order or long critical sections. In many RTOSes a `mutex` cannot be used in an `ISR` at all, and critical sections often end up as disabled interrupts anyway.

#### Why not process all data in threads?

Some actions cannot wait for a thread to wake up. Buffer switching, endpoint re-arming, advancing the DMA state and acknowledging the receive window are tied to the hardware's pace and must be handed over as soon as possible; business processing, protocol parsing and upper-layer logic belong in threads. Many drivers also have busy/pending states, buffer lifetimes and state machine transitions that must be handled at the critical point, which a single queue cannot solve.

#### What does this design gain?

The worst-case latency of high-frequency paths is easier to estimate; the responsibilities of callbacks, interrupts and threads are clearer; there is less dependence on the scheduler's wake-up order; and when porting to new hardware, it is easier to tell whether a problem lies in the state handover, buffer management or upper-layer logic.

## `Runtime memory allocation in embedded systems is a design flaw`

**High-frequency runtime paths should not rely on temporary resource allocation for correctness.** `malloc` and `new` are not the problem in themselves; allocating and releasing resources on the hot path, in an ISR or in a high-frequency callback is, because it easily makes latency, failure paths and memory bounds uncontrollable.

In a stable embedded system, every object that needs heap allocation should be constructed once during initialization and never destroyed. This allows memory allocation to be implemented with very simple data structures, such as a stack that only grows, or another allocator that only grows in one direction during initialization.

### Common Questions

#### Does fully dynamic allocation save memory?

It only appears to. In a real system, memory usage is closer to a continuously fluctuating distribution that is hard to cap in advance. The total that all tasks may request at run time cannot be known, so neither can the upper bound the system really needs, and that bound is often very close to the total a static allocation would have to reserve.

#### Why not use fully static allocation?

"Fully static" is indeed the easiest to analyze, but it drives up initialization complexity, configuration burden and the constraints on how objects are organized. The goal of `LibXR` is to prepare resources at controlled points in time as far as possible and to minimize temporary allocation on hot paths, without requiring every object to be laid out flat at once.

#### What about cases that require dynamic allocation?

The design serves the application and can be broken when necessary. What matters is whether a clear, controlled upper bound can be given. Most design patterns can be implemented under the constraint of a finite memory upper bound. The recommended strategy is to allocate by phase and reclaim by lifetime: long-lived objects and buffers are prepared at startup; the temporary objects of a module or flow are kept together in a controlled region; and they are reclaimed as a whole when that phase ends, the module is unloaded or the system restarts.

#### Why not allocate separate regions by memory pool?

`LibXR` distinguishes memory regions only by hardware properties such as speed and bus accessibility, for example the `DTC RAM` on `STM32H7`. The driver layer already carries natural isolation semantics, so per-module pools would only add a second layer of complexity. What really needs to be distinguished is whether a block of memory is fast enough and accessible to a given bus, not which design pattern it belongs to.

## `All callbacks/interrupts must be non-blocking`

Callbacks and interrupts should not do anything that makes latency, scheduling or resource bounds uncontrollable. What `LibXR` rules out is blocking waits, complex business processing, extra resource allocation, and any processing that depends on the scheduler and wake-up order to complete; work that is directly tied to the hardware handover, has an estimable duration and clear bounds belongs here.

### Common Questions

#### `LibXR` does quite a lot in many callbacks, and ISR-driven communication interfaces often copy large amounts of data. Does this contradict the rule?

No. "Non-blocking" does not mean "doing nothing"; it means "doing nothing uncontrollable". Buffer switching, moving data, endpoint re-arming, advancing state and handing a piece of data from the hardware to a software queue are work that callbacks and ISRs should do, as long as their bounds are clear and their cost can be estimated. What does not belong there is waiting, sleeping, lock contention, heap allocation and large blocks of high-level business logic.

#### How is the rule enforced? Does it rely only on the developer?

Not only on discipline. In `LibXR`, the form of many interfaces enforces the rule: context information is passed explicitly through `in_isr`; ordinary interfaces and callback-safe interfaces are separate; `Operation` binds the completion behavior when the operation is issued; and high-frequency I/O paths hand over through ports, buffers and queues, so the caller does not write its own completion logic in callbacks. Many obviously wrong approaches do not work semantically, for example putting a synchronization primitive that needs thread semantics directly into an ISR. The rule needs to be understood by developers, but interface boundaries, explicit context and data-flow layering also enforce it.

#### How are callback nesting and the stack managed?

This is the other half of the rule. If callbacks could trigger each other recursively without limit, the system would fail through uncontrolled stack depth even if every level is non-blocking. Where such self-reentry must be flattened, `Callback::CreateGuarded()` defers a trigger that arrives while the same callback is running until the current call ends, instead of nesting the call stack deeper. An ordinary `Callback::Create()` callback is still invoked directly. This keeps the stack depth under control on callback chains where self-reentry can actually occur; together with the layering described above, in which the ISR hands over and the thread carries out the processing, stack usage and response timing stay analyzable.

## `Execution context (thread/isr) must be explicitly passed into callbacks`

Whether a callback runs in a thread or in an ISR / callback context directly determines which APIs may be called and which behavior is safe. `LibXR` **makes the context part of the interface semantics**, so the caller does not have to guess.

Many interfaces therefore take a parameter such as `in_isr`, or come as a pair of an ordinary interface and a callback-safe interface. This is more verbose than hiding everything internally, but safer, and it keeps behavior consistent across platforms more easily.

### Common Questions

#### Why not hide the context check internally and let the framework detect it?

Not every platform offers a uniform, cheap and reliable way to tell whether the code is in an ISR / callback context. More importantly, the context determines which APIs may be called and which behavior is safe, so it should not be disguised as an implementation detail the caller need not know. Passing the context explicitly writes the constraint into the interface semantics.

#### Does passing `in_isr` explicitly make interfaces ugly?

Slightly more verbose, but the cost of misuse is lower. What is exposed here is the call boundary. If the interface does not state it, the caller will sooner or later add it back in a more hidden and more dangerous way.

#### Why separate ordinary and callback-safe interfaces instead of keeping a single "auto-compatible" set?

What a thread context can do differs from what an ISR context can do. Forcing them into one set usually degrades every interface to the most conservative subset, or buries failure conditions in run-time behavior. With separate interfaces, it is obvious where blocking is allowed and where only posting and limited handover are possible.

## `Every I/O operation must bind a defined completion behavior`

The completion behavior of an I/O operation is fixed when the operation is issued: who receives the completion, how it is handled, and when the operation counts as finished.

This is why the `Operation` model exists: when an operation is issued, its completion behavior is bound to it, for example a completion callback, a blocking wait, a polled status, or an ignored result. The responsibilities of the driver layer, the port layer and the upper-layer caller are then clearly separated, and the completion does not depend on unwritten conventions.

### Common Questions

#### Why not provide only an interface that "issues I/O" and let the upper layer handle completion afterwards?

Who receives the completion signal, when the busy state is released, and how timeouts and errors propagate: if these are not fixed when the operation is issued, the driver layer and the caller can only piece them together by convention, and the end condition easily becomes unclear.

#### Blocking, callback, polling and ignoring the result look like different calling styles. Why express them in one set of semantics?

They assign the completion responsibility differently. At the moment of issuing, the driver should know whether completion wakes a waiter, triggers a callback, waits for a poller to fetch the status, or is explicitly allowed to be ignored. Only a single model lets the port layer, the driver layer and the upper layer agree on the same completion semantics.

#### Is the `NONE` "ignore the result" mode really meaningful?

Yes, provided it is an explicit choice. `NONE` itself is not dangerous; the danger is an interface that does not express this option at all, so the completion behavior is silently dropped.

## `No platform-specific types should appear in interfaces`

A public interface should express capabilities and semantics, such as "this is a UART" or "this needs a completion behavior", rather than expose low-level platform handle types that make upper-layer code depend on the structs of a particular MCU SDK or on private system types.

Once platform details enter a public interface, the upper layer is coupled to the concrete implementation, and the cost of replacing the implementation, reusing code across platforms and testing in simulation rises sharply.

### Common Questions

#### Why not expose types such as `HAL` handles, `termios` or `TaskHandle_t` directly to the upper layer? Would that not be more direct?

That directness only brings the platform coupling forward. With these types in a public interface, upper-layer logic is immediately coupled to the lifetime and constraints of a particular SDK, OS or platform.

#### Does hiding platform types make the abstraction too empty to express anything?

No. A public interface should express capabilities and semantics, for example "this is a serial port", "this needs a completion behavior" or "a buffer is passed here", not which struct a platform uses internally to carry these capabilities. What an abstraction should do is keep the behavioral information and isolate the implementation details, rather than erase every detail.

#### What if a platform has a capability of its own? Can it not be exposed at all?

It can, but it should not pollute the main public interface. What platforms have in common stays in the public interface; platform-specific capabilities go into the platform implementation, an extension layer, or a dedicated entry point that clearly carries platform semantics. The aim is to keep the whole public interface from shifting for the special case of one platform.
