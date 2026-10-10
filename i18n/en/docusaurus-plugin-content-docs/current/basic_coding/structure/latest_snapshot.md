---
id: latest_snapshot
title: Latest-Value Mailbox
sidebar_position: 10
---

# LatestSnapshot (Latest-Value Mailbox)

`LibXR::LatestSnapshot<T>` is a single-producer, single-consumer mailbox that keeps only the latest complete value.

It suits data of which only the latest value matters. Taking a receive interrupt and a control thread as an example, the interrupt publishes once per feedback frame it receives, and the control thread reads at its own pace, always getting the most recent publication; when the control thread is late, an intermediate publication is overwritten by a later one instead of being queued up.

## Core features

- Three internal slots: a back slot owned by the producer, a front slot owned by the consumer, and a middle slot handed over through one atomic state, which carries the latest completed publication;
- repeated `Store()` calls may overwrite a middle value the consumer has not taken, but never the value the consumer is copying;
- the three slots are constructed with the object, and `LatestSnapshot` allocates no memory itself;
- the object is neither copyable nor movable.

## Common APIs

```cpp
template <typename T>
class LatestSnapshot
{
 public:
  explicit LatestSnapshot(const T& initial);

  void Store(const T& value);

  bool LoadLatest(T& output);
};
```

- `LatestSnapshot(initial)`: constructs all three slots with the same initial value, which `LoadLatest()` outputs before the first `Store()`;
- `Store(value)`: copies the value into the producer-owned back slot first, then releases that slot to the consumer as the newest middle slot;
- `LoadLatest(output)`: acquires a newer publication first; without one, `output` receives the value the consumer acquired last. It returns `true` when this call acquired a newer publication, otherwise `false`.

`T` must be copy-constructible and copy-assignable.

## Concurrency constraints

- `Store()` may only be called by the single producer, and `LoadLatest()` only by the single serialized consumer, one call at a time;
- producer and consumer calls may overlap on different cores or in thread and interrupt contexts, since the handover between them uses one 32-bit atomic state;
- the value is copied whole on publication, so a read always returns one complete value rather than a half-written one.

## Example

```cpp
struct Feedback
{
  uint32_t seq = 0;
  float position = 0.0f;
};

LibXR::LatestSnapshot<Feedback> feedback(Feedback{});

// Publish the latest feedback frame from the receive interrupt
void OnFeedbackFrame(const Feedback& frame)
{
  feedback.Store(frame);
}

// Read from the control thread; LoadLatest() returns true when a newer publication was acquired
void ControlStep()
{
  Feedback frame{};
  if (feedback.LoadLatest(frame))
  {
    // frame holds the latest feedback acquired by this call
  }
}
```

## Choosing between the structures

With one producer and one consumer where every publication has to be processed, use `SPSCQueue`; when only the latest value matters and intermediate ones may be dropped, use `LatestSnapshot`. With more than one on either side, use `MPMCQueue`.
