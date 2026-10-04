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

The data in this section and in section 9 was measured with the benchmark functions `RunOverloadBenchmarks()`, `RunStandardBenchmarks()` and `RunLatencyBenchmarks()` in `test/automatic/middleware/message/topic/` of the LibXR repository (the `linux_shm_bench` case of `libxr_test` runs only reduced versions of them). The measurements were taken on 2026-10-04 in the Docker container `ghcr.io/xrobot-org/docker-image-linux:main` (Ubuntu 24.04, g++ 13.3.0, Release build, 2 GB `/dev/shm`) on a WSL2 host (kernel 6.6.87.2, AMD Ryzen 7 8845H, 16 threads), with LibXR at dev commit a2f5f01. The tables show a single run; the values vary with the machine and its load.

`bench_overload.cpp` makes the subscriber sleep 50 µs after each message it takes; the publisher publishes continuously and does not retry failures; the subscriber queue holds 8 entries (64 KiB payload) or 4 (1 MiB payload). Latency is the time from publication until the subscriber takes the data:

| Payload | Mode | Published | Received | Average latency | p50 | p99 |
| --- | --- | --- | --- | --- | --- | --- |
| 64 KiB | `FULL` | 598 / 4000 | 598 | 1080 µs | 1026 µs | 2520 µs |
| 64 KiB | `DROP_OLD` | 4000 / 4000 | 530 | 387 µs | 180 µs | 2381 µs |
| 1 MiB | `FULL` | 167 / 256 | 167 | 470 µs | 433 µs | 1523 µs |
| 1 MiB | `DROP_OLD` | 256 / 256 | 143 | 364 µs | 338 µs | 934 µs |

Once the slow subscriber's queue is full, `FULL` makes further publications fail; every queued message is delivered, but it waits in the queue, so latency is higher. With `DROP_OLD` every publication succeeds, the subscriber queue drops old messages, the messages received are newer, and the average and median latency are lower. `FULL` fits when no sample may be lost, and `DROP_OLD` when new data must arrive as soon as possible, which matches the latest-value trade-off of control paths.

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

## 9. Latency under continuous publication and per-message acknowledgement

`bench_standard.cpp` publishes continuously; `bench_latency.cpp` waits for the subscriber's acknowledgement after each message before publishing the next. Both measure the time from publication until the subscriber takes the data, but the numbers mean different things. Results for a 64-byte payload (88-byte frame) with only the header and the first and last payload bytes written (transport mode), in the environment of section 6:

| Benchmark | Messages | Average | p50 | p95 | p99 |
| --- | --- | --- | --- | --- | --- |
| `bench_standard` (continuous) | 100000 | 54.9 µs | 0.81 µs | 374 µs | 777 µs |
| `bench_latency` (acknowledged) | 20000 | 47.1 µs | 33.6 µs | 104 µs | 293 µs |

Under continuous publication, the next message is usually already queued when the subscriber finishes the previous one, so taking it needs no wake-up and half of the samples take less than 1 µs; when publication outpaces consumption, messages pile up in the queue and the waiting time counts as latency, pushing p95 to hundreds of microseconds. The average therefore mostly reflects queueing and is not the delivery latency of a single message. With per-message acknowledgement, the subscriber waits on a futex every time, so latency includes wake-up and scheduling; the p50 of about 34 µs reflects how long one message takes from publication until it is taken. When comparing implementations or configurations, throughput comes from `bench_standard` and single-message latency from the percentiles of `bench_latency`.

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
