---
id: adv-coding-core-rw-semantics
title: IO 完成语义与 Port 状态机
sidebar_position: 1
---

# IO 完成语义与 Port 状态机

基础 API 见 [IO 读写抽象](/docs/basic_coding/core/core-rw) 和 [Operation 操作模型](/docs/basic_coding/core/core-op)。下文直接讨论这套 I/O 完成模型为什么这样组织。

`LibXR` 的 I/O 完成模型仍然可以看成三层：`Operation` 描述完成后怎样反馈，`ReadPort / WritePort` 负责请求所有权、队列和完成交接，具体驱动负责把硬件数据送进端口，或从端口取走已经提交的数据。复杂的 timeout、waiter 归属和迟到完成状态放在 `Port`，而不是塞进 `Operation` 本体。

`Operation` 故意保持很小，只携带 `CALLBACK`、`BLOCK`、`POLLING` 或 `NONE` 以及对应的通知目标。对 `BLOCK` 来说，信号量只负责“把等待者叫醒”，最终结果由端口或驱动保存。这样 waiter 的生命周期、timeout 后谁还能通知谁，都可以由真正拥有请求状态的一层处理。

## 1. `ReadPort` 的状态机

`ReadPort` 当前把 phase 和“有新数据需要重查”的通知位放在同一个原子状态字里。phase 有：

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 可以接纳一个新的读请求 |
| `CLAIMED` | 某条路径正独占请求处理或出队 |
| `PENDING` | 已有请求等待足够数据 |
| `CLAIMED_WITH_WAITER` | timeout 方正在等处理方完成安全交接 |
| `BLOCK_CLAIMED` | BLOCK 完成已经被完成方认领 |

另外还有独立的 `EVENT_BIT`。它不是一个 phase，也不表示“读完成”；它只是说明生产者在某个交错点发布过数据，释放当前处理权之后必须再检查一次队列。把 event 做成可与任何 phase 共存的位，正是为了避免生产者和消费者交错时漏掉一次“有新数据”的提醒。

正长度读取只有在完整请求长度都可用时才复制到用户缓冲区。零长度读取则只等待队列非空，不消费字节。完成方在真正访问 BLOCK 用户缓冲区前先 claim 完成所有权；这样 timeout 与完成竞争时，哪一边能继续访问这块缓冲区是明确的。

非 `BLOCK` 回调还有一个很重要的顺序：端口先释放请求处理权，再调用用户回调。这样回调可以继续提交下一次非 `BLOCK` 读，而不会因为上一笔请求还占着 phase 形成自锁。

---

## 2. `WritePort` 的状态机

写端除了“谁在准备请求”，还要记录有多少请求已经真正发布给后端消费者。因此状态字低三位保存 phase，其余位保存已发布请求数。

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 可以接纳新的写入 |
| `LOCKED` | 生产者正在准备一个请求或 Stream 批次 |
| `BLOCK_WAITING` | 当前 BLOCK 调用已经提交并在等待完成 |
| `BLOCK_CLAIMED` | 后端已经认领这次 BLOCK 完成 |
| `BLOCK_DETACHED` | 调用已经 timeout，但请求仍留在队列中 |
| `BLOCK_RETIRE_WAITING` | 后一个 BLOCK 调用先等待旧请求彻底退出 |

这里“发布请求数”和生产者 phase 分开很重要：生产者准备下一笔数据时，后端仍然可以继续消费更早已经发布的请求。`Stream` 里还没 `Commit()` 的数据则不能被当成一个新请求交给后端。

后端只有一个消费者。`GetWriteQueue()`、出队、接口析构时的结算，以及由此触发的完成回调，都属于同一条串行消费链。端口负责发布与结算请求，驱动自己的 DMA buffer、寄存器和 active/pending 状态仍由驱动自己协调。

---

## 3. 端口眼里的“完成”是什么意思

旧版接口曾经通过驱动返回 `PENDING` / 非 `PENDING` 来划分“这笔请求是否还在后台继续”。当前 `WritePort` 已经不是这套协议：`WriteFun(WritePort&, bool)` 是一个**无返回值的进度通知**，后端通过 `GetWriteQueue()` 消费已经发布的队头。

真正的完成边界是：**这个请求的全部字节已经被后端消费并接收到自己可以持续持有的存储。** `WriteQueue` 结算时发现整笔请求都被取走，就触发对应的 `Operation` 完成。

这带来一个很容易混淆、但对驱动设计很重要的区别：

- 端口完成：后端已经接收整笔请求；
- DMA 完成：某个 DMA block 已经搬完；
- UART 线路完成：最后一个 stop bit 已经离开发送器。

三者可以发生在不同时间。例如 STM32 UART 可以先把请求复制进 active/pending DMA 缓冲，然后端口就完成；真正的 DMA 与线路发送还在后面继续。RS485 方向切换这类依赖“线已经发完”的动作，必须使用硬件发送完成事件，不能拿 `WriteOperation` 的完成代替。

读取的边界则不同：正长度 `ReadPort` 要等完整数据已经写进调用者的接收缓冲区才完成。因此读写两边虽然共用 `Operation`，完成点并不是一个抽象的“硬件操作结束”。

## 4. `BLOCK` timeout 不是统一的取消

`ReadOperation(sem, timeout)` / `WriteOperation(sem, timeout)` 的 timeout 都是相对等待时间，但 timeout 后留下什么工作，要看端口类型。

读端可以取消尚未完成的软件读请求。关键约束不是“立刻把 phase 清回 IDLE”，而是**返回之前必须确保旧完成路径不会再访问调用者的接收缓冲区**。如果完成方已经 claim 了这块缓冲区，timeout 方会继续等这次交接结束，因此函数实际返回时间可能超过传入的 timeout；此时返回的是完成结果。

写端不同。请求一旦接纳，源数据已经复制进端口队列；timeout 只让当前同步调用者停止等，不会撤回已经排队的字节。后端之后仍可能发送它们。为了避免旧请求迟到退休时碰到已经失效的 semaphore，写端用 `BLOCK_DETACHED` 和 `BLOCK_RETIRE_WAITING` 把“旧请求仍在队列”和“下一次 BLOCK 想进入”分开处理。

所以 timeout 之后不能简单重发同一条非幂等命令并假定第一次没有发生。协议层需要自己的序号、确认或者去重策略。

## 5. 清队列、重新配置和“重置”为什么要分开看

当前 `ReadPort` 没有一个通用 `Reset()` 去同时取消请求、清字节和停止硬件。`ClearQueuedData()` 只丢弃当前已经排队的接收字节；有活动请求时会返回 `BUSY`，也不会替驱动停止 UART/DMA。

这个边界其实比一个万能 Reset 更清楚。软件队列清理、未完成请求的所有权、硬件停机、重新配置分别由真正拥有那部分状态的代码处理。否则很容易出现下面的竞态：

1. 上层认为 reset 已经结束；
2. 旧 DMA/IRQ 完成稍后到来；
3. 老完成又踩到已经被新请求复用的状态或通知对象。

具体驱动如果需要 abort/reconfigure，就必须先把硬件和自己的缓冲状态停稳，再让端口侧重新开放，而不是靠清软件队列推断硬件已经停止。

## 6. `AsyncBlockWait` 的位置

`AsyncBlockWait` 不是 `ReadPort / WritePort` 状态机的替代品。它给具体驱动内部“同步外观 + 异步硬件”这类路径提供一个小型 waiter handoff：

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 当前没有活跃等待者 |
| `PENDING` | waiter 已挂起，等待完成 |
| `CLAIMED` | 完成方已经认领这次通知 |
| `DETACHED` | timeout 已经把调用者分离 |

典型顺序是先 `Start(sem)`，再启动可能立刻完成的 DMA/IRQ；完成侧用 `TryPost(...)` claim waiter，timeout 方用 `Wait(timeout)` 在还没被 claim 时切到 `DETACHED`。如果完成先赢，等待方会把已经归属于自己的完成收完再返回；如果 timeout 先 detach，迟到完成只清理状态，不再 post 旧 waiter。

它管理的是**通知所有权**，不是硬件取消。DMA 是否已经停止、接收数据有没有拷回 caller buffer、外部缓冲能不能销毁，仍然是具体驱动的责任。

---

## 7. 读这套状态机时的总规则

可以把 `Port` 看成“请求与完成所有权的交接器”。

它真正管理的不是数据最终来自哪个 UART，也不是 DMA 寄存器怎样配置，而是：

- 现在这次请求由谁占有；
- 哪些数据已经发布给另一侧；
- 完成通知到底属于哪个 waiter / callback；
- timeout 后谁还能访问原来的缓冲和 semaphore；
- 迟到完成应该正常交接，还是只能静默退休。

按这个视角读 `read_port.*`、`write_port.*` 和 `operation.hpp`，状态名与各种竞态的关系会清楚很多。硬件层再在这个边界之外处理 DMA、FIFO、端点和线路完成。
