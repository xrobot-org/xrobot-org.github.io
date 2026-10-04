---
id: swd-base
title: SWD基类
sidebar_position: 1
---

# SWD 基类（`LibXR::Debug::Swd`）

本文档描述 `LibXR::Debug::Swd`：一个面向 SWD 探针和链路后端的抽象基类。它提供最小的链路控制接口、一次传输原语（`Transfer()`），以及在其之上构建的 WAIT 重试封装与 DP/AP 辅助函数，用于被更上层（例如 CMSIS-DAP、调试器、烧录器）复用。

---

## 1. 设计定位

`Swd` 是可移植的 SWD 事务层抽象：

- 由派生类实现硬件相关部分：GPIO/USART/SPI/bitbang、时序、端点驱动、并发策略等。
- 基类负责通用逻辑：
  - 传输策略（WAIT 重试 + IdleCycles 插入）
  - DP/AP 常用读写封装（含 posted read 的 RDBUFF 处理）
  - SELECT 写缓存（减少冗余写操作）

---

## 2. 数据结构

### 2.1 `TransferPolicy`

传输策略用于控制重试与空闲周期插入：

- `idle_cycles`：每次传输尝试后插入的空闲周期数（包含 WAIT 重试）。
- `wait_retry`：ACK==WAIT 时的最大重试次数。
- `clear_sticky_on_fault`：ACK==FAULT 时是否尽力清除 DP sticky 错误（通过写 DP ABORT）。

相关接口：

- `SetTransferPolicy(const TransferPolicy&)`
- `GetTransferPolicy()`

---

## 3. 派生类必须实现的接口

以下接口为纯虚函数，必须由具体 SWD 后端实现：

1) 链路控制

- `ErrorCode SetClockHz(uint32_t hz)`  
  设置 SWCLK 目标频率（是否真正可调由后端决定）。

- `void Close()`  
  关闭探针并释放资源（可用于断开硬件、停止定时器等）。

- `ErrorCode LineReset()`  
  执行 SWD line reset（常见为连续输出若干个 1，再进行必要的序列）。

- `ErrorCode EnterSwd()`  
  进入 SWD 模式（例如从 JTAG 切换到 SWD 的序列）。

2) 传输原语

- `ErrorCode Transfer(const SwdProtocol::Request& req, SwdProtocol::Response& resp)`  
  执行“一次 SWD 传输（不含重试）”。该函数应完成：
  - 请求发送、ACK 读取、（可选）读数据与校验
  - 填充 `resp.ack / resp.rdata / resp.parity_ok`

3) 序列与空闲周期

- `void IdleClocks(uint32_t cycles)`  
  插入空闲时钟周期（通常表现为产生 SWCLK 脉冲，同时保持 SWDIO 空闲态）。

- `ErrorCode SeqWriteBits(uint32_t cycles, const uint8_t* data_lsb_first)`  
  在 SWDIO 上按 LSB-first 输出 `cycles` 位并产生 SWCLK 脉冲。

- `ErrorCode SeqReadBits(uint32_t cycles, uint8_t* out_lsb_first)`  
  产生 SWCLK 脉冲并采样 SWDIO，按 LSB-first 写入输出缓冲。

---

## 4. 带重试传输：`TransferWithRetry()`

`TransferWithRetry()` 在 `Transfer()` 之上增加策略控制，用于贴近 CMSIS-DAP 的典型行为。

核心规则：

- 每次尝试后都插入 `idle_cycles`（包括 WAIT 重试）。
- 当 `resp.ack == WAIT` 时，最多重试 `wait_retry` 次。
- 若底层 `Transfer()` 返回非 `OK`（总线/实现级错误）：
  - 将 `resp.ack` 置为 `PROTOCOL`
  - 失效 SELECT 缓存（避免后续基于缓存做错误判断）
  - 立即返回该错误码
- 若最终 ACK 非 OK：失效 SELECT 缓存
- 若最终 ACK 为 FAULT 且 `clear_sticky_on_fault=true`：尽力写 ABORT 清 sticky

返回值语义：

- 返回 `ErrorCode` 表示“传输流程级”的结果：通常为 `OK`，除非底层 `Transfer()` 失败。
- ACK 状态由 `resp.ack` 给出；上层应同时检查 `resp.ack` 与 `resp.parity_ok`。

---

## 5. DP/AP 辅助接口

基类提供常用 DP/AP 事务封装，减少上层重复代码。

### 5.1 DP 读写

- `DpRead(...) / DpWrite(...)`：无重试版本（直接调用 `Transfer()`）
- `DpReadTxn(...) / DpWriteTxn(...)`：带重试版本（调用 `TransferWithRetry()`）

注意事项：

- 读操作在 `resp.ack==OK` 且 `resp.parity_ok==true` 时才返回成功，并输出 `val`。
- 任何 ACK 非 OK 或奇偶校验失败都会返回 `FAILED`（并通过 `ack` 返回 ACK）。

### 5.2 AP 读写与 posted read

AP 读为 posted read，因此提供两种读法：

- `ApReadTxn(addr2b, val, ack)`  
  执行一次 AP READ（posted），随后读 DP `RDBUFF`，将“本次 AP READ 的真实数据”输出到 `val`。

- `ApReadPostedTxn(addr2b, posted_val, ack)`  
  只执行 AP READ 并返回 `resp.rdata`（这是“上一笔” AP READ 的 posted 结果）。调用者若要拿到最后一次 AP READ 的真实数据，需要额外调用一次 `DpReadRdbuffTxn()`。

写操作：

- `ApWriteTxn(addr2b, val, ack)`：带重试 AP WRITE。

### 5.3 其他常用封装

- `ReadIdCode(idcode, ack)`：读取 DP `IDCODE`（无重试）。
- `WriteAbort(flags, ack)` / `WriteAbortTxn(flags, ack)`：写 DP `ABORT`（无重试/带重试）。
- `DpReadRdbuffTxn(val, ack)`：读 DP `RDBUFF`（带重试）。

---

## 6. SELECT 写缓存

为减少冗余 SELECT 写入，基类维护一个简单缓存：

- `SetSelectCached(select, ack)`  
  - 若缓存命中（`select_valid_ && select_cache_ == select`），直接返回 `OK` 且 `ack=OK`
  - 否则执行 `DpWriteTxn(SELECT, select, ack)`；写成功后更新缓存

- `InvalidateSelectCache()`  
  将缓存标记为无效。以下情况会触发失效：
  - `TransferWithRetry()` 中遇到 ACK 非 OK
  - `TransferWithRetry()` 中底层 Transfer 返回非 OK
  - 上层也可以在链路重置、模式切换等场景主动调用

---

## 7. 实现建议（派生类）

1) `Transfer()` 的职责边界  
`Transfer()` 应只做“一次事务”，不要内置 WAIT 重试与 idle 插入（基类已提供策略封装）。如果必须在硬件层做最小化重试（例如采样时序问题），建议明确与 `wait_retry` 的关系，避免双重重试导致延迟放大。

2) 响应填充  
即使发生异常，也应尽量填充 `resp.ack` 与 `resp.parity_ok`，并在不可恢复错误时让 `Transfer()` 返回非 `OK`，由 `TransferWithRetry()` 统一处理缓存失效等副作用。

3) 线路空闲与方向切换  
`SeqWriteBits/SeqReadBits` 的方向控制与 turnaround 处理应符合 SWD 协议要求；特别是 ACK 阶段与数据阶段的 IO 方向切换。

---

## 8. 使用示例（概念性）

```cpp
class MySwd : public LibXR::Debug::Swd {
 public:
  ErrorCode SetClockHz(uint32_t hz) override;
  void Close() override;
  ErrorCode LineReset() override;
  ErrorCode EnterSwd() override;
  ErrorCode Transfer(const SwdProtocol::Request& req,
                     SwdProtocol::Response& resp) override;

  void IdleClocks(uint32_t cycles) override;
  ErrorCode SeqWriteBits(uint32_t cycles, const uint8_t* data_lsb_first) override;
  ErrorCode SeqReadBits(uint32_t cycles, uint8_t* out_lsb_first) override;
};

MySwd swd;
LibXR::Debug::Swd::TransferPolicy pol;
pol.idle_cycles = 0;
pol.wait_retry = 100;
swd.SetTransferPolicy(pol);

swd.EnterSwd();

uint32_t idcode = 0;
LibXR::Debug::SwdProtocol::Ack ack;
swd.ReadIdCode(idcode, ack);
```
