---
id: xrusb-dev-stack-daplinkv2
title: DAPLinkV2
sidebar_position: 6
---

# DAPLinkV2 设备协议栈

本文档描述 XRUSB 的 CMSIS-DAP v2（Bulk）设备类实现：`LibXR::USB::DapLinkV2Class<SwdPort>`。测试可用的VID:PID：`0x0D28:0x2040`，BCD版本：`0x0201`。

该设备类面向通用 CMSIS-DAP v2 主机工具链（如 pyOCD、OpenOCD 的 CMSIS-DAP backend、DAPLink 兼容客户端等）的 USB Bulk 传输方式，采用 1 个 Vendor Interface + 2 个 Bulk 端点（1 IN + 1 OUT）的传输模型，实现 DAP v2 常用命令子集（以 SWD 为主），并提供 Windows 侧即插即用的 WinUSB（MS OS 2.0）能力宣告。

DAPLink 设备通常与其他 USB Class（例如 CDC 虚拟串口）组合使用。上位机识别设备时也常会查找带有 `CMSIS-DAP` 字符串的设备，因此建议的 LanguagePack 为：

```cpp
static constexpr auto USB_FS_LANG_PACK =
    LibXR::USB::DescriptorStrings::MakeLanguagePack(
        LibXR::USB::DescriptorStrings::Language::EN_US, "XRobot", "CMSIS-DAP",
        "XRUSB-DEMO-XRDAP-");
```

支持能力：

- CMSIS-DAP v2 Bulk transport
- SWD；设置 JTAG 后端后 `DAP_Connect` 也可连接 JTAG
- 可选 nRESET 控制（通过 `GPIO* nreset_gpio` 注入，缺省为不支持）
- SWJ_Pins shadow 语义（SWDIO/SWCLK 以 shadow 状态对主机表现；nRESET 若连线可返回真实电平）
- WinUSB（MS OS 2.0）BOS 平台能力（CompatibleID="WINUSB" + DeviceInterfaceGUIDs）
- DAP_Transfer / DAP_TransferBlock（含 AP posted-read pipeline；Transfer 支持 match / timestamp 约束检查）

---

## 1. 类与构造方式

### 1.1 `LibXR::USB::DapLinkV2Class<SwdPort>`

该类为模板类，SWD 后端类型由模板参数 `SwdPort` 指定。`SwdPort` 需提供本类用到的 SWD 能力（进入/关闭 SWD、DP/AP 读写事务、序列读写、设置时钟与传输策略等）。

构造函数：

```cpp
template <typename SwdPort, uint16_t DefaultDapPacketSize = 512,
          uint8_t AdvertisedPacketCount = 8, uint16_t MaxDapPacketSize = 1024,
          uint16_t QueuedRequestBufferSize = 2048, uint16_t QueuedCommandCountMax = 255>
explicit DapLinkV2Class(
    Endpoint::EPNumber data_in_ep_num,
    Endpoint::EPNumber data_out_ep_num,
    SwdPort& swd_link,
    LibXR::GPIO* nreset_gpio = nullptr,
    const char* interface_string = DEFAULT_INTERFACE_STRING);  // "CMSIS-DAP v2"
```

参数说明：

- `swd_link`：SWD 链路对象引用（`SwdPort` 实例）。
- `nreset_gpio`：可选 nRESET GPIO；若为空则 reset 相关命令以 best-effort 方式处理。
- `data_in_ep_num` / `data_out_ep_num`：Bulk IN/OUT 端点号（必填）。
- `MaxDapPacketSize`：`PACKET_SIZE`，超过 1279 时按 1279；为 0 时改用 `DefaultDapPacketSize`
- `AdvertisedPacketCount`：对主机实际暴露的 `PACKET_COUNT` 钳制到 4
- `QueuedRequestBufferSize` / `QueuedCommandCountMax`：`DAP_QueueCommands` 排队缓冲区字节数和最多排队命令数

常用接口：

- `SetInfoStrings(info)`：覆盖 `DAP_Info` 字符串。
- `GetState()`：获取内部 DAP 状态结构（读）。
- `IsInited()`：是否已完成绑定初始化。
- `SetJtag(jtag)`：设置 JTAG 后端（`LibXR::Debug::Jtag*`）。包含 `daplink_v2_profile_swd.hpp` 时 JTAG 在编译期关闭，`SetJtag()` 不起作用；直接包含 `daplink_v2.hpp` 或 `daplink_v2_profile_jtag.hpp` 时 JTAG 可用。

### 1.2 InfoStrings

`DAP_Info` 字符串集合：

```cpp
struct InfoStrings {
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

返回约定：

- 字符串返回包含末尾 NUL。
- 截断时保证以 NUL 结尾。

---

## 2. USB 接口与端点

### 2.1 接口描述符

`DapLinkV2Class` 贡献 1 个接口，不使用 IAD：

- `GetInterfaceCount() = 1`
- `HasIAD() = false`

接口 class 固定为 `0xFF`（Vendor Specific），并暴露 2 个 Bulk 端点。

### 2.2 Bulk 端点

- Bulk OUT：Host → Device（DAP 请求包）
- Bulk IN：Device → Host（DAP 响应包）

端点分配与配置发生在 `BindEndpoints()`：

- 按构造时给出的端点号从 `EndpointPool` 取得 OUT/IN 端点。
- 端点类型为 BULK；最大传输长度以 `UINT16_MAX` 作为上限，底层会选择合法值。
- 配置描述符中的 `wMaxPacketSize` 来自端点对象的 `MaxPacketSize()`。

---

## 3. WinUSB（MS OS 2.0）支持

该类在 BOS 中声明 MS OS 2.0 平台能力，并提供 MS OS 2.0 descriptor set：

- BOS Capability：MS OS 2.0 Platform Capability（数量 1）
- Vendor code：`0x20`
- Compatible ID：`"WINUSB"`
- DeviceInterfaceGUIDs（REG_MULTI_SZ，UTF-16LE）：`{CDB3B5AD-293B-4663-AA36-1AAE46463776}`（单 GUID + 双 NUL 结束）

接口号在绑定时确定，因此 function subset 的 `bFirstInterface` 会在 `BindEndpoints()` 时更新，以确保 Windows 枚举一致。

---

## 4. 传输模型（Bulk 请求/响应）

本类实现 CMSIS-DAP v2 over Bulk 的请求/响应模型：

1. 主机向 Bulk OUT 发送一帧请求。
2. 设备在 OUT 完成回调中解析请求：IN 空闲时直接在 IN 缓冲区生成响应并发送；IN 正在发送时写入双缓冲的另一半或响应队列。
3. 已生成未发完的响应少于 `PACKET_COUNT`（4）时，设备立即重新挂起 OUT 接收下一帧；达到上限后，等 IN 完成再挂起。
4. 每次 IN 完成后发送下一份待发响应。

---

## 5. 生命周期：Bind / Unbind

### 5.1 `BindEndpoints(endpoint_pool, start_itf_num, in_isr)`

要点：

- 记录 `interface_num_ = start_itf_num`，并更新 WinUSB function subset 的接口号字段。
- 分配并配置 Bulk OUT/IN 端点，注册回调。
- 生成并提交配置描述符块（Interface + 2x Endpoint）。
- 运行时默认值：
  - `debug_port = DISABLED`
  - `transfer_abort = false`
  - `swj_clock_hz = 1MHz` 并同步到 `swd_link`
  - SWJ shadow 默认：SWDIO=1、nRESET=1、SWCLK=0
- 置 `inited_=true`，arm OUT 接收。

### 5.2 `UnbindEndpoints(endpoint_pool, in_isr)`

要点：

- 清运行态标志并关闭 SWD 后端。
- 关闭并释放 IN/OUT 端点，归还给端点池。
- 复位 shadow 默认值（SWDIO=1、nRESET=1、SWCLK=0）。

---

## 6. 运行时状态与默认值

### 6.1 DAP 状态

内部状态结构 `LibXR::USB::DapLinkV2Def::State` 关键字段包括：

- `debug_port`：默认 DISABLED；CONNECT 后为 SWD 或 JTAG
- `transfer_abort`：TransferAbort 标志
- `transfer_cfg`：TransferConfigure 解析后的策略（idle_cycles / retry_count / match_retry）

### 6.2 SWJ 时钟

- 默认：`1,000,000 Hz`
- `DAP_SWJ_Clock` 更新内部变量并调用 `swd_link.SetClockHz(hz)`。

### 6.3 SWJ shadow 语义

类内部维护 SWJ pin shadow：

- 默认：SWDIO=1、nRESET=1、SWCLK=0
- `DAP_SWJ_Pins` 会对被选择的 pin 更新 shadow
- nRESET：
  - 若 `nreset_gpio` 存在，则会驱动 GPIO；读取时返回真实电平
  - 若 `nreset_gpio` 不存在，则按 shadow 表现

---

## 7. 命令集（实现概览）

命令分发逻辑位于 `ProcessOneCommand()`，以请求首字节 `CMD` 决定处理器；未识别命令返回单字节 `0xFF`。

### 7.1 已实现命令列表

| Command                 |                   ID | 行为概述                                                                                 |
| ----------------------- | -------------------: | ---------------------------------------------------------------------------------------- |
| `DAP_Info`              |               `INFO` | 返回字符串/数值信息（含 CAPABILITIES / PACKET_COUNT / PACKET_SIZE / TIMESTAMP_CLOCK 等） |
| `DAP_HostStatus`        |        `HOST_STATUS` | 返回 OK                                                                                  |
| `DAP_Connect`           |            `CONNECT` | 连接 SWD；设置 JTAG 后端后也可连接 JTAG；返回实际端口                                    |
| `DAP_Disconnect`        |         `DISCONNECT` | 关闭 SWD 和已设置的 JTAG 后端，回到 DISABLED                                             |
| `DAP_TransferConfigure` | `TRANSFER_CONFIGURE` | 设置 idle_cycles / retry / match_retry，并映射到 SWD policy                              |
| `DAP_Transfer`          |           `TRANSFER` | DP/AP 读写；支持 match / timestamp；AP posted-read pipeline                              |
| `DAP_TransferBlock`     |     `TRANSFER_BLOCK` | DP/AP block 读写；AP read 使用 posted pipeline；不支持 match/timestamp                   |
| `DAP_TransferAbort`     |     `TRANSFER_ABORT` | 置 abort 标志，下一次 Transfer/Block 返回错误并清标志                                    |
| `DAP_WriteABORT`        |        `WRITE_ABORT` | 写 ABORT，按 ack/EC 返回 OK/ERROR                                                        |
| `DAP_Delay`             |              `DELAY` | 微秒延时                                                                                 |
| `DAP_ResetTarget`       |       `RESET_TARGET` | 若有 nRESET 则执行脉冲并 Execute=1；否则 Execute=0；始终返回 DAP_OK                      |
| `DAP_SWJ_Pins`          |           `SWJ_PINS` | 更新 shadow 并 best-effort 控制 nRESET；支持 PinWait                                     |
| `DAP_SWJ_Clock`         |          `SWJ_CLOCK` | 更新 SWJ clock                                                                           |
| `DAP_SWJ_Sequence`      |       `SWJ_SEQUENCE` | 写入 SWJ bit 序列（LSB-first），并更新 shadow（SWDIO=last bit, SWCLK=0）                 |
| `DAP_SWD_Configure`     |      `SWD_CONFIGURE` | best-effort 解析，返回 OK                                                                |
| `DAP_SWD_Sequence`      |       `SWD_SEQUENCE` | 多段输入/输出序列；输入数据追加在响应尾部（LSB-first）                                   |
| `DAP_JTAG_Sequence`     |      `JTAG_SEQUENCE` | JTAG 可用时处理                                                                          |
| `DAP_JTAG_Configure`    |     `JTAG_CONFIGURE` | JTAG 可用时处理                                                                          |
| `DAP_JTAG_IDCODE`       |        `JTAG_IDCODE` | JTAG 可用时处理                                                                          |
| `DAP_QueueCommands`     |     `QUEUE_COMMANDS` | 把请求中的命令追加到排队缓冲区，返回 `<CMD, DAP_OK>`；超过 `QueuedRequestBufferSize` / `QueuedCommandCountMax` 或格式错误时返回 `<CMD, DAP_ERROR>` |
| `DAP_ExecuteCommands`   |   `EXECUTE_COMMANDS` | 依次执行已排队的命令，响应为 `CMD` 字节后接各命令的响应；失败返回 `<CMD, DAP_ERROR>`     |

注：具体数值 ID 取决于 `DapLinkV2Def::CommandId` 的定义；本文以枚举名表示。

### 7.2 `DAP_Info` 关键字段

- `CAPABILITIES`：`DAP_CAP_SWD`；设置了 JTAG 后端时加上 `DAP_CAP_JTAG`
- `PACKET_COUNT`：默认返回 `4`。虽然类模板默认的声明值是 `8`，但当前实现会把实际对主机暴露的数量钳制到 `4`。
- `PACKET_SIZE`：`MaxDapPacketSize`，默认 1024。端点的 `MaxTransferSize()` 不影响该值，只决定一个 DAP 包是否分成多次 Bulk 传输收发
- `TIMESTAMP_CLOCK`：`1,000,000`（与微秒时间基准匹配）

---

## 8. 使用示例

### 8.1 设备侧初始化（示意）

```cpp
#include "daplink_v2.hpp"

extern LibXR::Debug::Swd& swd;  // 平台提供的 SWD 后端
extern LibXR::GPIO& nreset;     // 可选的 nRESET 引脚

using EPNumber = LibXR::USB::Endpoint::EPNumber;

LibXR::USB::DapLinkV2Class<LibXR::Debug::Swd> dap(EPNumber::EP1, EPNumber::EP1, swd,
                                                  &nreset);

LibXR::USB::DapLinkV2Class<LibXR::Debug::Swd>::InfoStrings info;
info.vendor = "XRobot";
info.product = "DAPLinkV2";
info.serial = "00000001";
info.firmware_ver = "2.0.0";
dap.SetInfoStrings(info);

// USB device class list: {{&dap}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

### 8.2 Windows/WinUSB 侧访问

该类通过 BOS/MS OS 2.0 描述符集声明 WinUSB 与 DeviceInterfaceGUIDs，Windows 通常可在无需自定义 INF 的情况下枚举为 WinUSB 设备，并可通过 GUID 在用户态进行枚举与打开。
