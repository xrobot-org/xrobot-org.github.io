---
id: adv-coding-middleware-topic-design
title: Topic 设计
sidebar_position: 1
---

# Topic 设计

基础用法见消息系统里的 `Topic`、`SyncSubscriber`、`ASyncSubscriber` 和 `QueuedSubscriber` 页面。本文说明这套机制为什么拆成现在这几个角色。

## `Topic` 解决的问题

`Topic` 把同一进程内几种最常见的数据交接方式统一起来：发布者写入，订阅者按需接收，多发布者时再加保护。它不涉及共享内存、进程间同步或持久队列，这些需求交给别的组件处理。

## `Block` 的角色

`Topic` 的核心结构是 `Block`，里面存放 payload 类型契约、名称 CRC32 键、订阅者链表，以及并发控制状态。它默认针对单发布者优化：没有开启 `multi_publisher` 时，只用一个原子 `busy` 状态做串行化；开启后才改用 `Mutex`。这样做是为了让常见的单发布者场景走轻量路径，而不是让所有发布都加锁。

## 为什么不再内置 latest cache

当前主线里，`Topic` 只负责“发布即分发”，不再在 `Block` 里保存最近一次 payload 副本。这样各部分职责更清楚：

- `Topic` 负责把一次发布分发给各个订阅者；
- 需要 latest-value 语义时，由上层模块自己维护；
- packet 打包直接用调用者手里的 payload，不再经过 topic 内部缓存。

去掉缓存后，`Topic` 不必再同时充当“分发总线”和“缓存容器”。

## 订阅者为什么分类型

订阅者分成同步、异步、队列、回调四种，是因为它们对应四种不同的消费方式。`SyncSubscriber` 是“有新数据时唤醒我”，`ASyncSubscriber` 是“我稍后自己来取最新结果”，`QueuedSubscriber` 是“把每次发布都排进队列”，回调订阅是“发布时立即触发我”。如果合并成一个统一接口，要么只能取最保守的子集，要么把大量分支判断留到运行期。

## 它不是严格的消息队列

`Topic` 更像一套“发布时按消费方式分发数据”的框架，而不是严格的消息队列：同步路径用 `Semaphore`，异步路径用状态块，队列路径用 `SPSCQueue`，回调路径挂在 `LockFreeList` 上。它适合进程内的模块交接、日志分发、状态广播。如果需要进程间共享大 payload、明确的 queue-full 策略或零拷贝共享槽位，请改用 `LinuxSharedTopic<T>`，而不是往 `Topic` 里堆系统级功能。

## `WaitTopic` 和 domain

`Topic` 可以按 domain 组织，不是全局平铺命名。`WaitTopic` 用来等待某个主题在对应 domain 中出现，而不是立刻拿到对象，适合模块初始化顺序不固定的情况。它提供的是进程内的轻量发现与绑定，不承担服务注册中心或跨进程目录的功能。

## 定位

`Topic` 是一条进程内、开销较低、可按消费方式分流的发布订阅通道，用于让不同模块在不共享过多生命周期细节的前提下交换数据。
