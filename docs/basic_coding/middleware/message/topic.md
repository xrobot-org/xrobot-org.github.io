---
id: message-topic
title: Topic 基础、订阅与分发语义
sidebar_position: 1
---

# Topic 基础、订阅与分发语义

`Topic` 是当前 LibXR 消息系统的核心对象。它表示一条**进程内、精确类型**的发布订阅通道：

- 发布时会同步分发给已注册的订阅者；
- 支持同步、异步、队列、回调四种消费方式；
- 自身**不再缓存最近一次消息**；
- 类型约束由 `payload_type_id + payload_size + payload_alignment` 共同定义。

如果你把旧版本里的 `Topic` 理解成“自带 latest cache 的轻量总线”，这条语义现在已经不成立。

## 创建 Topic

当前推荐写法是 `CreateTopic<T>()`：

```cpp
LibXR::Topic::Domain domain("sensor");
auto topic = LibXR::Topic::CreateTopic<float>("temperature", &domain);
```

如果需要多个发布者串行进入同一个 `Topic`，可以显式打开 `multi_publisher`：

```cpp
auto topic = LibXR::Topic::CreateTopic<float>("temperature", &domain, true);
```

对应的主线接口是：

```cpp
template <typename Data>
static Topic CreateTopic(const char* name,
                         Domain* domain = nullptr,
                         bool multi_publisher = false);
```

也可以直接用显式运行时契约构造：

```cpp
Topic(const char* name,
      TypeID::ID payload_type_id,
      size_t payload_size,
      size_t payload_alignment,
      Domain* domain = nullptr,
      bool multi_publisher = false);
```

这条接口主要给需要手动指定类型契约的底层场景使用。普通业务代码优先用 `CreateTopic<T>()`。

## 发布语义

普通上下文发布：

```cpp
float temp = 23.5f;
topic.Publish(temp);
```

带显式时间戳发布：

```cpp
topic.Publish(temp, LibXR::MicrosecondTimestamp(1000));
```

回调或 ISR 路径发布：

```cpp
topic.PublishFromCallback(temp, true);
topic.PublishFromCallback(temp, LibXR::MicrosecondTimestamp(2000), true);
```

当前 `Topic` 的发布约束是：

- 发布类型必须与 `Topic` 的精确类型契约一致；
- 普通发布路径使用 `Lock()` / `Unlock()` 串行化；
- `multi_publisher = false` 时优先走轻量原子快路径；
- `multi_publisher = true` 时改用 `Mutex` 串行化；
- `multi_publisher = true` 的主题只走线程中的普通 `Publish()`，不能使用 `PublishFromCallback()`；
- `Topic` 本身只负责本次发布的分发，不保存 latest payload 副本。

## 订阅方式

### 同步订阅 `SyncSubscriber`

同步订阅把收到的数据直接写入你提供的对象，然后通过 `Wait()` 等待下一次发布：

```cpp
float received = 0.0f;
auto sub = LibXR::Topic::SyncSubscriber<float>("temperature", received, &domain);

if (sub.Wait(1000) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", received);
}
```

特点：

- 不自己分配业务缓冲区，直接写入你传入的 `received`；
- 同一时刻只允许一个挂起等待；
- `GetTimestamp()` 返回最近一次收到的消息时间戳。

### 异步订阅 `ASyncSubscriber`

异步订阅是“先声明我要下一条，再自己来取”：

```cpp
auto sub = LibXR::Topic::ASyncSubscriber<float>(topic);
sub.StartWaiting();

topic.Publish(temp);

if (sub.Available())
{
    float value = sub.GetData();
}
```

特点：

- 只有在 `StartWaiting()` 之后，下一次发布才会被接收；
- `GetData()` 取走后，本地状态回到 `IDLE`；
- 如果不再次 `StartWaiting()`，后续发布会被忽略。

这类订阅者适合“我只关心下一条结果，不需要积压历史”的场景。

### 队列订阅 `QueuedSubscriber`

当前主线的队列订阅者只接受 `SPSCQueue`，不再使用旧的 `LockFreeQueue`：

```cpp
LibXR::SPSCQueue<float> queue(10);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);

float value = 0.0f;
if (queue.Pop(value) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", value);
}
```

如果希望连时间戳一起排队，可以让队列元素类型变成 `Topic::Message<T>`：

```cpp
LibXR::SPSCQueue<LibXR::Topic::Message<float>> queue(10);
auto sub = LibXR::Topic::QueuedSubscriber(topic, queue);
```

当前行为边界：

- 队列订阅者内部只保存 `queue` 指针，队列对象必须长期有效；
- 每次发布直接调用一次底层 `SPSCQueueBase::PushBytes()`；
- 如果队列塞不进去，这次发布会直接丢掉，不会阻塞发布者。

### 回调订阅 `Callback`

回调订阅在每次发布时立即执行函数。当前支持几类常用签名：

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
        // 原始 payload 视图
    },
    static_cast<void*>(nullptr));

topic.RegisterCallback(cb0);
topic.RegisterCallback(cb1);
topic.RegisterCallback(cb2);
```

其中：

- `T` / `T&` / `const T&`：直接按强类型 payload 收；
- `MessageView<T>`：同时拿到时间戳和 payload 指针；
- `RawMessageView` / `ConstRawData`：按 raw payload 视图收；
- 第一个参数 `bool in_isr` 用来区分当前是否处于 ISR 路径；
- 绑定参数 `void*` 是创建回调时传入的用户参数。

## `Topic` 现在不做什么

当前 `Topic` 明确**不负责**这些语义：

- 不保存最近一次消息缓存；
- 不提供 `DumpData()` 这一类 latest-value 导出接口；
- 不负责进程间共享、零拷贝共享槽位或持久化队列；
- 不保证队列订阅者在队满时保留全部历史消息。

如果你需要：

- 进程内 latest cache：请在模块内自己维护一份状态，或通过订阅者显式更新；
- 进程间共享 topic：请看 [`LinuxSharedTopic`](./linux-shared-topic.md)；
- 跨链路字节打包与解析：请看 [数据打包与解析](./packet-server.md)。

## 常用接口

| 接口 | 作用 |
|------|------|
| `CreateTopic<T>()` | 创建或查找一条精确类型 topic |
| `Publish()` | 在普通上下文发布 |
| `PublishFromCallback()` | 在回调 / ISR 路径发布 |
| `SyncSubscriber` | 等待下一条消息写入外部对象 |
| `ASyncSubscriber` | 显式 `StartWaiting()` 后接收下一条 |
| `QueuedSubscriber` | 把每次发布塞进 `SPSCQueue` |
| `Callback::Create()` | 创建回调订阅句柄 |
| `RegisterCallback()` | 注册回调 |
| `WaitTopic()` | 按名称等待某条 topic 出现 |
| `PackData()` / `PackRaw()` | 按当前 topic 契约打包消息 |

## 使用建议

- 只要是普通强类型消息，优先用 `CreateTopic<T>()`，不要自己传 `sizeof(T)`。
- 如果只是“收到就处理”，优先用回调或同步订阅。
- 如果需要保留每次发布的历史，使用 `QueuedSubscriber + SPSCQueue`。
- 如果只是关心下一条结果，用 `ASyncSubscriber`，并记得每次消费后再次 `StartWaiting()`。
- 如果旧代码还依赖 `DumpData()` 或 topic 内部 cache，这部分需要按当前主线语义重写。
