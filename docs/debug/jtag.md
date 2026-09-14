---
id: jtag
title: JTAG 调试接口
sidebar_position: 2
---

# JTAG 调试接口

`LibXR::Debug::Jtag` 定义 TAP 状态控制和 IR/DR 移位。当前实现包括 GPIO bit-bang 后端 `JtagGeneralGPIO`，以及 DP/AP 事务层 `JtagDp`。

## Jtag 基类

```cpp
virtual ErrorCode SetClockHz(uint32_t hz) = 0;
virtual void Close() = 0;
virtual ErrorCode ResetTap() = 0;
virtual ErrorCode GotoState(TapState target) = 0;
virtual ErrorCode ShiftIR(uint32_t bits,
                          const uint8_t* in_lsb_first,
                          uint8_t* out_lsb_first) = 0;
virtual ErrorCode ShiftDR(uint32_t bits,
                          const uint8_t* in_lsb_first,
                          uint8_t* out_lsb_first) = 0;
virtual ErrorCode Sequence(uint32_t cycles, bool tms,
                           const uint8_t* tdi_lsb_first,
                           uint8_t* tdo_lsb_first) = 0;
virtual void IdleClocks(uint32_t cycles) = 0;
```

IR/DR 数据按 LSB-first 存放。空输入指针表示移入 0，空输出指针表示忽略 TDO。

## GPIO 后端

```cpp
#include "debug/jtag_general_gpio.hpp"

LibXR::Debug::JtagGeneralGPIO<decltype(tck), decltype(tms),
                            decltype(tdi), decltype(tdo)>
    jtag(tck, tms, tdi, tdo, loops_per_us, 500000);
```

构造时配置 TCK/TMS/TDI/TDO 并复位 TAP。`loops_per_us` 用于软件延时标定，目标 TCK 频率通过 `SetClockHz()` 设置。

GPIO 实现的 `GotoState()` 直接处理 RESET、IDLE、SHIFT_IR 和 SHIFT_DR。`ShiftIR()`、`ShiftDR()` 完成后回到 IDLE。

## JTAG-DP

```cpp
#include "debug/jtag_dp.hpp"

LibXR::Debug::JtagDp dp(jtag);
uint32_t idcode = 0;
auto result = dp.ReadIdCode(idcode);
```

`DpReadTxn()` 与 `ApReadTxn()` 处理 JTAG-DP 的管线化读，在读请求后继续从 RDBUFF 取得结果。低层 `DpRead()` / `DpWrite()` 则直接执行一次 DP 事务。

多器件链使用 `JtagProtocol::ChainConfig` 指定器件数量、当前器件索引和各器件 IR 长度。链配置改变后，通过 `SetChainConfig()` 更新事务层。

## CMSIS-DAP

CMSIS-DAP v1/v2 的 JTAG profile 可以通过 `SetJtag()` 绑定同一个 JTAG 后端。SWD 与 JTAG profile 的选择及 USB 端点配置见对应 [DAP v1](../xrusb/dev_stack/dap-v1.md) 和 [DAP v2](../xrusb/dev_stack/dap.md) 页面。
