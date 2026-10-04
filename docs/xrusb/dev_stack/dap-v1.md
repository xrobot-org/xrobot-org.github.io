---
id: xrusb-dev-stack-daplinkv1
title: DAPLinkV1
sidebar_position: 5
---

# DAPLinkV1 设备协议栈

本文档描述 XRUSB 的 CMSIS-DAP v1（HID）设备类实现：`LibXR::USB::DapLinkV1Class<SwdPort>`。

该设备类面向仍通过 HID Report 传输的 CMSIS-DAP v1 主机工具链。支持 SWD；调用 `SetJtag()` 提供 JTAG 后端后也支持 JTAG。另外支持常见 DAP 核心命令、SWJ/SWD/JTAG 序列和可选的 `nRESET` GPIO 控制。

支持能力概览：

- CMSIS-DAP v1 HID transport
- SWD；设置 JTAG 后端后 `DAP_Connect` 也可连接 JTAG
- 可选 nRESET 控制（通过 `GPIO* nreset_gpio` 注入）
- HID Interrupt IN/OUT 传输
- DAP_Transfer / DAP_TransferBlock（含 AP posted-read pipeline）

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

- `in_ep_num` / `out_ep_num`：HID Interrupt IN/OUT 端点号（必填）
- `swd_link`：SWD 链路对象引用
- `nreset_gpio`：可选 nRESET GPIO

接口字符串固定为 `"CMSIS-DAP"`。

常用接口：

- `SetInfoStrings(info)`：覆盖 `DAP_Info` 字符串
- `GetState()`：读取内部 DAP 状态
- `IsInited()`：是否已完成绑定初始化
- `SetJtag(jtag)`：设置 JTAG 后端（`LibXR::Debug::Jtag*`）。包含 `daplink_v1_profile_swd.hpp` 时 JTAG 在编译期关闭，`SetJtag()` 不起作用；直接包含 `daplink_v1.hpp` 或 `daplink_v1_profile_jtag.hpp` 时 JTAG 可用

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

常量：

- `MAX_REQUEST_SIZE = 64`
- `MAX_RESPONSE_SIZE = 64`

HID 报告描述符定义了：

- 64 字节 Input Report
- 64 字节 Output Report
- 64 字节 Feature Report

请求和响应通过 HID Interrupt OUT / IN 传输。描述符中的 Feature Report 未实现：`GET_REPORT(Feature)` 返回空数据，`SET_REPORT` 返回不支持。

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
- 复位 shadow 状态（SWDIO=1、nRESET=1）

---

## 4. `DAP_Info` 关键字段

当前实现中，关键 `DAP_Info` 字段行为为：

- `CAPABILITIES`：`DAP_CAP_SWD`；设置了 JTAG 后端时加上 `DAP_CAP_JTAG`
- `PACKET_COUNT`：`1`
- `PACKET_SIZE`：`64`
- `TIMESTAMP_CLOCK`：`1,000,000`

说明：

- `PACKET_SIZE` 与 HID v1 的固定 64-byte report 长度一致
- 与 DAPLinkV2 不同，这里没有可变的 Bulk packet-size 暴露语义

---

## 5. 支持的命令范围

支持的命令：

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
- `DAP_JTAG_Sequence` / `DAP_JTAG_Configure` / `DAP_JTAG_IDCODE`（JTAG 可用时）
- `DAP_QueueCommands` / `DAP_ExecuteCommands`：返回 `<CMD, DAP_ERROR>`

实现边界：

- `PACKET_COUNT` 固定为 `1`。

---

## 6. 运行时行为

该类内部维护 SWJ shadow pin 状态、当前 `debug_port` 和 `transfer_abort` 标志。

请求处理分三步：

1. 主机通过 Interrupt OUT 发送 HID Output Report
2. 设备在 `OnDataOutComplete()` 中解析请求，把响应写入 IN 端点缓冲区
3. IN 端点空闲时立即发送；正在发送时，响应留在双缓冲的另一半，上一次发送完成后发出

---

## 7. 使用示例

```cpp
#include "daplink_v1.hpp"

extern LibXR::Debug::Swd& swd;  // 平台提供的 SWD 后端
extern LibXR::GPIO& nreset;     // 可选的 nRESET 引脚

using EPNumber = LibXR::USB::Endpoint::EPNumber;

LibXR::USB::DapLinkV1Class<LibXR::Debug::Swd> dap(EPNumber::EP1, EPNumber::EP1, swd,
                                                  &nreset);

LibXR::USB::DapLinkV1Class<LibXR::Debug::Swd>::InfoStrings info;
info.vendor = "XRobot";
info.product = "DAPLinkV1";
info.serial = "00000001";
info.firmware_ver = "1.0.0";
dap.SetInfoStrings(info);

// USB device class list: {{&dap}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

---

## 8. 与 DAPLinkV2 的区别

- `DapLinkV1Class`：HID transport, `PACKET_SIZE=64`, `PACKET_COUNT=1`
- `DapLinkV2Class`：Bulk 传输，默认 `PACKET_SIZE=1024`、`PACKET_COUNT=4`

如果主机工具链支持 CMSIS-DAP v2 Bulk，一般优先使用 `DapLinkV2Class`；
如果需要兼容仍依赖 HID 报告路径的主机，则使用 `DapLinkV1Class`。
