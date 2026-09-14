---
id: message-topic
title: Topic Basics, Subscription Models, and Dispatch Semantics
sidebar_position: 1
---

# Topic Basics, Subscription Models, and Dispatch Semantics

`Topic` is the core object of the current LibXR message system. It represents one **in-process, exact-typed** publish-subscribe channel:

- each publish is dispatched synchronously to registered subscribers;
- it supports synchronous, asynchronous, queued, and callback consumption styles;
- it **no longer caches the latest message** inside the topic itself;
- the runtime contract is defined by `payload_type_id + payload_size + payload_alignment`.

If you remember the older `Topic` as a lightweight bus with a built-in latest cache, that is no longer the current mainline behavior.

## Creating a Topic

The recommended entry point is now `CreateTopic<T>()`:

```cpp
LibXR::Topic::Domain domain("sensor");
auto topic = LibXR::Topic::CreateTopic<float>("temperature", &domain);
```

If you need multiple publishers to serialize through the same topic, enable `multi_publisher` explicitly:

```cpp
auto topic = LibXR::Topic::CreateTopic<float>("temperature", &domain, true);
```

The current mainline signature is:

```cpp
template <typename Data>
static Topic CreateTopic(const char* name,
                         Domain* domain = nullptr,
                         bool multi_publisher = false);
```

There is also a lower-level constructor using the explicit runtime type contract:

```cpp
Topic(const char* name,
      TypeID::ID payload_type_id,
      size_t payload_size,
      size_t payload_alignment,
      Domain* domain = nullptr,
      bool multi_publisher = false);
```

Most business code should prefer `CreateTopic<T>()` rather than manually passing type metadata.

## Publish Semantics

Normal-context publish:

```cpp
float temp = 23.5f;
topic.Publish(temp);
```

Publish with an explicit timestamp:

```cpp
topic.Publish(temp, LibXR::MicrosecondTimestamp(1000));
```

Publish from callback or ISR context:

```cpp
topic.PublishFromCallback(temp, true);
topic.PublishFromCallback(temp, LibXR::MicrosecondTimestamp(2000), true);
```

Current constraints:

- the published type must match the topic's exact runtime contract;
- normal publishing serializes through `Lock()` / `Unlock()`;
- with `multi_publisher = false`, the fast path uses the lightweight atomic lock state;
- with `multi_publisher = true`, the path falls back to `Mutex` serialization;
- the topic itself only handles dispatch for the current publish and does not retain a latest payload copy.

## Subscription Models

### `SyncSubscriber`

Synchronous subscribers write incoming payloads directly into the destination object you provide and then let you wait for the next publish:

```cpp
float received = 0.0f;
auto sub = LibXR::Topic::SyncSubscriber<float>("temperature", received, &domain);

if (sub.Wait(1000) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", received);
}
```

Key points:

- no internal business buffer is created; the payload is copied into `received` directly;
- only one waiter is allowed at a time;
- `GetTimestamp()` returns the timestamp of the latest received publish.

### `ASyncSubscriber`

Asynchronous subscribers are "arm first, pull later":

```cpp
auto sub = LibXR::Topic::ASyncSubscriber<float>(topic);
sub.StartWaiting();

topic.Publish(temp);

if (sub.Available())
{
    float value = sub.GetData();
}
```

Key points:

- only the next publish after `StartWaiting()` is captured;
- after `GetData()`, the state goes back to `IDLE`;
- if you do not call `StartWaiting()` again, later publishes are ignored.

This is useful when you only care about "the next result" rather than a full history.

### `QueuedSubscriber`

In current mainline, queued subscribers take `SPSCQueue`, not the old `LockFreeQueue`:

```cpp
LibXR::SPSCQueue<float> queue(10);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);

float value = 0.0f;
if (queue.Pop(value) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", value);
}
```

If you also want the timestamp in the queue, store `Topic::Message<T>` instead:

```cpp
LibXR::SPSCQueue<LibXR::Topic::Message<float>> queue(10);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);
```

Current behavior:

- the subscriber stores only a pointer to `queue`, so the queue object must outlive the subscriber;
- each publish directly calls one underlying `SPSCQueueBase::PushBytes()`;
- if the queue cannot accept the item, that publish is dropped immediately.

### `Callback`

Callback subscribers execute a function immediately on each publish. The current callback factory supports several common payload forms:

```cpp
auto cb0 = LibXR::Topic::Callback::Create(
    [](bool in_isr, void*, LibXR::MicrosecondTimestamp ts, float& data)
    {
        printf("%u %.2f\n", (unsigned)ts, data);
    },
    static_cast<void*>(nullptr));

auto cb1 = LibXR::Topic::Callback::Create(
    [](bool, void*, const LibXR::Topic::MessageView<float>& msg)
    {
        printf("%.2f\n", *msg.data);
    },
    static_cast<void*>(nullptr));

auto cb2 = LibXR::Topic::Callback::Create(
    [](bool, void*, const LibXR::ConstRawData& raw)
    {
        // raw payload view
    },
    static_cast<void*>(nullptr));

topic.RegisterCallback(cb0);
topic.RegisterCallback(cb1);
topic.RegisterCallback(cb2);
```

Supported payload forms include:

- `T` / `T&` / `const T&` for direct typed payload access;
- `MessageView<T>` for timestamp + payload pointer;
- `RawMessageView` / `ConstRawData` for raw payload views.

The first `bool in_isr` tells you whether the current path is in ISR context. The bound user argument is the value passed when creating the callback.

## What `Topic` No Longer Does

The current `Topic` deliberately does **not** provide these semantics:

- it does not store the latest payload value internally;
- it does not expose `DumpData()`-style latest-value export APIs;
- it does not implement cross-process shared topic semantics or persistent queue behavior;
- it does not guarantee that queued subscribers retain every publish when the queue is full.

If you need:

- an in-process latest cache: maintain that state explicitly in your own module;
- cross-process shared topics: use [`LinuxSharedTopic`](./linux-shared-topic.md);
- packet packing and parsing across transport links: use [Packet Packing and Parsing](./packet-server.md).

## Common Interfaces

| Interface | Purpose |
|------|------|
| `CreateTopic<T>()` | Create or look up one exact-typed topic |
| `Publish()` | Publish in normal context |
| `PublishFromCallback()` | Publish from callback / ISR context |
| `SyncSubscriber` | Wait for the next payload into an external object |
| `ASyncSubscriber` | Capture the next publish after `StartWaiting()` |
| `QueuedSubscriber` | Forward each publish into an `SPSCQueue` |
| `Callback::Create()` | Create a callback subscription handle |
| `RegisterCallback()` | Register a callback |
| `WaitTopic()` | Wait for a topic by name |
| `PackData()` / `PackRaw()` | Pack messages using the current topic contract |

## Practical Guidance

- For ordinary typed business payloads, prefer `CreateTopic<T>()`; do not rebuild the old `sizeof(T)`-style topic pattern.
- If you only need immediate delivery, prefer callbacks or synchronous subscribers.
- If you need history, use `QueuedSubscriber + SPSCQueue`.
- If you only care about the next result, use `ASyncSubscriber` and remember to call `StartWaiting()` again after consumption.
- If old code still depends on `DumpData()` or topic-owned cache semantics, that part needs to be rewritten to fit current mainline behavior.
