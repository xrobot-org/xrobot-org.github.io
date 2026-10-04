---
id: message-topic
title: Topic 基础、订阅与分发语义
sidebar_position: 1
---

# Topic 基础、订阅与分发语义

`Topic` 是 LibXR 消息系统的核心对象。它表示一条**进程内、精确类型**的发布订阅通道：

- 发布时会同步分发给已注册的订阅者；
- 支持同步、异步、队列、回调四种消费方式；
- 自身不保存最近一次消息；
- 类型约束由 `payload_type_id + payload_size + payload_alignment` 共同定义。

## 创建 Topic

通常用 `CreateTopic<T>()` 创建 Topic：

```cpp
LibXR::Topic::Domain domain("sensor");
auto topic = LibXR::Topic::CreateTopic<float>("temperature", &domain);
```

多个线程向同一个 Topic 发布时，创建时打开 `multi_publisher`：

```cpp
auto pressure = LibXR::Topic::CreateTopic<float>("pressure", &domain, true);
```

接口声明：

```cpp
template <typename Data>
static Topic CreateTopic(const char* name,
                         Domain* domain = nullptr,
                         bool multi_publisher = false);
```

同名 Topic 只在第一次调用时创建，之后的调用返回同一个 Topic：

- `multi_publisher` 由第一次创建决定；
- 再次获取时类型、大小或对齐与已有 Topic 不一致，或对已有的单发布者 Topic 请求 `multi_publisher`，触发 `REQUIRE` 终止（Release 构建同样生效）。

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

发布约束：

- 发布类型必须与 `Topic` 的精确类型契约一致；
- `Publish()` / `PublishFromCallback()` 接受非 const 左值；payload 类型须满足 `TopicPayload`：非引用、非 cv 的对象类型，可默认构造、可拷贝赋值、可平凡析构；
- `multi_publisher = false`（默认）的 Topic 只允许一个发布者，并发发布属于使用错误，发布路径用原子状态检测，Debug 构建下触发断言；
- `multi_publisher = true` 的 Topic 用 `Mutex` 串行化多个线程的发布，只能用 `Publish()`，调用 `PublishFromCallback()` 在 Debug 构建下触发断言；
- 需要在回调或中断中发布的 Topic 保持单发布者；
- `Topic` 本身只负责本次发布的分发，不保存 latest payload 副本。

## 订阅方式

### 同步订阅 `SyncSubscriber`

同步订阅者在 `Wait()` 挂起期间，把下一次发布的数据写入构造时传入的对象：

```cpp
float received = 0.0f;
auto sub = LibXR::Topic::SyncSubscriber<float>("temperature", received, &domain);

if (sub.Wait(1000) == LibXR::ErrorCode::OK)
{
    printf("%.2f\n", received);
}
```

特点：

- 数据直接写入构造时传入的 `received`；
- 同一时刻只允许一个挂起等待；
- `GetTimestamp()` 返回最近一次收到的消息时间戳；
- 只有 `Wait()` 挂起期间的发布会被接收，其余时间的发布被忽略；
- 按名称构造时调用 `WaitTopic(name, UINT32_MAX)`，Topic 尚未创建时一直阻塞；`ASyncSubscriber`、`QueuedSubscriber` 的按名称构造相同。

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

队列订阅者使用 `SPSCQueue`：

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

行为：

- 队列订阅者内部只保存 `queue` 指针，队列对象必须长期有效；
- 每次发布直接调用一次底层 `SPSCQueueBase::PushBytes()`；
- 如果队列塞不进去，这次发布会直接丢掉，不会阻塞发布者。

### 回调订阅 `Callback`

回调订阅在每次发布时立即执行函数。支持以下签名：

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
- 第二个参数是创建回调时传入的绑定参数，类型须与 `Create()` 的第二个实参完全一致：`void*` 参数对应 `static_cast<void*>(nullptr)`，直接传 `nullptr`（类型为 `std::nullptr_t`）会编译失败。

## 常用接口

| 接口 | 作用 |
|------|------|
| `CreateTopic<T>()` | 创建或查找一条精确类型 topic |
| `Find()` / `FindOrCreate<T>()` | 按名称查找 Topic；`FindOrCreate` 不存在时创建 |
| `Publish()` | 在普通上下文发布 |
| `PublishFromCallback()` | 在回调 / ISR 路径发布 |
| `SyncSubscriber` | 等待下一条消息写入外部对象 |
| `ASyncSubscriber` | 显式 `StartWaiting()` 后接收下一条 |
| `QueuedSubscriber` | 把每次发布塞进 `SPSCQueue` |
| `Callback::Create()` | 创建回调订阅句柄 |
| `RegisterCallback()` | 注册回调 |
| `WaitTopic()` | 按名称等待某条 topic 出现 |
| `PackData()` / `PackRaw()` | 按 Topic 的类型契约打包消息 |

## 使用建议

- 只要是普通强类型消息，优先用 `CreateTopic<T>()`，不要自己传 `sizeof(T)`。
- 如果只是“收到就处理”，优先用回调或同步订阅。
- 如果需要保留每次发布的历史，使用 `QueuedSubscriber + SPSCQueue`。
- 只关心下一条结果时用 `ASyncSubscriber`，每次取走数据后再次调用 `StartWaiting()`。
- 需要最近一次消息时，由模块保存订阅者收到的数据，例如在回调中更新一个成员变量。
- 进程间共享数据使用 [`LinuxSharedTopic`](./linux-shared-topic.md)，经串口或网络传输使用[数据打包与解析](./packet-server.md)。
