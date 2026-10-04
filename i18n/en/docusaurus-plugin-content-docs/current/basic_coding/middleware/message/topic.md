---
id: message-topic
title: Topic Basics, Subscription Models, and Dispatch Semantics
sidebar_position: 1
---

# Topic Basics, Subscription Models, and Dispatch Semantics

`Topic` is the core object of the LibXR message system. It represents one **in-process, exact-typed** publish-subscribe channel:

- each publish is dispatched synchronously to registered subscribers;
- it supports synchronous, asynchronous, queued, and callback consumption styles;
- it does not keep the latest message;
- the runtime contract is defined by `payload_type_id + payload_size + payload_alignment`.

If you remember the older `Topic` as a lightweight bus with a built-in latest cache, that is no longer the current mainline behavior.

## Creating a Topic

Topics are usually created with `CreateTopic<T>()`:

```cpp
LibXR::Topic::Domain domain("sensor");
auto topic = LibXR::Topic::CreateTopic<float>("temperature", &domain);
```

When several threads publish to the same topic, create it with `multi_publisher` enabled:

```cpp
auto pressure = LibXR::Topic::CreateTopic<float>("pressure", &domain, true);
```

Signature:

```cpp
template <typename Data>
static Topic CreateTopic(const char* name,
                         Domain* domain = nullptr,
                         bool multi_publisher = false);
```

A topic name is created on the first call; later calls return the same topic:

- `multi_publisher` is fixed by the first creation;
- getting it again with a different type, size, or alignment, or requesting `multi_publisher` on an existing single-publisher topic, stops at `REQUIRE` (also in Release builds).

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

Constraints:

- the published type must match the topic's exact runtime contract;
- `Publish()` / `PublishFromCallback()` take a non-const lvalue; the payload type satisfies `TopicPayload`: a non-reference, non-cv object type that is default-constructible, copy-assignable, and trivially destructible;
- a topic with `multi_publisher = false` (the default) has a single publisher; concurrent publishing is a usage error, detected through an atomic state and asserted in Debug builds;
- a topic with `multi_publisher = true` serializes publishers from several threads with a `Mutex` and is published with `Publish()` only; `PublishFromCallback()` on it asserts in Debug builds;
- a topic that is published from callbacks or interrupts keeps a single publisher;
- the topic itself only handles dispatch for the current publish and does not retain a latest payload copy.

## Subscription Models

### `SyncSubscriber`

While `Wait()` is pending, a synchronous subscriber copies the next published payload into the object passed to its constructor:

```cpp
float received = 0.0f;
auto sub = LibXR::Topic::SyncSubscriber<float>("temperature", received, &domain);

if (sub.Wait(1000) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", received);
}
```

Key points:

- the payload is copied directly into `received`, the object passed to the constructor;
- only one waiter is allowed at a time;
- `GetTimestamp()` returns the timestamp of the latest received publish;
- only publishes made while `Wait()` is pending are received; other publishes are ignored;
- the name-based constructor calls `WaitTopic(name, UINT32_MAX)` and blocks until the topic exists; the name-based constructors of `ASyncSubscriber` and `QueuedSubscriber` do the same.

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
- without another `StartWaiting()`, later publishes are ignored.

This subscriber suits cases that need only the next result rather than a history.

### `QueuedSubscriber`

Queued subscribers use `SPSCQueue`:

```cpp
LibXR::SPSCQueue<float> queue(10);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);

float value = 0.0f;
if (queue.Pop(value) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", value);
}
```

To queue the timestamp as well, use `Topic::Message<T>` as the element type:

```cpp
LibXR::SPSCQueue<LibXR::Topic::Message<float>> queue(10);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);
```

Behavior:

- the subscriber stores only a pointer to `queue`, so the queue object must outlive the subscriber;
- each publish directly calls one underlying `SPSCQueueBase::PushBytes()`;
- if the queue cannot accept the item, that publish is dropped immediately.

### `Callback`

Callback subscribers execute a function immediately on each publish. The callback factory supports these payload forms:

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

The first `bool in_isr` indicates whether the current path is in ISR context. The second parameter is the bound argument passed to `Create()`; its type must match that argument exactly, so a `void*` parameter takes `static_cast<void*>(nullptr)`, while a plain `nullptr` (type `std::nullptr_t`) fails to compile.

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
| `Find()` / `FindOrCreate<T>()` | Look up a topic by name; `FindOrCreate` creates it if missing |
| `Publish()` | Publish in normal context |
| `PublishFromCallback()` | Publish from callback / ISR context |
| `SyncSubscriber` | Wait for the next payload into an external object |
| `ASyncSubscriber` | Capture the next publish after `StartWaiting()` |
| `QueuedSubscriber` | Forward each publish into an `SPSCQueue` |
| `Callback::Create()` | Create a callback subscription handle |
| `RegisterCallback()` | Register a callback |
| `WaitTopic()` | Wait for a topic by name |
| `PackData()` / `PackRaw()` | Pack messages using the topic's type contract |

## Practical Guidance

- For ordinary typed business payloads, prefer `CreateTopic<T>()`; do not rebuild the old `sizeof(T)`-style topic pattern.
- For immediate delivery, use callbacks or synchronous subscribers.
- To keep every publish, use `QueuedSubscriber + SPSCQueue`.
- For only the next result, use `ASyncSubscriber` and call `StartWaiting()` again after each `GetData()`.
- If old code still depends on `DumpData()` or topic-owned cache semantics, that part needs to be rewritten to fit current mainline behavior.
