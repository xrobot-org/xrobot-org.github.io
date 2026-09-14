---
id: adv-coding-core-isr-thread-boundary
title: ISR、回调与线程边界
sidebar_position: 2
---

# ISR、回调与线程边界

基础说明见 [设计思想](/docs/concept)、[异步任务](/docs/basic_coding/system/async) 和 [Semaphore](/docs/basic_coding/system/semaphore)。下文直接收束实现里几条最容易跑偏的边界。

## 单核 MCU 里的并发来源

`LibXR` 里这个问题的关键从来不在“有没有多核”，而在于数据和状态怎样在 `ISR`、回调、线程之间交接。单核 MCU 同样有并发：任务会互相被调度打断，ISR 会抢占线程，DMA 和外设也会按自己的节奏推进。只要一条高频路径把等待、长临界区或者调度顺序依赖混进去，最后看到的通常就是时延抖动、状态错位，以及 timeout、reset 和 late completion 互相踩踏。

## ISR 负责什么

因此更稳妥的默认原则一直是：ISR 负责交接和推进，线程负责展开后续业务。所谓交接，指的是缓冲切换、计数和时间戳更新、端点 rearm、DMA 续传、把数据推进软件队列，以及唤醒 waiter 或 worker。这些动作只要边界明确、耗时可估计，就应该尽量在 ISR 或 callback 中完成。真正不该放进去的，是阻塞等待、复杂协议解析、资源申请，或者任何依赖线程唤醒顺序才能正确收尾的逻辑。

## 为什么默认不用 `mutex`

很多人第一反应会是 `mutex`，但它并不是 ISR-task 交换的默认原语。原因很直接：ISR 必须保持 non-blocking，而很多 RTOS 根本不允许在 ISR 中获取 `mutex`。即使勉强用临界区包装，最后也常常退化成关中断时间不可控的问题。所以更实际的默认选择是：task-task 之间用 `mutex` 或有界临界区；ISR-task 之间优先用 `FromISR` 原语、`SPSC ring`、mailbox 或 sequence；只有在测量证明值得的情况下，才上更重的 CAS/lock-free 结构。

## 原子操作的角色

这也引出另一个常见误解：`CAS` 和原子操作不是 SMP 专属。在单核 MCU 上，它们一样有价值，因为它们解决的是 ISR 抢占线程时的 read-modify-write 竞态、ownership 状态 claim，以及 `busy/pending/detached` 这类轻量状态交接。单核不等于没有竞态，只是竞态发生在上下文切换之间，而不是多个核心同时执行。

## `FromCallback` 和 ISR 不是一回事

回调上下文和 ISR 上下文也不能混为一谈。`FromCallback` 的意思是“当前需要 callback-safe 语义”，并不自动等于“此刻就在硬中断里”。这也是为什么现在更强调 `ASSERT_FROM_CALLBACK(...)`、`PostFromCallback(in_isr)` 和 `ActiveFromCallback(..., in_isr)`，而不是把所有 callback-safe 路径都粗暴地等同于 ISR。两者一旦混成一类，接口语义很快就会漂移：本来只需要 callback-safe 的路径，会被迫套上更严格的 ISR 约束；而真正只能在 ISR 里做的动作，也会因为边界不清而被错误地下沉到普通回调里。

## 为什么 `BLOCK` 不能进 ISR

`BLOCK` 在 ISR 中同样应该被视为硬错误，而不是“风格不好”。`BLOCK` 最终一定会走到 `sem->Wait(...)` 一类等待路径；一旦把这件事塞进 ISR，后果不是接口不优雅，而是系统直接失去边界。所以更合理的做法始终是：ISR 里只投递、切状态、post，真正等待结果的动作只留给线程上下文。`Operation::UpdateStatus()` 能通过 `PostFromCallback(in_isr)` 让完成通知 callback-safe，并不意味着 `BLOCK` 本身在 ISR 中也是合法的。

## freshness-first 场景

对控制和状态估计类场景来说，另一个很容易选错的地方是“是否该上深队列”。如果系统真正关心的是最新值，而不是保存每一个旧样本，那么默认更合适的结构通常是 `latest + seq` 或单槽 mailbox，而不是深队列。深队列适合完整保留样本、允许消费延迟的场景；在 freshness-first 路径里，它反而会把“旧但合法”的数据拖进系统。因此这类场景最好把 contract 直接写出来，例如“不得使用超过 2 个控制周期前的数据”“允许 `drop_oldest`”“必须暴露 overflow / drop 计数”。

## `ASync` 在这套边界里的位置

`ASync` 也应该放在这个边界里理解。它不是一个“任何耗时工作都能往里扔”的免责桶，而更像一个统一提交接口：在 callback 或 ISR 里只做短交接，再把后续工作延后。有线程的系统由工作线程执行；无线程实现通过软件 `Timer` 在后续刷新中运行任务。两种路径都使用同一套提交语义，但裸机并不会因此多出一条独立后台线程。

## 选择原则

如果要在工程里先快速做判断，可以记住一条简单标准：先问这一步是不是硬件交接的一部分，它的执行时间是不是短且可界定，以及它是否需要等待、分配资源或依赖调度顺序。前两条为“是”、第三条为“否”，通常就适合 ISR 或 callback；反过来，就应该尽量下沉到线程。
