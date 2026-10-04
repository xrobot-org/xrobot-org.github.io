---
id: xrusb-dev-stack-cdc
title: CDC
sidebar_position: 1
---

# CDC 设备协议栈

本节介绍 XRUSB 的 USB CDC ACM（虚拟串口）设备类实现，重点覆盖：

- 描述符组织方式（IAD + Communication Interface + Data Interface）
- 端点资源申请、配置与回调分发
- CDC ACM 标准类请求处理（Line Coding / Control Line State）
- Serial State 通知的格式与发送策略
- 上层适配（`CDCUart` / `CDCToUart`）与吞吐测试类（`CDCWriteTest` / `CDCReadTest`）

当前 CDC 协议栈由以下头文件构成（源码随仓库提供）：

- `cdc_base.hpp`：CDC ACM 通用基类（描述符 / 类请求 / 端点管理 / 回调分发）
- `cdc_uart.hpp`：CDC ↔ UART 语义适配（对上提供 `LibXR::UART` 的 Read/Write）
- `cdc_to_uart.hpp`：CDC ↔ UART 双向桥接（`CDCToUart`，CDC到外部 UART 持续搬运）
- `cdc_test.hpp`：吞吐测试用类（持续写出 / 持续读入）

---

## 组件概览

### `LibXR::USB::CDCBase`

`CDCBase` 继承自 `DeviceClass`，实现 CDC ACM 的通用部分：

- 端点资源申请与配置（Data IN / Data OUT / Comm IN）
- IAD + 通信接口 + 数据接口的配置描述符块填充
- CDC ACM 标准类请求处理（`GET_LINE_CODING` / `SET_LINE_CODING` / `SET_CONTROL_LINE_STATE` / `SEND_BREAK`；`SEND_BREAK` 只回复 ZLP）
- 通过回调将控制线变化（DTR/RTS）、线路参数变化（Line Coding）通知给上层
- 提供收发完成钩子（`OnDataOutComplete` / `OnDataInComplete`）供派生类实现具体数据通路

`CDCBase` 不直接实现数据通路；派生类需要实现：

```cpp
virtual void OnDataOutComplete(bool in_isr, ConstRawData& data) = 0;
virtual void OnDataInComplete(bool in_isr, ConstRawData& data) = 0;
```

回调由端点传输完成触发，并由 `CDCBase` 的静态 trampoline 做 `inited_` 防护后分发。

### `LibXR::USB::CDCUart`

`CDCUart` 在 `CDCBase` 的基础上再继承 `LibXR::UART`，对上层暴露典型串口语义：

- `Read()`：从主机发来的 OUT 数据中读取
- `Write()`：向主机发送 IN 数据
- `SetConfig()`：把 UART 配置映射到 CDC Line Coding，并发送一次 Serial State 通知

它内部使用 `LibXR::ReadPort` / `LibXR::WritePort` 做软件缓冲与写队列管理，并在端点回调中完成数据入队/出队；RX 队列空间不足时，暂存本次收到的数据并暂停 OUT 接收；上层读走数据后，再写入暂存数据并重新启动接收。

### `LibXR::USB::CDCToUart`

`CDCToUart` 继承自 `CDCUart`，用于把 USB CDC 虚拟串口与一个“外部 `LibXR::UART` 实例”做双向桥接：

- CDC RX → UART TX：CDC 收到的 OUT 数据写入 UART
- UART RX → CDC TX：UART 收到的数据写入 CDC

实现方式为回调链：一侧的写操作完成后启动下一次读，从而持续转发数据。

注意事项：

- 构造函数会进行动态内存分配（为 RX/TX 临时缓存申请堆内存）。
- 被桥接 UART 写端口的容量不能小于 `rx_buffer_size`（构造函数中有断言）。
- 该类在构造结束时会各自挂起一次 CDC 读与 UART 读（`Read({nullptr,0}, ...)`）以进入回调链。
- 构造函数用 `SetOnSetLineCodingCallback()` 注册了自己的回调，把主机设置的 Line Coding 转发给被桥接 UART 的 `SetConfig()`；对 `CDCToUart` 再调用 `SetOnSetLineCodingCallback()` 会替换这一转发。

### `LibXR::USB::CDCWriteTest` / `LibXR::USB::CDCReadTest`

两者均派生自 `CDCBase`，用于验证链路吞吐与驱动稳定性：

- `CDCWriteTest`：忽略主机发来的 OUT 数据；当 DTR 已置位时，持续通过 Data IN 回传数据（测试设备 → 主机通路）
- `CDCReadTest`：在 `CDCBase` 已预装一次 `MaxPacketSize()` 接收的基础上，额外用 `MaxTransferSize()` 重新预装 OUT 端点，并在完成后立即以 `MaxTransferSize()` 重启（测试主机 → 设备通路）

---

## 接口与端点布局

### 接口（Interface）

CDC ACM 设备以两接口（Communication + Data）的方式呈现，并带 IAD（Interface Association Descriptor），便于主机将其识别为一个 CDC 复合功能。

- 通信接口（Communication Interface）：包含 1 个 Interrupt IN 端点（Notification Endpoint）
- 数据接口（Data Interface）：包含 1 个 Bulk OUT + 1 个 Bulk IN（数据收发）

`CDCBase::GetInterfaceCount()` 固定返回 `2`，`HasIAD()` 固定返回 `true`。

说明：

- IAD 的 `bFirstInterface` 由 `start_itf_num` 偏移得到
- Communication Interface 通常是 class request 的目标接口（`wIndex` 指向该接口号）
- `CDCBase` 内部记录通信接口号 `itf_comm_in_num_ = start_itf_num`，用于 Serial State 通知的 `wIndex`

### 端点（Endpoint）

`CDCBase::BindEndpoints()` 从 `EndpointPool` 申请并配置以下端点：

| 端点     | 方向 | 类型      | 典型用途                    |
| -------- | ---- | --------- | --------------------------- |
| Data OUT | OUT  | BULK      | 主机 → 设备 数据接收        |
| Data IN  | IN   | BULK      | 设备 → 主机 数据发送        |
| Comm IN  | IN   | INTERRUPT | CDC 通知（Serial State 等） |

Comm IN 端点最大包大小固定为 16 字节；Serial State 通知本身为 10 字节结构（见下文）。

构造 `CDCBase` 派生类时依次给出端点号：数据 IN、数据 OUT、通知 IN。数据 IN 与数据 OUT 可以使用同一个端点号（例如都用 EP1），通知端点使用另一个端点号。`CDCUart`、`CDCWriteTest`、`CDCReadTest` 的构造函数末尾还有两个接口字符串参数，默认为 `"XRUSB CDC Control"` 和 `"XRUSB CDC Data"`；`CDCToUart` 没有这两个参数。

### 速度与最大包大小

Data IN/OUT 的描述符 `wMaxPacketSize` 取自端点对象的 `MaxPacketSize()`。

- Full-Speed Bulk 典型为 64 bytes/packet
- High-Speed Bulk 典型为 512 bytes/packet（若平台支持 HS）

实际值以平台 USB 控制器与端点实现为准。协议栈在描述符中写入端点报告的值。

---

## CDCBase 关键能力

### DTR/RTS 控制线状态

`CDCBase` 内部维护控制线状态 `control_line_state_`，并提供：

```cpp
bool IsDtrSet() const;
bool IsRtsSet() const;
```

当收到类请求 `SET_CONTROL_LINE_STATE` 时，行为为：

- 更新 `control_line_state_`（来自 `wValue`）
- 返回 ZLP（Zero-Length Packet）确认
- 调用 `SendSerialState()` 尝试通过 Comm IN 上报当前串行状态
- 触发用户回调 `SetOnSetControlLineStateCallback(cb)`，参数为 `(DTR, RTS)`

工程建议：

- 将 DTR 视作“主机串口已打开/准备通信”的关键信号
- DTR 断开时避免继续发送，避免上层阻塞或无意义的队列堆积

### Line Coding（波特率/校验/停止位/数据位）

CDC ACM 的 Line Coding 通过类请求 `SET_LINE_CODING` / `GET_LINE_CODING` 进行读写。

- `GET_LINE_CODING`：设备返回当前 `line_coding_`（7 字节）
- `SET_LINE_CODING`：控制传输的数据阶段写入 7 字节 `line_coding_`，随后在 `OnClassData()` 中转换为 `LibXR::UART::Configuration` 并回调上层

`SET_LINE_CODING` 的数据长度必须为 7 字节，不符合则返回 `ErrorCode::ARG_ERR`。

#### Line Coding 映射规则

当前 `CDCBase` 将 CDC Line Coding 映射到 `LibXR::UART::Configuration` 的规则如下：

| CDC 字段      | 取值       | 映射到 UART 配置                                     |
| ------------- | ---------- | ---------------------------------------------------- |
| `dwDTERate`   | 任意       | `cfg.baudrate = dwDTERate`                           |
| `bCharFormat` | 0          | `stop_bits = 1`                                      |
| `bCharFormat` | 2          | `stop_bits = 2`                                      |
| `bCharFormat` | 其他       | 降级为 `stop_bits = 1`（`1.5 stop bits` 目前未实现） |
| `bParityType` | 1          | `parity = ODD`                                       |
| `bParityType` | 2          | `parity = EVEN`                                      |
| `bParityType` | 其他       | 降级为 `NO_PARITY`（Mark/Space 将降级）              |
| `bDataBits`   | 5/6/7/8/16 | `data_bits = bDataBits`（透传）                      |

提示：

- USB CDC 的 Line Coding 在多数桌面 OS 上更多是“协商/提示”，是否真正影响主机侧串口参数取决于驱动策略
- 若用于桥接真实 UART 外设，请以回调参数为准并在外设侧做合法性校验

---

## Serial State 通知

`SendSerialState()` 通过 Comm IN（Interrupt IN）端点向主机发送 Serial State 通知。

通知结构为 10 字节：

- 8 字节 CDC Notification Header
- 2 字节 UART state 位图 `serialState`

代码中结构体定义为：

```cpp
#pragma pack(push, 1)
struct SerialStateNotification
{
  uint8_t  bmRequestType;   // 固定 0xA1
  uint8_t  bNotification;   // 固定 SERIAL_STATE (0x20)
  uint16_t wValue;          // 固定 0
  uint16_t wIndex;          // Interface number（Communication Interface）
  uint16_t wLength;         // 固定 2
  uint16_t serialState;     // UART state bitmap
};
#pragma pack(pop)
```

---

## 回调与执行上下文

`CDCBase` 对外提供两类上层回调：

- `SetOnSetControlLineStateCallback(LibXR::Callback<bool, bool> cb)`
- `SetOnSetLineCodingCallback(LibXR::Callback<LibXR::UART::Configuration> cb)`

---

## 初始化与资源释放行为

### 绑定端点

`CDCBase::BindEndpoints(endpoint_pool, start_itf_num, in_isr)` 的关键行为：

- 清零 `control_line_state_`
- 通过 `EndpointPool` 申请三个端点并完成 `Configure`
- 填充 IAD、Communication Interface、Data Interface 与端点描述符块
- 将描述符块通过 `SetData(RawData{...})` 交给设备框架拼入配置描述符
- 注册 Data OUT / Data IN 端点传输完成回调
- 设置 `inited_ = true`
- 启动 Data OUT 预接收：`ep_data_out_->Transfer(ep_data_out_->MaxPacketSize())`

提示：

- OUT 端点预接收长度此处使用 `MaxPacketSize()` 作为首包接收长度，用于尽快进入持续接收循环
- `CDCBase` 不对收到的数据做缓存；派生类需在 `OnDataOutComplete` 中消费并重启 OUT 传输（或按自身策略重启）

### 解绑端点

`CDCBase::UnbindEndpoints(endpoint_pool, in_isr)` 的关键行为：

- `inited_ = false`
- 清零 `control_line_state_`
- 关闭三端点、清零 active length
- 将端点归还给 `EndpointPool`
- 置端点指针为空

`CDCUart::UnbindEndpoints()` 在调用 `CDCBase::UnbindEndpoints()` 之后，只清除零长度包标志和接收暂停状态（`recv_pause_` / `pending_data_`）；发送队列中尚未发出的数据保留，挂起的写请求不会以错误码结束。

因此，需要跨断开/重连工作的上层应自己管理连接状态与等待时长，并在销毁相关对象前确保不再有回调链继续使用它们。

---

## 使用示例

### 作为 CDC 虚拟串口使用（推荐：`CDCUart`）

```cpp
#include "cdc_uart.hpp"

using EPNumber = LibXR::USB::Endpoint::EPNumber;

// 数据 IN EP1，数据 OUT EP1，通知 IN EP2
LibXR::USB::CDCUart cdc_uart(EPNumber::EP1, EPNumber::EP1, EPNumber::EP2,
                             /*rx*/ 256, /*tx*/ 256, /*tx_queue*/ 8);

// 设备构造时把 &cdc_uart 放入 class 列表：{{&cdc_uart}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

可选：监听主机对 Line Coding / DTR/RTS 的变化：

```cpp
cdc_uart.SetOnSetLineCodingCallback(
  LibXR::Callback<LibXR::UART::Configuration>::Create(
    [](bool in_isr, int, LibXR::UART::Configuration cfg) {
      (void)in_isr;
      // 可在此同步到真实 UART 外设（注意 ISR 场景下不要阻塞）
    },
    0
  )
);

cdc_uart.SetOnSetControlLineStateCallback(
  LibXR::Callback<bool, bool>::Create(
    [](bool in_isr, int, bool dtr, bool rts) {
      (void)in_isr;
      (void)rts;
      // dtr=true 表示主机已打开串口，可开始发送
    },
    0
  )
);
```

### CDC ↔ 外部 UART 双向桥接（`CDCToUart`）

```cpp
#include "cdc_to_uart.hpp"

extern LibXR::UART& uart1;  // 被桥接的硬件 UART

LibXR::USB::CDCToUart cdc_to_uart(
  LibXR::USB::Endpoint::EPNumber::EP1,  // 数据 IN
  LibXR::USB::Endpoint::EPNumber::EP1,  // 数据 OUT
  LibXR::USB::Endpoint::EPNumber::EP2,  // 通知 IN
  uart1,
  /*rx_buffer_size*/ 128,
  /*tx_buffer_size*/ 128,
  /*tx_queue_size*/  5
);

// 设备构造时把 &cdc_to_uart 放入 class 列表：{{&cdc_to_uart}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

### 吞吐测试

写测试：

```cpp
#include "cdc_test.hpp"
using EPNumber = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::CDCWriteTest cdc_write_test(EPNumber::EP1, EPNumber::EP1, EPNumber::EP2);
```

读测试：

```cpp
#include "cdc_test.hpp"
using EPNumber = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::CDCReadTest cdc_read_test(EPNumber::EP1, EPNumber::EP1, EPNumber::EP2);
```

同样通过 USB Device 的 class 列表传入即可。
