---
id: adv-coding-core-rw-semantics
title: IO 完成语义与 Port 状态机
sidebar_position: 1
---

# IO 完成语义与 Port 状态机

基础 API 见 [IO 读写抽象](/docs/basic_coding/core/core-rw) 和 [Operation 操作模型](/docs/basic_coding/core/core-op)。下文直接讨论这套 I/O 完成模型为什么这样组织。

`LibXR` 当前这套 I/O 完成模型可以看成三层：`Operation` 描述这次操作完成后该怎样反馈，`ReadPort / WritePort` 负责队列、busy 状态和完成交接，具体驱动只负责把硬件推进到“接受请求”或“完成请求”这两个边界。真正复杂的状态机留在 `Port`，而不是绑在 `Operation` 上。

`Operation` 故意被做成体积很小、可平凡拷贝的对象，只携带完成方式本身：`CALLBACK`、`BLOCK`、`POLLING` 或 `NONE`，外加对应的小型数据载体。这样做的目的，就是避免把复杂生命周期、waiter 归属、timeout 后交接之类的状态机塞进 `Operation` 本体。否则它一旦变成重对象，不仅复制和传递成本会上升，驱动层和端口层的边界也会开始混乱。

对 `BLOCK` 来说，这一点尤其重要。`Operation::UpdateStatus()` 在 `BLOCK` 模式下只负责 `sem->PostFromCallback(in_isr)`，并不会把最终 `ErrorCode` 本身塞进信号量语义里。最终结果仍由端口侧的 `block_result_` 交接。换句话说，信号量在这里表达的是“可以醒来检查归属了”，而不是“这次操作必然已经合法完成了”。这正是为了把最危险的问题挡住：一个已经 timeout 返回的 waiter，后面又被迟到完成再次 `post`，于是同一个 semaphore 出现多次唤醒，旧 token 被新调用误认成当前完成。`BLOCK timeout` 首先要防的，就是这种“post 了已经超时返回的信号量”的情况。

## 1. `ReadPort` 的状态机

`ReadPort` 当前的核心状态有：

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 没有挂起读，也没有待交接完成 |
| `PENDING` | 请求已交给底层推进，等待队列侧完成 |
| `BLOCK_CLAIMED` | 当前 `BLOCK` 唤醒已经归这次 waiter 所有 |
| `BLOCK_DETACHED` | timeout 或 reset 已把 waiter 分离，完成侧必须静默 |
| `EVENT` | 数据先到、waiter 还没挂起；下一次调用必须先重查队列 |

这里最容易被误解的是 `EVENT`。它表示的不是“读完成”，而是：

- 数据先进入了软件队列
- 但当时还没有可认领的挂起读请求

所以后续调用方必须重新检查一次 `queue_data_`，而不是盲目重新下发底层读。

---

## 2. `WritePort` 的状态机

`WritePort` 的状态机和 `ReadPort` 不同，因为写路径多了“提交队列所有权”这件事。

核心状态有：

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 没有活动提交者，也没有挂起中的 `BLOCK` waiter |
| `LOCKED` | 当前提交路径占有队列修改权 |
| `BLOCK_WAITING` | 一个 `BLOCK` waiter 已经挂起，但完成还没 claim |
| `BLOCK_CLAIMED` | 最终唤醒已经归当前 waiter 所有 |
| `BLOCK_DETACHED` | timeout/reset 已把 waiter 分离，完成侧不能再 post |

这里的关键点是：多线程并发写安全并不靠无锁队列本身，真正的外层安全边界是 `busy_` 这道原子门。多个线程不会同时直接冲进驱动 `WriteFun()` 抢底层硬件；只有拿到 `LOCKED` 的那一条路径，才拥有这次提交的队列修改权和 kickoff 权。

---

## 3. 端口眼里的“成功”是什么意思

端口层里最重要的一条约定是：

- 驱动返回 `PENDING`：表示“底层已接受，完成以后再交接”
- 驱动返回非 `PENDING`：表示“这次调用已经终结”

这就是当前契约里“non-`PENDING` is terminal”的含义。

它直接带来两个后果：

1. 如果驱动声称自己没进入 `PENDING`，端口不会再替它维护后续完成语义
2. 如果驱动在返回非 `PENDING` 后，底层其实还在后台继续跑，就会出现语义错位

因此驱动设计里必须非常明确：什么时刻算“已经交给硬件”，什么时刻又只是暂时 busy、还没真正接单。`PENDING` 和 non-`PENDING` 的边界一旦划错，端口会以为这次调用已经终结，但底层还在后台继续推进，结果 `BUSY / TIMEOUT / late completion` 全部缠在一起。很多看上去像队列 bug 的问题，其实都出在这里没有钉牢。

## 4. `BLOCK` timeout 不是取消

`ReadOperation(sem, timeout)` / `WriteOperation(sem, timeout)` 的
`timeout` 都是：

- 相对等待时长
- 传给 `Semaphore::Wait(timeout)` 的参数

它不是绝对 deadline，也不自动意味着底层取消。

因此 `BLOCK timeout` 的真实含义是：它只限制这次同步等待窗口，并不保证已经被底层接受的操作会被撤销。timeout 之后要做的关键工作，不是把硬件立刻停掉，而是把完成归属处理对。只要底层已经启动，迟到完成就仍然可能发生；如果这时候还允许它继续 `post` 旧的 semaphore，就会出现重复唤醒。`BLOCK_DETACHED` 一类状态存在的意义，就是告诉完成路径：这次 waiter 已经不属于原调用者了，后续只能静默收尾，不能再把唤醒投给它。

## 5. `Reset()` 为什么也走 detach 模型

`Reset()` 当前不是简单粗暴地把状态直接清成 `IDLE`。

对 `BLOCK` 路径来说，它和 timeout 的处理模型是一致的：

1. 先把当前 waiter 分离
2. 让迟到完成保持静默
3. 等旧交接彻底排空后再重新开放端口

这样做的目的，是避免下面这类竞态：

- 调用者已经 timeout / reset 返回
- 底层旧完成稍后到来
- 老完成又把新的调用错误唤醒

## 6. `AsyncBlockWait` 的位置

`AsyncBlockWait` 不是给 `ReadPort / WritePort` 自己用的状态机替代品，它更像是：

- 给具体驱动内部“同步外观 + 异步硬件”这类路径准备的共享 waiter handoff

它的状态非常直接：

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 当前没有活跃等待者 |
| `PENDING` | waiter 已挂起，等待完成 |
| `CLAIMED` | 完成已经认领当前 waiter |
| `DETACHED` | timeout 已分离 waiter，完成只能静默回收 |

适合它的场景通常是：

- 驱动本身没有完整走 `ReadPort / WritePort`
- 但仍然需要“同步等待一个异步完成”

例如某些 `SPI / I2C` 驱动里的 `BLOCK` 事务。

---

## 7. 读这套状态机时的总规则

可以把 `Port` 看成“完成所有权转移器”。

它真正管理的不是：

- 数据从哪里来
- 数据发到哪里去

而是：

- 现在这次完成到底属于谁
- timeout 之后谁还可以说话
- 迟到完成应该唤醒谁，还是必须静默

如果按这个视角去读 `libxr_rw.*`，很多状态名就会顺很多。
