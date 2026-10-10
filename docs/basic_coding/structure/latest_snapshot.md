---
id: latest_snapshot
title: 最新值邮箱
sidebar_position: 10
---

# LatestSnapshot（最新值邮箱）

`LibXR::LatestSnapshot<T>` 是单生产者、单消费者的邮箱，只保留最新一份完整值。

它适用于只关心最新数据的场合。以接收中断与控制线程为例：中断每收到一帧反馈就发布一次，控制线程按自己的节奏读取，读到的始终是最近一次发布的值；控制线程来不及读取时，中间的发布被后来的覆盖，不排队、不积压。

## 核心特性

- 内部三个槽：生产者独占后槽，消费者独占前槽，中间槽由一个原子状态交给对方，承载最新一次完成的发布；
- 连续的 `Store()` 可以覆盖消费者尚未取走的中间值；消费者正在拷贝的值在它独占的前槽里，不受影响；
- 三个槽随对象构造，`LatestSnapshot` 自身不分配内存；
- 对象不可拷贝、不可移动。

## 常用接口

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

- `LatestSnapshot(initial)`：用同一个初始值构造三个槽；第一次 `Store()` 之前，`LoadLatest()` 输出这个初始值；
- `Store(value)`：先把值拷入生产者独占的后槽，再把该槽作为最新的中间槽交给消费者；
- `LoadLatest(output)`：有新的发布时先取得它，没有时 `output` 得到消费者上一次取得的值；本次取得了新的发布时返回 `true`，否则返回 `false`。

`T` 须可拷贝构造、可拷贝赋值。

## 并发约束

- `Store()` 只能由唯一的生产者调用，`LoadLatest()` 只能由唯一的消费者串行调用，同一时刻只有一次调用；
- 生产者和消费者的调用可以在不同核、线程或中断中重叠，两者的交接用一个 32 位原子状态完成；
- 值在发布时整体拷贝，因此每次读到的都是一份完整的值。

## 使用示例

```cpp
struct Feedback
{
  uint32_t seq = 0;
  float position = 0.0f;
};

LibXR::LatestSnapshot<Feedback> feedback(Feedback{});

// 接收中断中发布最新的反馈帧
void OnFeedbackFrame(const Feedback& frame)
{
  feedback.Store(frame);
}

// 控制线程中读取；本次取到新的发布时 LoadLatest() 返回 true
void ControlStep()
{
  Feedback frame{};
  if (feedback.LoadLatest(frame))
  {
    // frame 是本次取得的最新反馈
  }
}
```

## 选择建议

生产者与消费者各只有一个、且每次发布都必须被处理时用 `SPSCQueue`；只关心最新值、中间值可以丢弃时用 `LatestSnapshot`。任一侧不止一个时使用 `MPMCQueue`。
