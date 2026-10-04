---
id: xrusb-dev-stack-gsusb
title: GSUSB
sidebar_position: 4
---

# GSUSB 设备协议栈

本文档描述 XRUSB 的 GSUSB（Linux `gs_usb`）设备类实现：`LibXR::USB::GsUsbClass<CanChNum>`。

该设备类面向 Linux/SocketCAN 生态的 USB-to-CAN 使用方式，采用 Vendor Interface + Bulk IN/OUT 的传输模型，实现 `gs_usb` 协议常用控制面与数据面。

支持能力：

- 经典 CAN（Classic CAN）：最大 8 字节数据
- CAN FD（可选）：最大 64 字节数据区，DLC 映射遵循 FD 表
- TX echo：回送 `echo_id`，用于主机侧 TX buffer 跟踪
- 可选时间戳字段：`timestamp_us`（4 字节）追加在 wire frame 末尾，数值来自 `LibXR::Timebase::GetMicroseconds()` 的低 32 位
- 多通道：通道数由模板参数 `CanChNum` 编译期固定

---

## 1. 类与构造方式

`GsUsbClass<CanChNum>` 中 `CanChNum` 为编译期固定的 CAN 通道数（`1..255`），通道号对外以 `uint8_t` 表示。构造时需提供等于 `CanChNum` 数量的通道对象指针列表。

该类同时兼容 Classic CAN 与 FDCAN（启用 FD 能力），通过不同构造函数区分。

### 1.1 Classic CAN 构造

```cpp
GsUsbClass(Endpoint::EPNumber data_in_ep_num,
           Endpoint::EPNumber data_out_ep_num,
           std::initializer_list<LibXR::CAN*> cans,
           size_t rx_queue_size = 32,
           size_t echo_queue_size = 32,
           LibXR::GPIO* identify_gpio = nullptr,
           std::initializer_list<LibXR::GPIO*> termination_gpios = {},
           LibXR::Database* database = nullptr,
           const char* interface_string = DEFAULT_INTERFACE_STRING);  // "XRUSB GS USB"
```

要点：

- `cans`：Classic CAN 指针列表，数量必须等于 `CanChNum`
- 端点号必须显式给出；旧版内核的 `gs_usb` 驱动固定使用 EP1 IN / EP2 OUT，取这两个端点号可以兼容这些内核
- Linux `gs_usb` 驱动通常会通过 VID:PID 白名单匹配设备，并要求匹配到 `bInterfaceNumber == 0` 的 USB interface（建议将该类放在配置中的第一个 interface）

### 1.2 FDCAN 构造（启用 FD）

```cpp
GsUsbClass(Endpoint::EPNumber data_in_ep_num,
           Endpoint::EPNumber data_out_ep_num,
           std::initializer_list<LibXR::FDCAN*> fd_cans,
           size_t rx_queue_size = 32,
           size_t echo_queue_size = 32,
           LibXR::GPIO* identify_gpio = nullptr,
           std::initializer_list<LibXR::GPIO*> termination_gpios = {},
           LibXR::Database* database = nullptr,
           const char* interface_string = DEFAULT_INTERFACE_STRING);  // "XRUSB GS USB"
```

要点：

- `fd_cans`：FDCAN 指针列表，数量必须等于 `CanChNum`
- FD 能力是否真正可用，取决于设备端是否启用 FD 支持、以及主机侧是否通过控制面将对应通道置为 FD 模式

---

## 2. USB 接口与端点

### 2.1 接口描述符

`GsUsbClass` 暴露 1 个接口，不使用 IAD。接口的 class/subclass/protocol 固定为 `0xFF/0xFF/0xFF`（Vendor Specific），端点数为 2。

### 2.2 Bulk 端点

- Bulk OUT：Host → Device（主机下发 CAN/FD 帧，同时携带 `echo_id` 用于 TX echo）
- Bulk IN：Device → Host（设备上报 RX 帧/错误帧，以及 TX echo 回包）

端点最大传输长度由底层 `Endpoint` 实现决定；配置时以 `UINT16_MAX` 作为上限。

---

## 3. gs_usb wire format（数据面）

所有 Bulk 数据帧都以固定 12 字节头开头（小端）：

```text
struct WireHeader {
  uint32_t echo_id;   // Echo ID
  uint32_t can_id;    // CAN ID (with flags)
  uint8_t  can_dlc;   // DLC
  uint8_t  channel;   // Channel index
  uint8_t  flags;     // GS_CAN_FLAG_*
  uint8_t  reserved;
}
```

约定：

- 设备上报 RX 帧时使用 `ECHO_ID_RX = 0xFFFFFFFF`
- 主机下发帧若 `echo_id != 0xFFFFFFFF`，设备会在发送路径中生成对应的 TX echo 事件回送给主机

负载与长度：

- Classic CAN：payload 固定 8 字节
- CAN FD：payload 固定 64 字节
- 可选时间戳：若该通道启用时间戳，则在 payload 后追加 4 字节 `timestamp_us`（微秒，低 32 位）

总长度：

- Classic：`12 + 8`（或 `12 + 8 + 4`）
- FD：`12 + 64`（或 `12 + 64 + 4`）

### 3.1 DLC 与 FD 映射

- Classic：`can_dlc` 上限为 8（超过会被钳制为 8）
- FD：`can_dlc` 按 FD DLC 映射表转换为长度 `0..64`

| DLC | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 9   | 10  | 11  | 12  | 13  | 14  | 15  |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LEN | 0   | 1   | 2   | 3   | 4   | 5   | 6   | 7   | 8   | 12  | 16  | 20  | 24  | 32  | 48  | 64  |

---

## 4. 生命周期：BindEndpoints / UnbindEndpoints

### 4.1 BindEndpoints

初始化阶段主要完成：

- 分配/配置 Bulk IN/OUT 端点，生成并提交配置描述符（Interface + 2x Endpoint）
- 注册端点回调：
  - OUT 完成：解析主机下发 wire frame
  - IN 完成：尝试继续发送下一帧
- 复位运行态，并让 OUT 端点保持接收状态，主机可以连续下发数据
- 注册 CAN RX 回调（用于将接收帧/错误帧入队并触发发送）

### 4.2 UnbindEndpoints

解绑阶段主要完成：

- 关闭端点并归还到 `EndpointPool`
- 清理关键状态（包括 host_format 协商状态、通道开关位等）

---

## 5. Host → Device（Bulk OUT）

设备收到一帧 OUT 数据后，会：

1. 解析 `WireHeader` 并校验 `channel` 合法且对应通道对象存在
2. 根据 `flags` 判断 Classic/FD，并检查该通道是否已启用（例如：FD 需要设备与主机都启用）
3. 将 wire frame 转换为 CAN/FDCAN pack，提交到对应通道发送队列
4. 若 `echo_id != 0xFFFFFFFF`，生成一个 echo 事件入队，后续由 Bulk IN 回送给主机
5. 重新挂起 OUT 接收（在队列容量允许时）

---

## 6. Device → Host（Bulk IN）

设备向主机发送的数据来源分为两类：

1. TX echo（优先级更高）：用于主机跟踪发送完成
2. RX 上报：通道接收的 Classic/FD 帧，以及错误帧（可选）

发送策略要点：

- 只有当 IN 端点处于空闲态时才会启动一次发送
- 出队顺序为：echo 优先，其后才是 RX 上报
- IN 发送完成回调会触发下一次尝试发送，实现连续输出

---

## 7. 控制面：Vendor Request（gs_usb BREQ）

`GsUsbClass` 不实现标准 Class Request，所有控制面均通过 Vendor Request（gs_usb BREQ）完成。

### 7.1 读（Device → Host）

常见读请求包括（按通道或全局）：

- bit timing 常量 / 扩展常量（FD 能力）
- 设备配置（通道数、版本等）
- 时间戳（us，低 32 位）
- 终端电阻状态、通道错误状态
- USER_ID（来自 RAM 或 Database）

### 7.2 写（Host → Device）

常见写请求包括（按通道）：

- `HOST_FORMAT`：主机格式协商
- `BITTIMING`：仲裁相位 bit timing
- `DATA_BITTIMING`：数据相位 bit timing（FD）
- `MODE`：START/RESET 与模式标志（loopback/listen-only/one-shot 等）
- 错误帧上报开关、Identify GPIO、终端电阻开关、USER_ID 写入

### 7.3 HOST_FORMAT 约束

需要先通过 `HOST_FORMAT` 完成主机格式协商。未协商通过时，部分配置类请求（如 BITTIMING、MODE 等）会被拒绝，以强制主机先完成协商。

---

## 8. 错误帧与时间戳

### 8.1 错误帧（SocketCAN 语义）

Classic CAN 的错误包可转换为主机可识别的 SocketCAN 错误帧（`CAN_ERR_FLAG` 等）。是否上报受通道的错误帧开关控制。

### 8.2 时间戳

当通道启用时间戳时，设备会在 wire frame 尾部追加 `timestamp_us`（4 字节，微秒，低 32 位）；当前实现直接取 `LibXR::Timebase::GetMicroseconds()` 的低 32 位。若该通道未启用时间戳，则该字段不追加。

---

## 9. 使用示例

### 9.1 Classic CAN（2 通道）

```cpp
using Dev = LibXR::USB::GsUsbClass<2>;

Dev gsusb(/*in_ep*/LibXR::USB::Endpoint::EPNumber::EP1,
          /*out_ep*/LibXR::USB::Endpoint::EPNumber::EP2,
          {&can1, &can2},
          /*rx_queue*/64,
          /*echo_queue*/64,
          /*identify*/&led_gpio,
          /*termination*/{&term1_gpio, &term2_gpio},
          /*db*/&db);

// USB device class list: {{&gsusb}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

### 9.2 FDCAN（1 通道）

```cpp
using Dev = LibXR::USB::GsUsbClass<1>;

Dev gsusb(/*in_ep*/LibXR::USB::Endpoint::EPNumber::EP1,
          /*out_ep*/LibXR::USB::Endpoint::EPNumber::EP2,
          {&fdcan1});
```

主机侧（Linux）一般通过 `gs_usb` 驱动枚举为 SocketCAN 设备（如 `can0`），随后使用 `ip link set can0 up type can bitrate ...` 或 `cansend/candump` 等工具进行收发。
