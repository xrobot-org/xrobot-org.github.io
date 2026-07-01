---
id: adv-coding-middleware-linux-shared-topic-design
title: LinuxSharedTopic Design
sidebar_position: 2
---

# LinuxSharedTopic Design

For the basic API, see the "Shared-Memory Topic (Linux)" page in the basic message-system section.
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

Preserves every published item. The cost is that one slow subscriber with a full queue reduces
overall publish success.

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

## 7. Positioning

`LinuxSharedTopic<T>` is the right tool when the requirement is inter-process communication, large
shared payloads, and zero-copy read-side behavior. Ordinary `Topic` remains the in-process,
lightweight publish-subscribe path. The two are related by topic semantics, but they are not the
same transport model.
