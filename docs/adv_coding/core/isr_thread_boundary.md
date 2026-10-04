---
id: adv-coding-core-isr-thread-boundary
title: ISR、回调与线程边界
sidebar_position: 2
---

# ISR、回调与线程边界

基础说明见 [设计思想](/docs/concept)、[异步任务](/docs/basic_coding/system/async) 和 [Semaphore](/docs/basic_coding/system/semaphore)。本文说明 ISR、回调与线程之间的分工。

## 单核 MCU 里的并发来源

单核 MCU 同样存在并发：任务会被调度打断，ISR 会抢占线程，DMA 和外设按各自的节奏推进。`LibXR` 关注的是数据和状态如何在 ISR、回调和线程之间交接。高频路径中一旦混入等待、长临界区或对调度顺序的依赖，常见后果是时延抖动、状态错位，以及超时、复位与迟到完成之间相互干扰。

## ISR 负责什么

默认分工是：ISR 负责交接和推进，线程负责后续业务。所谓交接，指的是缓冲切换、计数和时间戳更新、端点 rearm、DMA 续传、把数据推进软件队列，以及唤醒 waiter 或 worker。这些动作边界明确、耗时可估计，在 ISR 或回调中完成。不放进 ISR 的是阻塞等待、复杂协议解析、资源申请，或者任何依赖线程唤醒顺序才能正确收尾的逻辑。

## 为什么默认不用 `mutex`

ISR 与任务之间交换数据时，LibXR 默认不使用 `mutex`：ISR 不能阻塞，多数 RTOS 也不允许在 ISR 中获取 `mutex`，改用临界区包装又会使关中断时间难以界定。任务之间使用 `mutex` 或有界临界区；ISR 与任务之间优先使用 `FromISR` 原语、SPSC 环形队列、mailbox 或序号（sequence）；更复杂的 CAS/无锁结构只在测量表明有收益时采用。

## 原子操作的角色

`CAS` 和原子操作在单核 MCU 上同样需要，它们解决的是 ISR 抢占线程时的 read-modify-write 竞态、ownership 状态 claim，以及 `busy/pending/detached` 这类轻量状态交接。单核系统的竞态发生在上下文切换之间。

## `FromCallback` 和 ISR 不是一回事

回调上下文和 ISR 上下文也不能混为一谈。`FromCallback` 的意思是“当前需要 callback-safe 语义”，并不自动等于“此刻就在硬中断里”。这也是为什么现在更强调 `ASSERT_FROM_CALLBACK(...)`、`PostFromCallback(in_isr)` 和 `ActiveFromCallback(..., in_isr)`，而不把所有 callback-safe 路径都等同于 ISR。两者一旦混成一类，接口语义很快就会漂移：本来只需要 callback-safe 的路径，会被迫套上更严格的 ISR 约束；而真正只能在 ISR 里做的动作，也会因为边界不清而被错误地下沉到普通回调里。

## 为什么 `BLOCK` 不能进 ISR

在 ISR 中使用 `BLOCK` 是错误用法。`BLOCK` 最终一定会走到 `sem->Wait(...)` 一类等待路径；在 ISR 中等待会破坏上述边界，因此 ISR 里只投递、切换状态和 post，等待结果只在线程上下文中进行。`Operation::UpdateStatus()` 能通过 `PostFromCallback(in_isr)` 让完成通知 callback-safe，并不意味着 `BLOCK` 本身在 ISR 中也是合法的。

## freshness-first 场景

对控制和状态估计类场景来说，另一个很容易选错的地方是“是否该上深队列”。如果系统真正关心的是最新值，而不是保存每一个旧样本，那么默认更合适的结构通常是 `latest + seq` 或单槽 mailbox，而不是深队列。深队列适合完整保留样本、允许消费延迟的场景；在 freshness-first 路径里，它反而会把“旧但合法”的数据拖进系统。因此这类场景最好把 contract 直接写出来，例如“不得使用超过 2 个控制周期前的数据”“允许 `drop_oldest`”“必须暴露 overflow / drop 计数”。

## `ASync` 在这套边界里的位置

`ASync` 在这一分工中是统一的提交接口：回调或 ISR 只做短交接，再通过 `AssignJobFromCallback(job, in_isr)` 把后续工作交给 `ASync`。有线程的系统中由工作线程执行；没有线程的系统（定义 `LIBXR_NOT_SUPPORT_MUTI_THREAD`）中由软件 Timer 在普通上下文中执行，长任务会延后同一 Timer 上的其他回调。

## 选择原则

判断一项工作放在何处，可依次考察三点：它是否属于硬件交接的一部分；执行时间是否短且有界；是否需要等待、分配资源或依赖调度顺序。前两点成立且第三点不成立时，放在 ISR 或回调中；否则放到线程中执行。
