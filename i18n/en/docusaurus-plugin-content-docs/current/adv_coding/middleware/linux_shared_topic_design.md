---
id: adv-coding-middleware-linux-shared-topic-design
title: LinuxSharedTopic Design
sidebar_position: 2
---

# LinuxSharedTopic Design

For the basic API, see
[Shared-Memory Topic (Linux)](/en/docs/basic_coding/middleware/message/message-linux-shared-topic).
The material below covers the boundary between `LinuxSharedTopic<T>` and ordinary `Topic`, and the
tradeoffs behind the current implementation.

## 1. Why it is kept separate from `Topic`

`LinuxSharedTopic<T>` solves Linux / Webots inter-process communication, large-payload sharing,
zero-copy reads, and per-subscriber queue policy. The original `Topic` is closer to in-process
publish-subscribe with MCU-oriented semantics: exact-typed dispatch, callbacks, synchronous or
asynchronous subscribers, and lightweight queues. Those two paths operate under different
constraints, so shared-memory semantics were not pushed back into `Topic`. Keeping them separate
lets `Topic` stay light while Linux IPC evolves along its own model.

## 2. Separating data plane and control plane

`LinuxSharedTopic<T>` uses two layers rather than a single queue. The payload slot holds the real
data in shared memory. The descriptor queue carries only "which slot is readable" to each
subscriber, which is what publish pushes.

This has three consequences:

- the payload itself is not copied again between publisher and subscriber
- each subscriber only consumes descriptors
- the same slot can be held by multiple subscribers until the last reference is released

That is the basis for zero-copy behavior.

## 3. Why the hot path uses `atomic + futex`

The implementation works under these constraints:

- no mutex on the hot path
- the publish and consume sides advance state mostly with atomics
- only the waiting path sleeps with futex

The goal is not to eliminate waiting entirely, but to keep mutex off the publish/consume hot path
and compress real waiting into futex sleep.

## 4. Why slot reclaim is refcount-based instead of overwrite

A dangerous case in a shared-memory queue is when the publisher wants to keep writing while a
subscriber is still reading the old payload.

The chosen model is refcounted slot reclamation with backpressure on the publisher when slots are
exhausted, rather than overwrite while in use. The cost is that under high pressure the publisher
may fail because slots are exhausted. In exchange, a payload is never overwritten while a subscriber
still holds it. This prioritizes safety over publish availability.

## 5. What the three subscription policies trade off

The subscription modes are:

- `BROADCAST_FULL`
- `BROADCAST_DROP_OLD`
- `BALANCE_RR`

They optimize for different goals.

### `BROADCAST_FULL`

Items already queued for the subscriber are not overwritten to make room for a newer one. When a
slow subscriber queue is full, a new publish may fail and backpressure the publisher.

### `BROADCAST_DROP_OLD`

Preserves publisher throughput as much as possible and lets slow subscribers bias toward newer data.
The cost is that old samples are dropped.

### `BALANCE_RR`

Distributes load across multiple workers. The same message is not broadcast to every worker, so this
is a shared-load mode rather than a broadcast mode.

## 6. The practical difference between `FULL` and `DROP_OLD`

Under a slow-subscriber overload, the two modes behave differently:

- with `FULL`, the slow subscriber's full queue directly turns into publisher backpressure
- with `DROP_OLD`, the slow subscriber loses history but keeps tracking newer data

The choice is about whether the system values complete delivery more than freshness and throughput.

## 7. `BALANCE_RR` semantics

`BALANCE_RR` forms a separate balanced subscriber group; it is not a cursor added to the broadcast
path.

- one publish is delivered to at most one balanced subscriber;
- a member whose queue is full is skipped while another member can accept;
- when a balanced group exists but no member can accept, the whole publish fails.

The group shares the consumption of one topic among several workers.

## 8. Stale subscriber recycling and publisher takeover

After a process exits abnormally, shared memory can retain two kinds of state: a dead subscriber
still holding slots, and a segment left by a dead publisher. Each subscriber slot records its owner
identity (PID and process start time), so slots of dead subscribers are recycled; when the
publisher creates the topic and finds a segment left by a dead process, it reclaims that segment.

## 9. Why `latency_avg` is often not meaningful on its own

The standard-case `latency_avg` is easily skewed by the scheduler and the startup backlog: when the
publisher starts sending before the subscriber has settled into waiting, the average includes time
spent queued and differs from the latency of a single delivery.

Two measurements are more meaningful:

- saturated-throughput queueing latency: queueing behavior when the system is fully loaded
- single-outstanding one-way latency: the path of one message from publish until a wait returns it

## 10. Handle and shared-layout lifetime

A raw payload pointer is valid only while its data handle remains valid. Handles obtained through a
subscriber also depend on that subscriber slot. On an orderly shutdown, release active data first,
then destroy subscribers, then close the topic mapping.

Every process also needs the same understanding of `T` layout, ABI, and shared-memory configuration.
Use fixed-layout payloads; process-private pointers and owning objects such as `std::string` do not
become valid cross-process state merely because the outer object lives in shared memory.

## 11. Where it fits

Suitable for:

- sharing large payloads between processes on a Linux host
- explicit subscriber policies (`FULL / DROP_OLD / RR`)
- avoiding extra user-space payload copies

Not suitable for:

- ISR-driven paths on an MCU
- lightweight in-process publish/subscribe
- payloads that are not trivially copyable
