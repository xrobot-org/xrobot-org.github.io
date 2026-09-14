---
id: can
title: 控制器局域网
sidebar_position: 5
---

# CAN / FDCAN（控制器局域网）

`LibXR::CAN` 与 `LibXR::FDCAN` 提供跨平台的控制器局域网通信抽象，支持：

- 经典 CAN 帧 (`ClassicPack`) 与 CAN FD 帧 (`FDPack`) 的统一订阅接口；
- 仲裁相位与数据相位的位时序配置；
- 错误状态查询与虚拟错误帧上报；
- 无锁订阅者列表，支持在 ISR 中安全分发。

适用于车辆通信、传感器网络等实时总线场景。

---

## CAN 抽象接口（`LibXR::CAN`）

### 帧类型 `Type`

```cpp
enum class Type : uint8_t {
  STANDARD = 0,         ///< 标准数据帧（11-bit ID）。Standard data frame (11-bit ID).
  EXTENDED = 1,         ///< 扩展数据帧（29-bit ID）。Extended data frame (29-bit ID).
  REMOTE_STANDARD = 2,  ///< 标准远程帧。Standard remote frame.
  REMOTE_EXTENDED = 3,  ///< 扩展远程帧。Extended remote frame.
  ERROR = 4,            ///< 错误帧（虚拟事件）。Error frame (virtual event).
  TYPE_NUM = 5          ///< 类型数量上界。Number of frame types.
};
```

- `STANDARD` / `EXTENDED`：经典 CAN 数据帧，对应 11/29 bit ID。
- `REMOTE_*`：经典 CAN 远程帧（RTR），不携带有效数据载荷，但 DLC 仍可用于表示“请求的数据长度”（0–8）。
- `ERROR`：虚拟错误帧（不对应实际总线帧），用于通过 `ClassicPack` 上报控制器错误事件。
- `TYPE_NUM`：内部使用，用于为每种帧类型分配订阅者链表数组长度。

> 对于 CAN FD（FD 帧），协议本身不支持 Remote Frame 概念；FD 侧订阅回调当前仅支持 `STANDARD` / `EXTENDED`（见下文 `FDCAN::Register` 约束）。

---

### 位时序与工作模式

#### `BitTiming` – 仲裁相位位时序

```cpp
struct BitTiming {
  uint32_t brp = 0;         ///< 预分频。Baud rate prescaler.
  uint32_t prop_seg = 0;    ///< 传播段。Propagation segment.
  uint32_t phase_seg1 = 0;  ///< 相位段 1。Phase segment 1.
  uint32_t phase_seg2 = 0;  ///< 相位段 2。Phase segment 2.
  uint32_t sjw = 0;         ///< 同步跳宽。Synchronization jump width.
};
```

用于描述仲裁相位（Nominal Phase）的位时序参数，与具体硬件控制器（如 bxCAN、FDCAN 等）的寄存器配置一一对应。

#### `Mode` – 工作模式

```cpp
struct Mode {
  bool loopback = false;         ///< 回环模式。Loopback mode.
  bool listen_only = false;      ///< 只听（静默）模式。Listen-only (silent) mode.
  bool triple_sampling = false;  ///< 三采样。Triple sampling.
  bool one_shot = false;         ///< 单次发送模式。One-shot transmission.
};
```

- `loopback`：启用控制器内部回环，不经物理总线发送。
- `listen_only`：静默监视模式，不主动发送，只监听总线。
- `triple_sampling`：开启三采样，提高抗噪能力（取决于硬件支持）。
- `one_shot`：单次发送模式，发送失败不自动重发。

#### `Configuration` – CAN 配置

```cpp
struct Configuration {
  uint32_t bitrate = 0;       ///< 仲裁相位目标波特率。Target nominal bitrate.
  float sample_point = 0.0f;  ///< 仲裁相位采样点（0~1）。Nominal sample point (0–1).
  BitTiming bit_timing;       ///< 位时序配置。Bit timing configuration.
  Mode mode;                  ///< 工作模式。Operating mode.
};
```

- `bitrate` / `sample_point`：宏观配置，一般供上层位时序计算器使用。
- `bit_timing`：具体位时序参数，通常由平台相关工具或算法生成。
- `mode`：控制器工作模式开关。

#### 配置接口

```cpp
virtual ErrorCode SetConfig(const CAN::Configuration &cfg) = 0;
virtual uint32_t GetClockFreq() const = 0;
```

- `SetConfig`：按照 `Configuration` 配置 CAN 控制器。实现需保证在禁用控制器或安全状态下修改位时序。
- `GetClockFreq`：返回 CAN 外设输入时钟频率（Hz），可用于上层位时序计算。

---

### 错误状态查询 `ErrorState`

```cpp
struct ErrorState {
  uint8_t tx_error_counter = 0;  ///< 发送错误计数 TEC。Transmit error counter (TEC).
  uint8_t rx_error_counter = 0;  ///< 接收错误计数 REC。Receive error counter (REC).

  bool bus_off = false;        ///< 是否处于 BUS-OFF。True if controller is bus-off.
  bool error_passive = false;  ///< 是否处于 Error Passive。True if error-passive.
  bool error_warning = false;  ///< 是否处于 Error Warning。True if error-warning.
};
```

错误状态查询接口：

```cpp
virtual ErrorCode GetErrorState(ErrorState &state) const;
```

- 默认实现返回 `ErrorCode::NOT_SUPPORT`，不修改 `state`。
- 具体实现（如 bxCAN / FDCAN）可重载，从硬件寄存器读取 TEC/REC 及状态位。
- 调用方可根据 `bus_off` / `error_passive` / `error_warning` 实现诊断与容错逻辑。

---

### 经典 CAN 帧结构 `ClassicPack`

```cpp
#pragma pack(push, 1)
struct ClassicPack {
  uint32_t id;      ///< CAN ID（11/29 bit 或 ErrorID）。CAN ID (11/29 bits or ErrorID).
  Type type;        ///< 帧类型。Frame type.
  uint8_t dlc;      ///< 数据长度（0~8）。Data length code (0–8).
  uint8_t data[8];  ///< 数据载荷。Data payload (up to 8 bytes).
};
#pragma pack(pop)
```

- `id`：
  - 对于 `STANDARD`：只使用低 11 bit；
  - 对于 `EXTENDED`：只使用低 29 bit；
  - 对于 `ERROR`：使用错误虚拟 ID（见下文 `ErrorID`）。
- `type`：帧类型。
- `dlc`：数据长度码，范围 `0–8`。
  - 数据帧（`STANDARD` / `EXTENDED`）：表示 `data[]` 有效字节数；
  - 远程帧（`REMOTE_*`）：可用于表示“请求的数据长度”（0–8），`data[]` 无效/忽略。
- `data`：数据载荷，仅对数据帧有意义，远程帧可忽略。

---

### 错误虚拟帧 `ErrorID`

错误事件通过 `ClassicPack::type == Type::ERROR` + 虚拟 ID 上报。虚拟 ID 空间定义如下：

```cpp
static constexpr uint32_t CAN_ERROR_ID_PREFIX = 0xFFFF0000u;

enum class ErrorID : uint32_t {
  CAN_ERROR_ID_GENERIC       = CAN_ERROR_ID_PREFIX,
  CAN_ERROR_ID_BUS_OFF       = CAN_ERROR_ID_PREFIX + 1,
  CAN_ERROR_ID_ERROR_PASSIVE = CAN_ERROR_ID_PREFIX + 2,
  CAN_ERROR_ID_ERROR_WARNING = CAN_ERROR_ID_PREFIX + 3,
  CAN_ERROR_ID_PROTOCOL      = CAN_ERROR_ID_PREFIX + 4,
  CAN_ERROR_ID_ACK           = CAN_ERROR_ID_PREFIX + 5,
  CAN_ERROR_ID_STUFF         = CAN_ERROR_ID_PREFIX + 6,
  CAN_ERROR_ID_FORM          = CAN_ERROR_ID_PREFIX + 7,
  CAN_ERROR_ID_BIT0          = CAN_ERROR_ID_PREFIX + 8,
  CAN_ERROR_ID_BIT1          = CAN_ERROR_ID_PREFIX + 9,
  CAN_ERROR_ID_CRC           = CAN_ERROR_ID_PREFIX + 10,
  CAN_ERROR_ID_OTHER         = CAN_ERROR_ID_PREFIX + 11,
};
```

辅助静态方法：

```cpp
static constexpr uint32_t FromErrorID(ErrorID e) noexcept;
static constexpr bool IsErrorId(uint32_t id) noexcept;
static constexpr ErrorID ToErrorID(uint32_t id) noexcept;
```

- `FromErrorID`：将 `ErrorID` 转为可写入 `ClassicPack::id` 的虚拟 ID。
- `IsErrorId`：判断给定 `id` 是否处于错误 ID 空间（即 `(id & 0xFFFF0000u) == CAN_ERROR_ID_PREFIX`）。
- `ToErrorID`：将虚拟 ID 解释为 `ErrorID` 枚举。

> 由于标准 CAN ID 最大为 11/29 bit，`0xFFFF0000` 虚拟 ID 空间与真实总线 ID 不重叠，不会产生冲突。

典型用法（驱动在检测到错误中断时）：

```cpp
LibXR::CAN::ClassicPack pack{};
pack.type = LibXR::CAN::Type::ERROR;
pack.id   = LibXR::CAN::FromErrorID(LibXR::CAN::ErrorID::CAN_ERROR_ID_BUS_OFF);
pack.dlc  = 0;
pack.data[0] = 0;  // 可选：用于携带附加信息（如实现需要）
can.OnMessage(pack, /*in_isr=*/true);  // 由驱动在接收/错误路径中调用分发
```

---

### 回调与过滤

#### 回调类型

```cpp
using Callback = LibXR::Callback<const ClassicPack &>;
```

回调由 `OnMessage(pack, in_isr)` 触发，内部调用形式为：

```cpp
cb.Run(in_isr, pack);
```

因此用户侧回调可按如下签名实现：

- `in_isr`：指示当前是否在中断上下文中调用。
- 第二个参数是创建回调时绑定的上下文参数；示例使用一个未使用的 `int`。
- `pack`：接收到的帧。

> `pack` 为只读引用，回调实现不得保存该引用用于异步访问。

回调可能在中断上下文中被调用，实现应确保：

- 不执行阻塞操作（如锁等待、长时间 I/O）；
- 不调用不允许在中断中使用的 RTOS API；
- 如需与任务通信，建议仅在线程安全/无锁队列中快速写入数据。

#### 过滤模式 `FilterMode`

```cpp
enum class FilterMode : uint8_t {
  ID_MASK = 0,  ///< 掩码匹配：(id & start_id_mask) == end_id_mask。
                 ///< Mask match: (id & start_id_mask) == end_id_mask.
  ID_RANGE = 1  ///< 区间匹配：start_id_mask <= id && id <= end_id_mask。
                 ///< Range match: start_id_mask <= id && id <= end_id_mask.
};
```

具体语义：

- `ID_MASK` 模式：匹配条件为  
  `(id & start_id_mask) == end_id_mask`
- `ID_RANGE` 模式：匹配条件为  
  `start_id_mask <= id && id <= end_id_mask`

> 其中 `id` 为接收帧 `ClassicPack::id`。使用 `STANDARD` / `EXTENDED` 类型时，上层应确保 `start_id_mask` / `end_id_mask` 在对应位宽内。

#### 过滤器结构 `Filter`

```cpp
struct Filter {
  FilterMode mode;         ///< 过滤模式。Filter mode.
  uint32_t start_id_mask;  ///< 起始 ID 或掩码。Start ID or mask.
  uint32_t end_id_mask;    ///< 结束 ID 或匹配值。End ID or match value.
  Type type;               ///< 帧类型。Frame type.
  Callback cb;             ///< 回调函数。Callback function.
};
```

- 当 `mode == ID_MASK` 时：
  - `start_id_mask` 视为掩码（mask）；
  - `end_id_mask` 为匹配值（match value）。
- 当 `mode == ID_RANGE` 时：
  - `start_id_mask` 为起始 ID（start ID）；
  - `end_id_mask` 为结束 ID（end ID）。

#### 注册回调 `Register`

```cpp
void Register(Callback cb,
              Type type,
              FilterMode mode = FilterMode::ID_RANGE,
              uint32_t start_id_mask = 0,
              uint32_t end_id_mask = UINT32_MAX);
```

- 支持按帧类型（`type`）分别注册回调，内部为每种 `Type` 维护一个订阅者无锁链表。
- 同一帧类型下可注册多个过滤器，所有匹配的回调都会被调用（多订阅者）。
- 默认过滤器为区间 `[0, UINT32_MAX]`，即对指定 `type` 的所有 ID 放行。

示例：订阅所有标准数据帧（11-bit ID）区间 `[0x100, 0x1FF]`：

```cpp
LibXR::CAN &can = ...;

can.Register(
    LibXR::CAN::Callback::Create(
        [](bool in_isr, int, const LibXR::CAN::ClassicPack &pack) {
          (void)in_isr;
          // 快速处理，不要阻塞
        }, 0),
    LibXR::CAN::Type::STANDARD,
    LibXR::CAN::FilterMode::ID_RANGE,
    0x100, 0x1FF);
```

示例：订阅所有错误虚拟帧：

```cpp
can.Register(
    LibXR::CAN::Callback::Create(
        [](bool in_isr, int, const LibXR::CAN::ClassicPack &pack) {
          (void)in_isr;
          if (!LibXR::CAN::IsErrorId(pack.id)) {
            return;
          }
          auto err = LibXR::CAN::ToErrorID(pack.id);
          // 根据 err 做诊断
        }, 0),
    LibXR::CAN::Type::ERROR,
    LibXR::CAN::FilterMode::ID_RANGE,
    LibXR::CAN::FromErrorID(LibXR::CAN::ErrorID::CAN_ERROR_ID_GENERIC),
    LibXR::CAN::FromErrorID(LibXR::CAN::ErrorID::CAN_ERROR_ID_OTHER));
```

---

### 发送与接收分发

#### 发送消息 `AddMessage`（TX）

```cpp
virtual ErrorCode AddMessage(const ClassicPack &pack) = 0;
```

- **发送方向 API（Transmit path）**：由上层调用，用于将 `ClassicPack` 发送到 CAN 总线（具体实现由派生驱动决定：直接发送 / 入硬件 mailbox / 入软件队列）。
- 返回值用于标识发送是否成功（例如：busy、队列满、参数非法等）。

#### 接收分发 `OnMessage`（RX dispatch helper）

```cpp
protected:
  void OnMessage(const ClassicPack &pack, bool in_isr);
```

- **接收分发工具函数**：由底层驱动在收到 CAN 帧（或检测到错误事件并构造 `Type::ERROR`）后调用。
- 内部按订阅过滤器分发帧：
  - `pack`：接收到的帧；
  - `in_isr`：指示当前是否在中断上下文中调用。
- 每种 `Type` 对应一个无锁链表 `subscriber_list_[]`，遍历匹配的过滤器并触发回调（`cb.Run(in_isr, pack)`）。

---

## FDCAN 接口扩展（`LibXR::FDCAN`）

`LibXR::FDCAN` 继承自 `LibXR::CAN`，在经典 CAN 的基础上扩展 CAN FD 帧与数据相位配置。

### CAN FD 帧结构 `FDPack`

```cpp
#pragma pack(push, 1)
struct FDPack {
  uint32_t id;       ///< CAN ID。CAN ID.
  Type type;         ///< 帧类型。Frame type.
  uint8_t len;       ///< 数据长度（0~64）。Data length (0–64 bytes).
  uint8_t data[64];  ///< 数据载荷。Data payload.
};
#pragma pack(pop)
```

- `id`：与 `ClassicPack::id` 一致，11/29 bit 实际 ID 由上层约定。
- `type`：FD 数据帧使用 `STANDARD` / `EXTENDED`。
- `len`：实际数据字节数，范围 `0–64`。
  - CAN FD 的 DLC 映射支持的典型长度集合为 `0..8, 12, 16, 20, 24, 32, 48, 64`；
  - DLC 映射与异常长度处理策略由具体平台实现定义。
- `data`：数据载荷，仅前 `len` 字节有效。

> 当前实现中，`FDCAN::Register(CallbackFD, ...)` 仅支持注册 `Type::STANDARD` / `Type::EXTENDED`。错误事件推荐使用经典 CAN 的 `ClassicPack + Type::ERROR + ErrorID` 机制，并通过 `CAN::Register(..., Type::ERROR, ...)` 订阅。

---

### FD 专用配置

#### 数据相位位时序 `DataBitTiming`

```cpp
struct DataBitTiming {
  uint32_t brp = 0;         ///< 预分频。Prescaler.
  uint32_t prop_seg = 0;    ///< 传播段。Propagation segment.
  uint32_t phase_seg1 = 0;  ///< 相位段 1。Phase segment 1.
  uint32_t phase_seg2 = 0;  ///< 相位段 2。Phase segment 2.
  uint32_t sjw = 0;         ///< 同步跳宽。Synchronization jump width.
};
```

对应数据相位（Data Phase）的位时序参数。

#### FD 模式配置 `FDMode`

```cpp
struct FDMode {
  bool fd_enabled = false;  ///< 是否启用 CAN FD。Enable CAN FD.
  bool brs = false;         ///< 是否启用 BRS。Enable Bit Rate Switch.
  bool esi = false;         ///< ESI 行为配置（控制器相关）。ESI behavior (controller-dependent).
};
```

- `fd_enabled`：打开 CAN FD 协议支持。
- `brs`：启用 BRS 时，数据相位使用 `data_bitrate` 等参数。
- `esi`：Error State Indicator 相关行为配置，是否生效取决于控制器实现；某些平台可能忽略该字段。

#### FDCAN 配置 `FDCAN::Configuration`

```cpp
struct Configuration : public CAN::Configuration {
  uint32_t data_bitrate = 0;       ///< 数据相位波特率。Data-phase bitrate.
  float data_sample_point = 0.0f;  ///< 数据相位采样点。Data-phase sample point.
  DataBitTiming data_timing;       ///< 数据相位位时序。Data-phase bit timing.
  FDMode fd_mode;                  ///< FD 模式配置。FD mode configuration.
};
```

- 在 `CAN::Configuration` 基础上扩展数据相位与 FD 模式相关字段。
- 对于只使用经典 CAN 的场景，可将 `fd_enabled` 置为 `false`，并忽略数据相位字段。

---

### 配置接口重载

```cpp
// 兼容经典 CAN 的配置接口
virtual ErrorCode SetConfig(const CAN::Configuration &cfg) = 0;

// 完整 FDCAN 配置接口
virtual ErrorCode SetConfig(const FDCAN::Configuration &cfg) = 0;
```

- `SetConfig(const CAN::Configuration &cfg)`：
  - 为兼容 `LibXR::CAN` 抽象而保留；
  - 具体实现可仅使用仲裁相位配置（等价于关闭 FD 特性）。
- `SetConfig(const FDCAN::Configuration &cfg)`：
  - 完整配置仲裁相位 + 数据相位 + FD 模式；
  - 推荐在使用 CAN FD 时优先调用该接口。

---

### FDCAN 过滤与回调

#### FD 回调类型

```cpp
using CallbackFD = LibXR::Callback<const FDPack &>;
```

与经典 CAN 类似，FD 回调由 `OnMessage(pack, in_isr)` 触发，内部调用形式为：

```cpp
cb.Run(in_isr, pack);
```

用户侧回调可按如下签名实现：

```cpp
[](bool in_isr, int, const LibXR::FDCAN::FDPack &pack) { ... }
```

#### FD 过滤器结构 `FDCAN::Filter`

```cpp
struct Filter {
  FilterMode mode;         ///< 过滤模式。Filter mode.
  uint32_t start_id_mask;  ///< 起始 ID 或掩码。Start ID or mask.
  uint32_t end_id_mask;    ///< 结束 ID 或匹配值。End ID or match value.
  Type type;               ///< 帧类型。Frame type.
  CallbackFD cb;           ///< 回调函数。Callback function.
};
```

过滤模式语义与 `LibXR::CAN::Filter` 一致：

- `ID_MASK`：`(id & start_id_mask) == end_id_mask`
- `ID_RANGE`：`start_id_mask <= id && id <= end_id_mask`

> 在 `ID_RANGE` 模式下，`start_id_mask` / `end_id_mask` 表示起始/结束 ID；在 `ID_MASK` 模式下，分别表示掩码与匹配值。

#### 注册 FD 回调

```cpp
void Register(CallbackFD cb,
              Type type,
              FilterMode mode = FilterMode::ID_RANGE,
              uint32_t start_id_mask = 0,
              uint32_t end_id_mask = UINT32_MAX);
```

- 与经典 CAN 的 `Register` 类似，但回调类型为 `CallbackFD`，帧为 `FDPack`。
- 支持多订阅者、按帧类型与过滤器匹配分发。
- 当前实现仅允许 `type` 为 `Type::STANDARD` 或 `Type::EXTENDED`（不支持 `REMOTE_*`，也不支持在 FD 注册接口中订阅 `Type::ERROR`）。

示例：订阅 FD 扩展帧区间 `[0x18FF0000, 0x18FFFFFF]`（按上层约定为 29-bit ID）：

```cpp
LibXR::FDCAN &fdcan = ...;

fdcan.Register(
    LibXR::FDCAN::CallbackFD(
        [](bool in_isr, const LibXR::FDCAN::FDPack &pack) {
          (void)in_isr;
          // 快速处理，不要阻塞
        }),
    LibXR::CAN::Type::EXTENDED,
    LibXR::CAN::FilterMode::ID_RANGE,
    0x18FF0000, 0x18FFFFFF);
```

---

### FD 发送与接收分发

#### 发送 FD 消息 `AddMessage`（TX）

```cpp
virtual ErrorCode AddMessage(const FDPack &pack) = 0;
```

- **发送方向 API（Transmit path）**：由上层调用，用于将 `FDPack` 发送到 CAN FD 总线（具体实现由派生驱动决定）。
- 返回值用于标识发送是否成功（例如：busy、队列满、参数非法等）。

#### 接收分发 FD 消息 `OnMessage`（RX dispatch helper）

```cpp
protected:
  void OnMessage(const FDPack &pack, bool in_isr);
```

- **接收分发工具函数**：由底层驱动在收到 FD 帧后调用。
- 内部按订阅过滤器分发帧，触发匹配的 FD 回调（`cb.Run(in_isr, pack)`）。
