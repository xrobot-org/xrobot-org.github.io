---
id: adv-coding-driver-block-timeout-semantics
title: BLOCK 超时与完成交接
sidebar_position: 3
---

# BLOCK 超时与完成交接

本文说明异步完成路径中 `BLOCK` 超时的含义：调用者停止等待之后，底层是否还会完成；如果会，这次完成是否还能唤醒原来的等待者。

## 1. `BLOCK timeout` 的真实含义

`BLOCK` timeout 限制的是调用者的同步等待窗口，并不保证底层已经接受的操作会被自动取消。也就是说，超时返回不等于硬件停下来了；只要底层已经启动，迟到完成就仍然可能发生。

## 2. 为什么要有 detach 语义

如果超时后直接把端口或等待状态清零，会出现以下问题：

1. 调用者已经返回 `TIMEOUT`
2. 老的底层完成稍后到来
3. 这次完成又错误地唤醒新调用，或者留下 stale semaphore token

所以这里要做的不是“硬清空”，而是先把当前 waiter 分离，再让迟到完成静默收尾，等旧交接彻底排空后再重新开放端口。`BLOCK_DETACHED` 一类状态，就是为了表达这件事。

## 3. `AsyncBlockWait` 解决什么问题

`AsyncBlockWait` 做的事情很单纯，就是给驱动内部“同步等待一个异步完成”的路径提供标准 handoff。它不负责取消底层硬件，只负责说清楚这次完成还属不属于当前同步调用者：`Start(sem)` 把 waiter 挂起成 `PENDING`，`TryPost(...)` 只有在 `PENDING -> CLAIMED` 成功时才允许唤醒当前 waiter，`Wait(timeout)` 超时后则把 waiter 切成 `DETACHED`。如果迟到完成只看见 `DETACHED`，那就只能静默回收，不能再 post。`Cancel()` 在硬件启动失败时把状态清回 `IDLE`，不发送通知。`AsyncBlockWait` 不检查上一次传输是否结束：`Start()` 总是进入 `PENDING`，若旧传输的迟到完成在此之后到达，会认领新的等待者。因此驱动在调用 `Start()` 前须确认硬件空闲，例如 `STM32SPI` 在 HAL 状态不是 `HAL_SPI_STATE_READY` 时返回 `BUSY`。

---

## 4. 最常见的几个 bug

### 4.1 硬件先启动，waiter 后挂起

这是最典型的一类。

错误顺序：

1. 先 arm 硬件 / 启动 DMA / 打开中断
2. 再 `block_wait_.Start(...)`

风险是：

- 底层完成太快
- ISR 比 waiter setup 更早到
- 唤醒信号直接丢掉

正确顺序应该是：

1. 先把 waiter 状态挂好
2. 再把硬件暴露给 ISR / DMA / 完成路径

---

### 4.2 把旧 semaphore token 当成本次完成

如果一个 semaphore 被重复用于多次 `BLOCK` 调用，而等待路径只把 `sem->Wait(timeout) == OK` 当成成功，上一次残留的 token 就可能被误认成当前完成。这里需要先确认等待状态已由本次操作的完成方切换为 `CLAIMED`（`AsyncBlockWait` 的 `CLAIMED`，或端口的 `BLOCK_CLAIMED`）。只有这样，这次 wake 才属于本次操作；否则就应该继续等待，把它当成 stale token。

---

### 4.3 `timeout` 后只返回，不做 detach

超时返回之后，旧的完成路径仍可能修改共享状态、再次 post 信号量，甚至覆盖新等待者的归属。因此超时返回前必须让完成路径知道该等待者已不属于当前调用者。

---

### 4.4 完成成功了，但 caller buffer 没更新

这类问题多出现在“异步完成 + 同步外观”混合路径里。完成路径报告成功，但 DMA 或 ISR 收到的数据没有拷回 caller-visible buffer；上层看到的是成功返回，手里的数据却还是旧的。对 `MemRead`、`ReadAndWrite` 这类接口来说，这比单纯超时更危险，因为它看起来像对的。

---

## 5. 为什么 `TIMEOUT` 和最终结果可能不一致

如果 timeout 和 completion 竞争，可能有两种情况：

### timeout 先赢

- waiter 成功从 `PENDING` detach
- 当前调用返回 `TIMEOUT`
- 迟到完成只负责静默收尾

### completion 先 claim

- completion 已经把当前 waiter 标成 `CLAIMED`
- timeout 这边虽然表面上先从 `Wait()` 返回了超时
- 但最终仍要继续等那次已经归属当前 waiter 的完成
- 返回的是最终 `block_result_`，不是 `TIMEOUT`

所以 `BLOCK timeout` 的结果要看这次完成最后归谁所有，超时返回并不一定等于失败。

---

## 6. 这件事为什么在 `SPI / I2C` 上特别容易出问题

相对 UART、USB 这类长期流式路径，`SPI / I2C` 更容易写成“发起一次事务，再在线程里同步等一个结果”的形状。问题在于外观是同步的，底层往往仍然是 DMA、IRQ 和状态机推进。把同步外观当作同步实现时，容易出现等待者晚于硬件启动才挂起、超时后残留信号量 token、迟到完成未保持静默等问题。

---

## 7. 一个实用判断标准

检查一个 `BLOCK` 驱动路径时确认四点：waiter 是不是在硬件可见之前就已经挂好；timeout 之后是否明确 detach；迟到完成是否会对已 detach 的 waiter 保持静默；最终结果是否和 caller-visible buffer 的实际内容一致。
