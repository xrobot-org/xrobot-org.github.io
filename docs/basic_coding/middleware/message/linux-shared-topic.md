---
id: message-linux-shared-topic
title: 共享内存 Topic（Linux）
sidebar_position: 3
---

# 共享内存 Topic（Linux）

`LibXR::LinuxSharedTopic<T>` 是 `Topic` 在 Linux / Webots 下的进程间共享内存派生实现。它把 payload 放到共享内存里，用原子变量和 futex 完成发布/接收同步，适合主机侧高频进程间通信，而不是 MCU 侧 ISR 驱动路径。

## 适用范围

- 只在 `Linux` / `Webots` 系统配置下可用；
- `TopicData` 必须是 `trivially copyable` 类型；
- 这是一条**主机进程间**通信路径，不是普通 `Topic` 的跨平台替代品。

## 配置结构

```cpp
struct LinuxSharedTopicConfig
{
  uint32_t slot_num = 64;
  uint32_t subscriber_num = 8;
  uint32_t queue_num = 64;
};
```

- `slot_num`：共享 payload 槽位数；
- `subscriber_num`：最大订阅者数量；
- `queue_num`：每个订阅者的描述符队列长度。

## 发布者构造

发布者模式会创建或接管共享 Topic：

```cpp
struct Frame {
  uint32_t seq;
  uint32_t checksum;
  uint8_t payload[128];
};

LibXR::LinuxSharedTopicConfig config;
config.slot_num = 64;
config.subscriber_num = 8;
config.queue_num = 64;

LibXR::LinuxSharedTopic<Frame> topic("vision_frame", config);
ASSERT(topic.Valid());
```

如果要显式指定域，可以继续传入域名或 `Topic::Domain`：

```cpp
LibXR::LinuxSharedTopic<Frame> topic("vision_frame", "vision", config);
```

## 附着模式

不带 `config` 的构造函数是**附着模式**，只打开已有共享 Topic，不具备发布者身份：

```cpp
LibXR::LinuxSharedTopic<Frame> attach_only("vision_frame");
ASSERT(attach_only.Valid());
```

附着模式调用 `CreateData()` 会返回 `ErrorCode::STATE_ERR`，不能直接拿它当发布者用。

## 订阅模式

```cpp
enum class LinuxSharedSubscriberMode : uint8_t
{
  BROADCAST_FULL = 0,
  BROADCAST_DROP_OLD = 1,
  BALANCE_RR = 2,
};
```

### `BROADCAST_FULL`

- 向该订阅者广播；
- 队列满时，当前发布失败。

### `BROADCAST_DROP_OLD`

- 向该订阅者广播；
- 队列满时，丢弃最旧描述符，保留最新消息。

### `BALANCE_RR`

- 参与 RR 负载均衡组；
- 每次发布只会投给平衡组中的一个订阅者。

## 订阅者用法

按名称构造的订阅者附着到已存在的共享 Topic；发布者尚未创建该 Topic 时，构造出的订阅者无效（`Valid()` 为 `false`）。

### 方式一：`Wait()` 后直接从订阅者取数据

```cpp
using Topic = LibXR::LinuxSharedTopic<Frame>;
using Subscriber = Topic::SyncSubscriber;

Subscriber sub("vision_frame", LibXR::LinuxSharedSubscriberMode::BROADCAST_FULL);
ASSERT(sub.Valid());

if (sub.Wait(1000) == ErrorCode::OK) {
  const Frame* frame = sub.GetData();
  // ... 使用 frame ...
  sub.Release();
}
```

这种方式下：

- `GetData()` 返回当前持有槽位的只读指针；
- 用完后必须显式 `Release()`。

### 方式二：通过 `SharedData` 句柄接收

```cpp
using Topic = LibXR::LinuxSharedTopic<Frame>;
using SharedData = Topic::Data;
using Subscriber = Topic::SyncSubscriber;

Subscriber sub("vision_frame");
SharedData data;

if (sub.Wait(data, 1000) == ErrorCode::OK) {
  const Frame* frame = data.GetData();
  // ... 使用 frame ...
  data.Reset();
}
```

这种方式下槽位由 `SharedData` 句柄管理，`Reset()` 或析构时会自动释放。

## 发布用法

### 方式一：直接按值发布

```cpp
Frame frame = {};
frame.seq = 1;

topic.Publish(frame);
```

这条路径会先申请一个槽位，再把 `frame` 复制进去并发布。

### 方式二：先申请槽位，再原地填充

```cpp
using Topic = LibXR::LinuxSharedTopic<Frame>;
using SharedData = Topic::Data;

SharedData data;
if (topic.CreateData(data) == ErrorCode::OK) {
  Frame* frame = data.GetData();
  frame->seq = 2;
  topic.Publish(data);
}
```

这条路径适合 payload 较大、希望减少一次额外拷贝的场景。

## 常用观测接口

### 发布者

- `Valid()`：是否成功打开；
- `GetError()`：打开阶段错误码；
- `GetSubscriberNum()`：当前活跃订阅者数量；
- `GetPublishFailedNum()`：累计发布失败次数；
- `Remove(name)`：删除对应共享内存对象。

### 订阅者

- `Valid()`：订阅者是否有效；
- `GetPendingNum()`：当前排队待消费消息数；
- `GetDropNum()`：累计丢弃消息数；
- `GetSequence()`：当前消息序号；
- `GetTimestamp()`：当前消息时间戳。

### 数据句柄

- `Valid()` / `Empty()`：句柄是否有效；
- `GetSequence()`：消息序号；
- `GetTimestamp()`：消息时间戳（订阅者取得的句柄）；
- `GetData()`：payload 指针；
- `Reset()`：释放槽位。

## 与普通 `Topic` 的区别

- 普通 `Topic` 面向进程内发布订阅；
- `LinuxSharedTopic<T>` 面向 Linux 主机进程间通信；
- 普通 `Topic` 是进程内精确类型分发路径，本体不保存 latest payload 缓存；
- `LinuxSharedTopic<T>` 的 payload 固定驻留在共享内存槽位中；
- 普通 `Topic` 的订阅模型强调回调/同步/异步语义；
- `LinuxSharedTopic<T>` 额外引入了每订阅者队列策略和 `BALANCE_RR`。

## 使用建议

- 如果只是同一进程内模块解耦，优先用普通 `Topic`；
- 如果需要 Linux 主机进程间共享大 payload，再考虑 `LinuxSharedTopic<T>`；
- 发布者和订阅者都要显式处理槽位生命周期，尤其是 `Wait() + GetData()` 这一种写法。
