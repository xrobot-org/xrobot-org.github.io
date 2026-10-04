---
id: adv-coding-middleware-topic-design
title: Topic Design
sidebar_position: 1
---

# Topic Design

For basic usage, see [Topic](/en/docs/basic_coding/middleware/message/message-topic). This page
covers why the mechanism is split into these roles.

## What `Topic` is solving

`Topic` unifies the most common in-process handoff patterns: publishers write data, subscribers
consume it in different ways, and multi-publisher protection is added when needed. Shared memory
across processes is provided by `LinuxSharedTopic<T>`.

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
they represent four genuinely different consumption semantics. `SyncSubscriber` wakes the waiting
thread when new data arrives; `ASyncSubscriber` arms a wait, the next publish fills its local
buffer, and the subscriber reads it later; `QueuedSubscriber` writes every publish into a queue; a
callback subscriber runs its callback at publish time. If all of that were collapsed into one subscriber interface, the result would
either degenerate into the most conservative common subset or push too many branches into runtime.

## Dispatch

`Topic` dispatches each publish according to how each subscriber consumes it: all subscribers are
linked into the `Block`'s `LockFreeList`; synchronous subscribers are woken through a `Semaphore`,
asynchronous subscribers use their own state block, queued subscribers write into an `SPSCQueue`,
and callback subscribers run their callback. This fits in-process module handoff, log fan-out, and
state broadcast. Large payloads shared across processes, an explicit queue-full policy, or zero-copy
shared slots are provided by `LinuxSharedTopic<T>`.

## `WaitTopic` and domain

`Topic` names can be grouped by domain. `WaitTopic` waits until a topic appears in the matching
domain and returns its handle, for modules whose initialization order is not fixed. It performs
in-process discovery and binding.

## Positioning

`Topic` is an in-process publish-subscribe path with low overhead and multiple consumption forms,
used to let modules exchange data without exposing too much of each other's lifecycle.
