---
id: xrusb-dev-stack-daplinkv1
title: DAPLinkV1
sidebar_position: 5
---

# DAPLinkV1 设备协议栈

本文档描述 XRUSB 的 **CMSIS-DAP v1（HID）** 设备类实现：`LibXR::USB::DapLinkV1Class<SwdPort>`。

该设备类面向仍通过 **HID Report** 传输的 CMSIS-DAP v1 主机工具链。当前主线实现以 **SWD** 为主，支持常见 DAP 核心命令、SWJ/SWD 控制序列，以及可选的 `nRESET` GPIO 控制。

支持能力概览：

- **CMSIS-DAP v1 HID transport**
- **SWD + 可选 JTAG**：直接包含 `daplink_v1.hpp` 时编译 JTAG 支持；调用 `SetJtag()` 绑定后端后才向主机宣告/使用 JTAG。`daplink_v1_profile_swd.hpp` 可构建纯 SWD 版本。
- **可选 nRESET 控制**（通过 `GPIO* nreset_gpio` 注入）
- **HID IN/OUT + Feature Report** 路径
- **DAP_Transfer / DAP_TransferBlock**（含 AP posted-read pipeline）

---

## 1. 类与构造方式

### 1.1 `LibXR::USB::DapLinkV1Class<SwdPort>`

该类为模板类，模板参数 `SwdPort` 提供底层 SWD 能力。

构造函数：

```cpp
template <typename SwdPort>
explicit DapLinkV1Class(
    Endpoint::EPNumber in_ep_num,
    Endpoint::EPNumber out_ep_num,
    SwdPort& swd_link,
    LibXR::GPIO* nreset_gpio = nullptr);
```

参数说明：

- `in_ep_num` / `out_ep_num`：显式指定 HID IN/OUT 端点号
- `swd_link`：SWD 链路对象引用
- `nreset_gpio`：可选 nRESET GPIO
- `SetJtag(jtag)`：在启用 JTAG 的构建中绑定 JTAG 后端

常用接口：

- `SetInfoStrings(info)`：覆盖 `DAP_Info` 字符串
- `GetState()`：读取内部 DAP 状态
- `IsInited()`：是否已完成绑定初始化

### 1.2 InfoStrings

`DAP_Info` 字符串集合：

```cpp
struct InfoStrings
{
  const char* vendor;
  const char* product;
  const char* serial;
  const char* firmware_ver;

  const char* device_vendor;
  const char* device_name;
  const char* board_vendor;
  const char* board_name;
  const char* product_fw_ver;
};
```

---

## 2. 传输模型与 HID 报告

`DapLinkV1Class` 继承自：

```cpp
HID<sizeof(DAPLINK_V1_REPORT_DESC), DapLinkV1Def::MAX_REQUEST_SIZE,
    DapLinkV1Def::MAX_RESPONSE_SIZE>
```

当前主线常量：

- `MAX_REQUEST_SIZE = 64`
- `MAX_RESPONSE_SIZE = 64`
- `PACKET_COUNT_ADVERTISED = 1`

HID 报告描述符定义了：

- 64 字节 **Input Report**
- 64 字节 **Output Report**
- 64 字节 **Feature Report**

因此该类使用的是 **HID report transport**，不是 DAPLinkV2 的 Bulk 传输模型。

---

## 3. 生命周期：Bind / Unbind

### 3.1 Bind

绑定阶段主要完成：

- 调用 HID 基类绑定并申请 IN/OUT 端点
- 初始化 DAP 运行态：
  - `debug_port = DISABLED`
  - `transfer_abort = false`
  - `swj_clock_hz = 1MHz`
  - SWJ shadow 默认：SWDIO=1、nRESET=1、SWCLK=0
- arm OUT 接收，准备处理主机 HID Output Report

### 3.2 Unbind

解绑阶段主要完成：

- 关闭 SWD 后端
- 释放 HID IN/OUT 端点
- 清空响应队列与 shadow 状态

---

## 4. `DAP_Info` 关键字段

当前实现中，关键 `DAP_Info` 字段行为为：

- `CAPABILITIES`：始终包含 SWD；JTAG 编译启用且已绑定后端时附加 JTAG capability
- `PACKET_COUNT`：`1`
- `PACKET_SIZE`：`64`
- `TIMESTAMP_CLOCK`：`1,000,000`

说明：

- `PACKET_SIZE` 与 HID v1 的固定 64-byte report 长度一致
- 与 DAPLinkV2 不同，这里没有可变的 Bulk packet-size 暴露语义

---

## 5. 支持的命令范围

当前主线实现覆盖的主命令与 DAPLinkV2 大体同族，但传输承载方式不同：

- `DAP_Info`
- `DAP_HostStatus`
- `DAP_Connect` / `DAP_Disconnect`
- `DAP_TransferConfigure`
- `DAP_Transfer`
- `DAP_TransferBlock`
- `DAP_TransferAbort`
- `DAP_WriteABORT`
- `DAP_Delay`
- `DAP_ResetTarget`
- `DAP_SWJ_Pins`
- `DAP_SWJ_Clock`
- `DAP_SWJ_Sequence`
- `DAP_SWD_Configure`
- `DAP_SWD_Sequence`

实现边界：

- JTAG 命令在启用 JTAG profile 且调用 `SetJtag()` 后可用；纯 SWD profile 不编译 JTAG 路径
- `PACKET_COUNT` 固定为 `1`，因此没有 DAPLinkV2 那种主机可见的多包并行响应深度

---

## 6. 运行时行为

该类内部维护：

- SWJ shadow pin 状态
- 当前 `debug_port`
- `transfer_abort` 标志
- 一个 HID 响应队列（深度与 `PACKET_COUNT_ADVERTISED` 一致）

请求处理路径大致为：

1. 主机发送 HID Output Report
2. 设备在 `OnDataOutComplete()` 中解析请求
3. 生成响应并通过 HID Input / Feature Report 返回

---

## 7. 使用示例

```cpp
#include "daplink_v1.hpp"
#include "usb/device.hpp"
#include "debug/swd.hpp"

MySwdBackend swd(/* ... init ... */);
MyGpio nreset(/* ... optional ... */);

using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::DapLinkV1Class<MySwdBackend> dap(EP::EP1, EP::EP1, swd, &nreset);

LibXR::USB::DapLinkV1Class<MySwdBackend>::InfoStrings info;
info.vendor = "XRobot";
info.product = "DAPLinkV1";
info.serial = "00000001";
info.firmware_ver = "1.0.0";
dap.SetInfoStrings(info);

// USB device class list: {{&dap}}
// usb_dev.Init();
// usb_dev.Start();
```

---

## 8. 与 DAPLinkV2 的区别

- `DapLinkV1Class`：**HID transport**, `PACKET_SIZE=64`, `PACKET_COUNT=1`
- `DapLinkV2Class`：**Bulk transport**, 当前默认主机可见 `PACKET_SIZE=1024`, `PACKET_COUNT=4`

如果主机工具链支持 CMSIS-DAP v2 Bulk，一般优先使用 `DapLinkV2Class`；
如果需要兼容仍依赖 HID 报告路径的主机，则使用 `DapLinkV1Class`。
