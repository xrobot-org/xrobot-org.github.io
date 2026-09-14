---
id: adv-coding-drv-block-timeout-semantics
title: BLOCK 超时与完成交接
sidebar_position: 4
---

# BLOCK 超时与完成交接

这页讨论的不是 `SPI / I2C / UART` 的接口列表，而是 `BLOCK` 超时在异步完成路径里的实际含义。问题的核心始终是同一个：调用者已经不等了，底层还会不会继续完成；如果会，这次完成还能不能再去唤醒旧 waiter、访问旧 buffer。

## 1. `BLOCK timeout` 的真实含义

`BLOCK` timeout 限制的是调用者的同步等待窗口，不等于所有底层工作都会被撤销。

对 `ReadPort`，尚未完成的软件读可以取消；但返回前必须保证完成方不会再访问调用者的接收缓冲。如果完成已经先 claim 了这次交接，等待者会把这笔完成收完再返回。

对 `WritePort`，请求一旦接纳，字节已经复制进端口队列。timeout 不撤回这些字节，后端仍可能继续发送。也就是说，“调用返回 `TIMEOUT`”和“这条命令没有发生”不是同一件事。

事务型 `SPI / I2C` 则由具体驱动决定能不能停 DMA、复位外设或安全回收中间缓冲。统一的 waiter 状态机不能代替这些硬件动作。

## 2. 为什么要有 detach 语义

如果 timeout 后只把等待状态粗暴清零，会遇到一个典型问题：

1. 调用者已经返回 `TIMEOUT`；
2. 老的底层完成稍后到来；
3. 这次完成又错误地 post 旧 semaphore，或者碰到下一次调用已经复用的通知对象。

所以等待路径要先把“这次 waiter 还属不属于当前调用者”说清楚。`AsyncBlockWait` 用 `DETACHED` 表达 timeout 已经分离 waiter；`WritePort` 也有自己的 `BLOCK_DETACHED` / `BLOCK_RETIRE_WAITING` 来处理“调用已返回，但请求还在队列里”的情况。

detach 的目标不是假装底层工作消失了，而是让迟到完成知道：旧 waiter 已经不能再被唤醒。

## 3. `AsyncBlockWait` 解决什么问题

`AsyncBlockWait` 给驱动内部“同步等待一个异步完成”的路径提供标准 handoff。

它的状态是：

| 状态 | 含义 |
| ---- | ---- |
| `IDLE` | 当前没有等待 |
| `PENDING` | waiter 已经挂起 |
| `CLAIMED` | 完成方已经认领通知 |
| `DETACHED` | timeout 已经把 waiter 分离 |

`Start(sem)` 先把 waiter 挂成 `PENDING`。完成方只有成功做出 `PENDING -> CLAIMED`，才写入结果并 post；timeout 方则在仍是 `PENDING` 时切到 `DETACHED`。如果完成先 claim，`Wait()` 即使最初那次有限等待已经超时，也要继续等这次已经归属当前调用的 post，再返回最终结果。

这个模型解决的是 waiter ownership，不负责自动 stop DMA，也不保证 caller buffer 已经安全。

---

## 4. 最常见的几个 bug

### 4.1 硬件先启动，waiter 后挂起

这是最典型的一类。

错误顺序：

1. 先 arm 硬件 / 启动 DMA / 打开中断；
2. 再 `block_wait_.Start(...)`。

风险是底层完成太快，ISR 比 waiter setup 更早到，完成通知没有合法的等待者可以 claim。

正确顺序应该是先把 waiter 状态挂好，再把硬件暴露给可能立即到来的 DMA / IRQ 完成路径。

### 4.2 把旧 semaphore token 当成本次完成

如果一个 semaphore 被重复用于多次等待，而调用路径只把 `sem->Wait(...) == OK` 当成成功，上一次遗留的 token 就可能被误认成当前完成。

正确做法是由请求状态先确认“这次 wake 到底属于谁”。`AsyncBlockWait` 要求状态已经是 `CLAIMED`；端口自己的 BLOCK 路径也有对应的 ownership phase。semaphore 是唤醒通道，不是请求身份本身。

### 4.3 timeout 后只返回，不处理所有权

这类实现表面最简单，后果却最难排。timeout 返回之后，老完成路径还可能修改共享状态、继续 post，甚至覆盖新 waiter 的 ownership。

因此 timeout 返回前至少要完成一件事：要么安全取消这次软件请求，要么把 waiter detach，让迟到完成静默退出；如果完成已经 claim，则等这次交接结束。

### 4.4 完成成功了，但 caller buffer 没更新

这类问题多出现在“异步完成 + 同步外观”的读事务。完成路径报告成功，但 DMA 收到的数据还在中间 buffer，或者 timeout/abort 后又迟到写进 caller 地址；上层看到的状态和手里的数据不一致。

所以驱动不能只检查“有没有 post”。它还要定义成功返回时 caller-visible buffer 已经处于什么状态，以及 timeout 返回后谁还可能访问它。

---

## 5. timeout 和最终结果为什么可能不一致

如果 timeout 和 completion 竞争，大致有两种情况。

### timeout 先赢

- waiter 成功从 `PENDING` detach；
- 当前调用返回 `TIMEOUT`；
- 迟到完成不再唤醒旧 waiter，只处理自己的收尾。

### completion 先 claim

- completion 已经把 waiter 标成 `CLAIMED`；
- 有限 `Wait(timeout)` 可能正好返回超时；
- 但这笔完成的所有权已经属于当前调用；
- 等待路径继续等对应 post，最后返回真实完成结果。

因此 timeout 是等待窗口，不是严格的函数墙钟上限；竞争点上谁先拿到 completion ownership，决定最终结果。

## 6. `ReadPort` 和 `WritePort` 为什么表现不同

读端口借用的是调用者接收缓冲区。timeout 后最重要的事情，是返回之前结束对这块缓冲区的访问，所以它可以取消尚未完成的软件读，并在必要时等待已经 claim 的处理方退出。

写端在接纳时已经复制源数据，caller 的源 buffer 可以在调用返回后复用。因此 timeout 面对的是另一件事：**队列里的旧请求怎样继续退休，同时不再碰旧 waiter 的 semaphore。** 这就是 `BLOCK_DETACHED` / `BLOCK_RETIRE_WAITING` 存在的原因。

不要把“读 timeout 后 buffer 安全”和“写 timeout 后传输撤销”混成同一个保证。后者并不存在。

## 7. 清队列和硬件 abort 不是一回事

`ReadPort::ClearQueuedData()` 只清已经排队的字节，有活动请求时返回 `BUSY`。它不取消挂起请求，也不停止 UART/DMA。

具体驱动如果提供重新配置、abort 或复位路径，需要自己保证：旧 DMA 已经停稳，旧 completion 不会再访问已经释放的外部缓冲，端口/等待器状态也已经完成交接。软件队列清空只是其中一个动作。

这和 timeout 的本质是一致的：最危险的从来不是“返回了哪个错误码”，而是返回之后还有谁可能继续动旧状态。

## 8. 一个实用判断标准

看某个 `BLOCK` 驱动路径写得对不对，先问几件事：

- waiter 是不是在硬件可能完成之前就挂好；
- timeout 后，完成所有权有没有明确 detach 或安全取消；
- 迟到完成会不会再次唤醒已经返回的调用；
- 成功返回时 caller-visible buffer 是否已经更新；
- timeout 返回后还有没有 DMA/ISR 可能访问 caller-owned storage；
- 对写事务，调用者是否知道 timeout 后请求仍可能执行。

这些问题都能给出清楚答案，`BLOCK` 语义才真正站得住。
