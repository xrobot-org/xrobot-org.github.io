---
id: swd-base
title: SWD Base Class
sidebar_position: 1
---

# SWD Base Class (`LibXR::Debug::Swd`)

This document describes `LibXR::Debug::Swd`: an abstract base class for SWD probes / link backends. It provides the minimal link control interface, a single-transfer primitive (`Transfer()`), and higher-level utilities built on top of it, including WAIT retry wrapping and DP/AP helper functions, intended for reuse by higher layers (e.g., CMSIS-DAP, debuggers, flash programmers).

---

## 1. Design Role

`Swd` is a portable SWD transaction-layer abstraction:

- Hardware-specific parts are implemented by derived classes: GPIO/USART/SPI/bit-bang backends, timing, endpoint driving, concurrency strategy, etc.
- The base class provides common logic:
  - Transfer policy (WAIT retries + IdleCycles insertion)
  - Common DP/AP read/write wrappers (including RDBUFF handling for posted reads)
  - SELECT write caching (to reduce redundant writes)

---

## 2. Data Structures

### 2.1 `TransferPolicy`

The transfer policy controls retries and idle-cycle insertion:

- `idle_cycles`: Number of idle cycles inserted after each transfer attempt (including WAIT retries).
- `wait_retry`: Maximum retry count when ACK == WAIT.
- `clear_sticky_on_fault`: Whether to attempt to clear DP sticky errors on ACK == FAULT (by writing DP ABORT).

Related APIs:

- `SetTransferPolicy(const TransferPolicy&)`
- `GetTransferPolicy()`

---

## 3. Interfaces Required by Derived Classes

The following are pure virtual functions and must be implemented by a concrete SWD backend:

1) Link control

- `ErrorCode SetClockHz(uint32_t hz)`  
  Set the target SWCLK frequency (whether it is truly adjustable depends on the backend).

- `void Close()`  
  Close the probe and release resources (e.g., detach hardware, stop timers, etc.).

- `ErrorCode LineReset()`  
  Perform an SWD line reset (commonly: drive a number of 1s, then any required sequences).

- `ErrorCode EnterSwd()`  
  Enter SWD mode (e.g., the sequence to switch from JTAG to SWD).

2) Transfer primitive

- `ErrorCode Transfer(const SwdProtocol::Request& req, SwdProtocol::Response& resp)`  
  Perform **one SWD transfer attempt (no retries)**. This function should handle:
  - Sending the request, reading ACK, (optionally) reading data and checking parity
  - Filling `resp.ack / resp.rdata / resp.parity_ok`

3) Sequences and idle cycles

- `void IdleClocks(uint32_t cycles)`  
  Insert idle clock cycles (typically generate SWCLK pulses while holding SWDIO in idle state).

- `ErrorCode SeqWriteBits(uint32_t cycles, const uint8_t* data_lsb_first)`  
  Output `cycles` bits on SWDIO in LSB-first order and generate SWCLK pulses.

- `ErrorCode SeqReadBits(uint32_t cycles, uint8_t* out_lsb_first)`  
  Generate SWCLK pulses and sample SWDIO, writing the result to the output buffer in LSB-first order.

---

## 4. Retry-Capable Transfer: `TransferWithRetry()`

`TransferWithRetry()` adds policy control on top of `Transfer()` to match typical CMSIS-DAP behavior.

Core rules:

- Insert `idle_cycles` after every attempt (including WAIT retries).
- When `resp.ack == WAIT`, retry up to `wait_retry` times.
- If the underlying `Transfer()` returns non-OK (bus/implementation-level error):
  - Set `resp.ack` to `PROTOCOL`
  - Invalidate the SELECT cache (avoid incorrect decisions based on cached state)
  - Return that error code immediately
- If the final ACK is not OK: invalidate the SELECT cache
- If the final ACK is FAULT and `clear_sticky_on_fault == true`: attempt to write ABORT to clear sticky errors

Return semantics:

- The returned `ErrorCode` indicates the transfer-flow result: usually `OK` unless the underlying `Transfer()` fails.
- ACK status is reported via `resp.ack`; upper layers should check both `resp.ack` and `resp.parity_ok`.

---

## 5. DP/AP Helper APIs

The base class provides common DP/AP transaction wrappers to reduce duplication in upper layers.

### 5.1 DP Read/Write

- `DpRead(...) / DpWrite(...)`: no-retry variants (call `Transfer()` directly)
- `DpReadTxn(...) / DpWriteTxn(...)`: retry-enabled variants (call `TransferWithRetry()`)

Notes:

- A read is considered successful only when `resp.ack == OK` and `resp.parity_ok == true`, and then `val` is produced.
- Any non-OK ACK or parity failure returns `FAILED` (and returns the ACK via `ack`).

### 5.2 AP Read/Write and Posted Reads

AP reads are posted reads, so two patterns are provided:

- `ApReadTxn(addr2b, val, ack)`  
  Perform one AP READ (posted), then read DP `RDBUFF` and output the **actual data for this AP READ** into `val`.

- `ApReadPostedTxn(addr2b, posted_val, ack)`  
  Perform only the AP READ and return `resp.rdata` (this is the posted result of the **previous** AP READ). To obtain the final AP READ’s actual data, the caller must perform an additional `DpReadRdbuffTxn()`.

Writes:

- `ApWriteTxn(addr2b, val, ack)`: retry-enabled AP WRITE.

### 5.3 Other Common Wrappers

- `ReadIdCode(idcode, ack)`: read DP `IDCODE` (no retry).
- `WriteAbort(flags, ack)` / `WriteAbortTxn(flags, ack)`: write DP `ABORT` (no-retry / retry).
- `DpReadRdbuffTxn(val, ack)`: read DP `RDBUFF` (retry).

---

## 6. SELECT Write Cache

To reduce redundant SELECT writes, the base class maintains a small cache:

- `SetSelectCached(select, ack)`  
  - If cache hits (`select_valid_ && select_cache_ == select`), return `OK` and `ack = OK`
  - Otherwise call `DpWriteTxn(SELECT, select, ack)`; on success update the cache

- `InvalidateSelectCache()`  
  Marks the cache invalid. Typical invalidation cases:
  - In `TransferWithRetry()` when ACK is not OK
  - In `TransferWithRetry()` when the underlying Transfer returns non-OK
  - Upper layers may also call it proactively during link reset, mode switching, etc.

---

## 7. Implementation Guidance (Derived Classes)

1) Scope of responsibility for `Transfer()`  
`Transfer()` should implement only **one transaction attempt** and should not embed WAIT retries or idle insertion (the base class already provides policy wrapping). If minimal hardware-layer retries are unavoidable (e.g., sampling/timing edge cases), clearly define how it relates to `wait_retry` to avoid double-retry amplification.

2) Response filling  
Even on errors, try to fill `resp.ack` and `resp.parity_ok` as much as possible. For unrecoverable errors, have `Transfer()` return non-OK so that `TransferWithRetry()` can uniformly handle side effects like cache invalidation.

3) Line idle state and direction switching  
Direction control and turnaround handling in `SeqWriteBits/SeqReadBits` should follow SWD protocol requirements, especially I/O direction changes across ACK and data phases.

---

## 8. Example Usage (Conceptual)

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
