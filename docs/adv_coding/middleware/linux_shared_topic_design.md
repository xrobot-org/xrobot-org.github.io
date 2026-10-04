---
id: adv-coding-middleware-linux-shared-topic-design
title: LinuxSharedTopic 设计
sidebar_position: 2
---

# LinuxSharedTopic 设计

基础用法见 [共享内存 Topic（Linux）](/docs/basic_coding/middleware/message/message-linux-shared-topic)。本文说明它与普通 `Topic` 的分工，以及当前实现的取舍。

## 1. 为什么不直接改 `Topic`

`LinuxSharedTopic<T>` 面向 Linux / Webots 主机的进程间通信：大 payload 共享、零拷贝读取、多订阅者队列策略。`Topic` 面向进程内发布订阅，偏 MCU 和轻量系统，用精确类型分发、回调、同步/异步订阅者组织数据流。两者约束不同，所以共享内存语义没有塞回 `Topic`，而是单独实现为 `LibXR::LinuxSharedTopic<T>`，让 `Topic` 保持轻量，主机 IPC 也能沿共享内存模型独立演化。

## 2. 数据面和控制面分离

`LinuxSharedTopic<T>` 的核心结构分两层，而不是一条简单队列：

1. payload slot
   - 真实数据存放在共享内存槽位里
2. descriptor queue
   - 发布时只把“哪个 slot 可读”投递给订阅者

这样：

- payload 本体不需要在 publisher 和 subscriber 之间重复拷贝
- 每个订阅者只需消费描述符
- 同一个 slot 可被多个订阅者同时持有，直到最后一个释放

这是它实现零拷贝的前提。

---

## 3. 为什么热路径用 `atomic + futex`

这条实现的关键约束是：

- 热路径（发布与接收）不使用 mutex
- publish / consume 侧尽量只做原子状态推进
- 等待路径再用 futex 睡眠

发布和接收路径只做原子状态推进，需要等待时才通过 futex 睡眠。

## 4. 为什么用 refcount reclaim，而不是覆盖写

共享内存队列的一个危险场景是：publisher 想继续写，但某个 subscriber 还没读完旧数据。

这里按引用计数回收 slot：slot 用尽时发布失败，对发布者形成反压，不覆盖仍被订阅者持有的数据。代价是高压下 publisher 可能因 slot 耗尽而失败；好处是不会在 subscriber 仍持有数据时把 payload 覆盖掉。这是安全优先的取舍。

---

## 5. 三种订阅策略的取舍

订阅模式有三种，各自的目标和代价不同：

- `BROADCAST_FULL`
- `BROADCAST_DROP_OLD`
- `BALANCE_RR`

### `BROADCAST_FULL`

已经进入订阅者队列的内容不会为了给新消息让路而被覆盖；某个慢订阅者队列满时，新 publish 可能失败。代价是慢订阅者会直接形成 backpressure。

### `BROADCAST_DROP_OLD`

优先保住 publisher 吞吐，让慢订阅者更偏向读到新数据。代价是订阅者会丢旧样本。

### `BALANCE_RR`

在多个 worker 间均衡分发。同一条消息不会广播给每个 worker，所以它是共享负载模式，不是广播模式。

---

## 6. `FULL` 和 `DROP_OLD` 的实际差异

在慢订阅者过载场景下，两者的实际行为是：

- `DROP_OLD` 能保住 publisher throughput，同时明显降低 delivered sample latency
- `FULL` 保住队列内容完整，但 publish 成功率明显下降，延迟也会抬高

所以：所有样本都不能丢就选 `FULL`，要尽快拿到新数据就选 `DROP_OLD`。这和控制场景里 freshness-first 的取舍一致。

---

## 7. `BALANCE_RR` 的语义

`BALANCE_RR` 是独立的 balanced subscriber group，不是在广播路径上加个游标。

行为边界：

- 一个 publish 最多只投给一个 balanced subscriber
- 组内还有其他成员能接收时，队列已满的成员会被跳过
- balanced group 存在但没有任何 member 能接时，整个 publish 失败

它的语义是“一组 worker 共享消费同一 topic”，不是“广播之后顺便轮流处理”。

---

## 8. 失效订阅者回收与发布者接管

进程异常退出后，共享内存中可能遗留两类状态：

- 死掉的 subscriber 还占着 slot
- 死掉的 publisher 留下旧 segment

当前实现对两者都做了处理：

- dead subscriber recycle：subscriber 侧跟踪 owner identity
- stale publisher takeover：publisher 侧在 create-side reopen 时回收死进程遗留的 segment

---

## 9. 为什么 `latency_avg` 经常不值得直接看

standard-case 的 `latency_avg` 容易受 scheduler 和启动 backlog 污染：如果 publisher 一开始就灌数据、subscriber 还没进入稳态等待，`avg latency` 里会混进一段队列堆积时间，不等于单次投递延迟。

更有意义的区分是：

- saturated-throughput queueing latency：系统满载时的排队表现
- single-outstanding one-way latency：消息从 publish 到被 wait 成功拿到的单次路径

---

## 10. 句柄与共享布局的生命周期

共享 payload 的裸指针只能跟着对应的数据句柄使用。通过 subscriber 取得的句柄还依赖 subscriber 自身的 slot；正常退出时先释放活动数据，再销毁 subscriber，最后关闭 topic 映射。

所有参与进程还必须对 `T` 的布局、ABI 和共享内存配置有相同理解。`T` 适合放固定布局数据，不要把进程私有指针、`std::string` 这类拥有进程内资源的对象直接放进去。

---

## 11. 适用与不适用场景

适合：

- Linux 主机多进程共享大 payload
- 订阅者策略明确，需要 `FULL / DROP_OLD / RR`
- 希望避免用户态额外 payload 拷贝

不适合：

- MCU 侧 ISR 驱动路径
- 进程内轻量 publish/subscribe
- payload 不是 trivially copyable
