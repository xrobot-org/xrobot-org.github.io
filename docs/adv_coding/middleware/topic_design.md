---
id: adv-coding-middleware-topic-design
title: Topic 设计
sidebar_position: 1
---

# Topic 设计

基础用法见 [Topic](/docs/basic_coding/middleware/message/message-topic)。本文说明这套机制为什么拆成现在这几个角色。

## `Topic` 解决的问题

`Topic` 把同一进程内几种最常见的数据交接方式统一起来：发布者写入，订阅者按需接收，多发布者时再加保护。进程间共享内存由 `LinuxSharedTopic<T>` 提供。

## `Block` 的角色

`Topic` 的核心结构是 `Block`，里面存放 payload 类型契约、名称 CRC32 键、订阅者链表，以及并发控制状态。它默认针对单发布者优化：没有开启 `multi_publisher` 时，用原子 `busy` 状态检查发布独占，并发发布会触发断言；开启后才改用 `Mutex`。多发布者模式用于线程中的普通 `Publish()`，不能用于 `PublishFromCallback()`。常见的单发布者场景因此不需要加锁。

## 最近值由谁保存

`Topic` 只负责“发布即分发”，`Block` 中不保存最近一次 payload 的副本。各部分的职责如下：

- `Topic` 负责把一次发布分发给各个订阅者；
- 需要 latest-value 语义时，由上层模块自己维护；
- packet 打包直接用调用者手里的 payload，不再经过 topic 内部缓存。

去掉缓存后，`Topic` 不必再同时充当“分发总线”和“缓存容器”。

## 订阅者为什么分类型

订阅者分成同步、异步、队列、回调四种，是因为它们对应四种不同的消费方式。`SyncSubscriber` 在新数据到达时唤醒等待的线程；`ASyncSubscriber` 发起等待后由下一次发布填充本地缓冲区，订阅方稍后查询并取走；`QueuedSubscriber` 把每次发布写入队列；回调订阅在发布时立即执行回调。如果合并成一个统一接口，要么只能取最保守的子集，要么把大量分支判断留到运行期。

## 分发方式

`Topic` 在发布时按订阅方式分发数据：各类订阅者都挂在 `Block` 的 `LockFreeList` 上，同步订阅用 `Semaphore` 唤醒，异步订阅使用自身的状态块，队列订阅写入 `SPSCQueue`，回调订阅直接执行回调。它适合进程内的模块交接、日志分发和状态广播。进程间共享大 payload、明确的队列满策略或零拷贝共享槽位由 `LinuxSharedTopic<T>` 提供。

## `WaitTopic` 和 domain

`Topic` 可以按 domain 分组命名。`WaitTopic` 等待某个主题在对应 domain 中出现后返回其句柄，用于模块初始化顺序不固定的情况。它在进程内完成主题的发现与绑定。

## 定位

`Topic` 是一条进程内、开销较低、可按消费方式分流的发布订阅通道，用于让不同模块在不共享过多生命周期细节的前提下交换数据。
