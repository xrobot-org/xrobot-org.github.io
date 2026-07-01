---
id: adv-coding-middleware-topic-design
title: Topic Design
sidebar_position: 1
---

# Topic Design

For the basic usage, see the `Topic`, `SyncSubscriber`, `ASyncSubscriber`, and `QueuedSubscriber`
pages in the message system section. This page covers why the mechanism is split into these roles.

## What `Topic` is solving

`Topic` unifies the most common in-process handoff patterns with as little overhead as possible:
publishers write data, subscribers consume it in different ways, and multi-publisher protection can
be enabled when needed. It does not cover Linux shared memory, process-to-process synchronization,
or durable queue semantics, which are beyond the scope of this lightweight component.

## The role of `Block`

At the source level, `Block` is the central structure inside `Topic`. It stores the payload type
contract, the topic-name CRC32 key, the subscriber lists, and the state used to coordinate
concurrent access. By default it optimizes the single-publisher path: if `multi_publisher` is not
explicitly enabled, it only uses a lightweight atomic `busy` state for serialization. Only when
multi-publisher mode is enabled does it fall back to `Mutex`. This means `Topic` optimizes for the
common single-publisher case rather than forcing every publish onto a locked path.

## Why there is no built-in latest cache anymore

In current mainline, `Topic` has a stricter publish-and-dispatch role and no longer stores a latest
payload copy inside `Block`. Responsibilities are split as follows:

- `Topic` handles fan-out of one publish to different subscriber forms;
- latest-value semantics, when needed, are maintained explicitly by the upper layer;
- packet packing works directly from the payload the caller already holds instead of routing through
  a topic-owned cache.

This removes the overlap that existed when `Topic` acted as both a dispatch path and a cache
container.

## Why subscribers are split by type

The subscriber types are split into synchronous, asynchronous, queued, and callback variants because
they represent four genuinely different consumption semantics. `SyncSubscriber` means "wake me when
new data arrives". `ASyncSubscriber` is closer to "I will fetch the latest result later".
`QueuedSubscriber` means "enqueue every publish". Callback subscription means "invoke me immediately
at publish time". If all of that were collapsed into one subscriber interface, the result would
either degenerate into the most conservative common subset or push too many branches into runtime.

## Why it is not a strict message queue

From a concurrency point of view, `Topic` dispatches published data into different consumption
forms rather than acting as a strict message queue. The synchronous path uses `Semaphore`, the
asynchronous path uses small state blocks, the queue path uses `SPSCQueue`, and callback subscribers
are linked through `LockFreeList`. This fits in-process module handoff, log fan-out, or state
broadcast. For shared large payloads across processes, explicit queue-full policy, or zero-copy
shared slots, switch to `LinuxSharedTopic<T>` rather than adding system-level semantics to `Topic`.

## `WaitTopic` and domain

`Topic` is not named on a single global flat plane. It can be organized by domain, and `WaitTopic`
does not fetch an object immediately: it waits for a topic to appear in the matching domain. This
handles module organization when initialization order is not completely fixed. It provides
lightweight in-process discovery and binding, not a service registry or a cross-process directory.

## Positioning

`Topic` is an in-process publish-subscribe path with low overhead and multiple consumption forms,
used to let modules exchange data without exposing too much of each other's lifecycle.
