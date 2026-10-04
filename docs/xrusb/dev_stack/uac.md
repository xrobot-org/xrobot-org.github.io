---
id: xrusb-dev-stack-uac
title: UAC
sidebar_position: 3
---

# UAC 设备协议栈

本文档描述 XRUSB 的 USB Audio Class 1.0（UAC1）麦克风设备类实现：`LibXR::USB::UAC1MicrophoneQ`。该类面向 UAC1 录音（Device → Host）场景，使用字节队列驱动（queue-driven）将上层产生的 PCM 数据持续送入 Isochronous IN 端点输出，并实现 UAC1 典型控制面（采样率、静音、音量）。

支持能力概览：

- IAD + AC + AS 的标准 UAC1 描述符组织（AC/AS 两接口）
- AS 接口 Alt Setting 0/1 切换，按主机选择启动/停止等时流
- Iso IN 端点 Sampling Frequency Control（3 字节小端）
- Feature Unit Mute / Volume 控制（UAC1 语义：Volume 单位 1/256 dB）
- 根据采样率与服务周期自动计算每次等时服务的发送字节数（FS=1ms；HS 由 `bInterval` 决定服务频率）

---

## 1. 类与模板参数

### `LibXR::USB::UAC1MicrophoneQ<CHANNELS, BITS_PER_SAMPLE>`

模板参数：

- `CHANNELS`：通道数（1..8）
- `BITS_PER_SAMPLE`：位深（8 / 16 / 24）

内部常量：

- `K_SUBFRAME_SIZE`：每通道每采样的字节数  
  - 8-bit → 1  
  - 16-bit → 2  
  - 24-bit → 3（按 3 字节打包，不是 32-bit 容器）

---

## 2. 构造参数与运行时状态

构造函数参数（按顺序）：

- `iso_in_ep_num`：Iso IN 端点号（必填）
- `sample_rate_hz`：采样率（Hz）
- `vol_min / vol_max / vol_res`：音量范围与步进，单位 1/256 dB，默认 `0 / 0 / 1`
- `speed`：USB 速度（`Speed::FULL` / `Speed::HIGH`），默认 `Speed::FULL`
- `queue_bytes`：PCM 队列容量（字节），默认 2048
- `interval`：Iso IN 端点 `bInterval`，默认 1
  - Full-Speed：必须为 1（绑定端点时断言）
  - High-Speed：允许 1..16（规范含义为微帧指数调度）
- `control_interface_string` / `streaming_interface_string`：默认 `"XRUSB UAC1 Control"` / `"XRUSB UAC1 Streaming"`

初始化后关键状态：

- `streaming_`：AS Alt=1 时为 `true`（正在流式输出）
- `sr_hz_`：当前采样率（可由主机 SET_CUR 动态修改）
- `w_max_packet_size_`：运行期计算得到的 `wMaxPacketSize`（受 FS/HS 上限约束）
- `pcm_queue_`：PCM 字节队列（`LibXR::SPSCQueue<uint8_t>`）

---

## 3. 上层数据输入接口（Producer API）

对上层暴露的最小接口如下：

```cpp
ErrorCode WritePcm(const void* data, size_t nbytes);
size_t QueueSize() const;
size_t QueueSpace();
void ResetQueue();
```

### 3.1 PCM 数据格式要求

- `WritePcm()` 写入的是交错（interleaved）PCM 字节流，由上层决定具体格式（需与描述符宣告一致）：
  - 16-bit：S16LE（小端）
  - 24-bit：S24_3LE（三字节小端）
- 通道交错：例如 2ch 时为 `L0 R0 L1 R1 ...`

### 3.2 队列容量建议

为了避免短时间抖动造成欠载（underflow），建议 `queue_bytes` 至少覆盖数十毫秒缓冲：

- 估算：`bytes_per_ms ≈ sample_rate_hz * CHANNELS * K_SUBFRAME_SIZE / 1000`
- 示例：48kHz / 2ch / 16-bit → `48000 * 2 * 2 / 1000 = 192 bytes/ms`  
  2048 bytes ≈ 10.7 ms 缓冲

---

## 4. UAC1 接口与描述符布局

该设备暴露 2 个接口并通过 IAD 关联：

- Audio Control（AC）接口：实体拓扑与控制（Feature Unit）
- Audio Streaming（AS）接口：承载音频流（Alt 0/Alt 1）

实现约束：

- `GetInterfaceCount()` 返回 `2`
- `HasIAD()` 返回 `true`

### 4.1 实体拓扑（Entity Graph）

实体 ID（代码固定）：

| Entity                          |   ID | 说明                                 |
| ------------------------------- | ---: | ------------------------------------ |
| Input Terminal (Microphone)     |    1 | `wTerminalType = 0x0201`             |
| Feature Unit (Mute/Volume)      |    2 | 控制选择器：Mute(0x01)、Volume(0x02) |
| Output Terminal (USB Streaming) |    3 | `wTerminalType = 0x0101`             |

连接关系：

`IT_MIC (1) → FU (2) → OT_USB (3) → AS Interface`

### 4.2 AS 接口的 Alternate Setting

- Alt 0：无端点（不传输）
- Alt 1：包含 1 个 Isochronous IN 端点（开始传输）

主机切换 Alt Setting 是启动/停止音频流的唯一触发条件（见第 6 节）。

### 4.3 通道配置 `wChannelConfig`

当前实现仅对 `CHANNELS == 2` 显式声明：

- `wChannelConfig = 0x0003`（Left Front | Right Front）

其余通道数默认 `0x0000`（未声明）。如需更严格的多声道位置声明，建议按 UAC1 规范扩展映射表。

---

## 5. Isochronous IN 端点与包长约束

端点类型与属性：

- 类型：Isochronous IN
- `bmAttributes = 0x05`（Isochronous + Asynchronous + Data）
- `bInterval`：
  - FS：固定为 1（1ms 帧）
  - HS：使用构造参数 `interval`

`wMaxPacketSize` 的运行时边界：

- Full-Speed：单事务 ≤ 1023
- High-Speed：单事务 ≤ 1024  
  > 说明：当前实现只按“单事务/每次服务”计算与限制，未使用 HS 的 multiplier（多事务/微帧）。

---

## 6. 流控制：`SetAltSetting()` 的行为

`SetAltSetting(itf, alt)` 仅对 AS 接口生效：

- `alt = 0`（停止传输）
  - `streaming_ = false`
  - `ep_iso_in_->SetActiveLength(0)`
  - `ep_iso_in_->Close()`
- `alt = 1`（开始传输）
  - 以当前 `w_max_packet_size_` 重新配置端点
  - 重置余数累加器 `acc_rem_ = 0`
  - `streaming_ = true`
  - 立即调用 `KickOneFrame()` 投递首帧

`GetAltSetting()` 返回值与 `streaming_` 一致（true→1，false→0）。

---

## 7. 时序与每帧字节数计算（`RecomputeTiming()`）

该函数在两类时机调用：

- 构造时（初始化采样率）
- 主机通过端点 SET_CUR 修改采样率后（见第 9 节）

### 7.1 服务频率 `service_hz_`

- Full-Speed：固定 `1000 Hz`（1ms 帧）；并强制 `interval_ == 1`
- High-Speed：按 `bInterval` 计算服务频率（每秒微帧 8000）
  - `service_hz_ = 8000 / 2^(bInterval-1)`  
  - `bInterval` 被钳制到 1..16

### 7.2 每秒字节数 `bytes_per_sec_`

```text
bytes_per_sec_ = sr_hz_ * CHANNELS * K_SUBFRAME_SIZE
```

### 7.3 每次服务的目标字节数（base + remainder）

```text
base_bytes_per_service = bytes_per_sec_ / service_hz_
rem_bytes_per_service  = bytes_per_sec_ % service_hz_
```

实现使用余数累加器均匀分布 `rem`：

- 每次先发送 `base_bytes_per_service`
- `acc_rem_ += rem_bytes_per_service`
- 若 `acc_rem_ >= service_hz_`，本次额外 +1 字节并 `acc_rem_ -= service_hz_`

随后对结果进行包长钳制（FS≤1023，HS≤1024），形成 `w_max_packet_size_`。

---

## 8. 数据发送策略（队列取数 + 等时 IN）

### 8.1 核心流程：`KickOneFrame()`

触发条件：

- `streaming_ == true`
- `ep_iso_in_` 状态为 `IDLE`

处理步骤：

1. 计算本次服务的目标发送字节数 `to_send`
2. 将 `to_send` 钳制到 `w_max_packet_size_` 与端点缓冲区大小
3. 从 `pcm_queue_` 取数据：
   - `take = min(queue_size, to_send)`
   - `PopBatch(buf, take)`
4. 调用 `ep_iso_in_->Transfer(take)` 提交传输

### 8.2 欠载行为（Underflow）

当前实现会先计算目标发送长度 `to_send`，再从队列中尽量取出 `take = min(queue_size, to_send)` 字节。

- 当 `take == to_send` 时，整包都来自 PCM 队列；
- 当 `take < to_send` 时，剩余的 `to_send - take` 字节会在端点缓冲区中补零；
- 每次提交给端点的长度都是 `to_send`。

---

## 9. 类请求处理（控制面）

实现覆盖两类控制：

1. 端点采样率控制（Recipient = Endpoint）
2. Feature Unit 控制（Recipient = Interface / Entity）

### 9.1 端点采样率控制（Sampling Frequency Control）

匹配条件（实现逻辑）：

- `wIndex & 0xFF` 等于 Iso IN 端点地址
- `(wValue >> 8) == 0x01`（Sampling Freq Control Selector）
- 数据长度必须为 3 字节（24-bit little-endian）

支持请求：

| Request             | wLength | 行为                                                  |
| ------------------- | ------: | ----------------------------------------------------- |
| `GET_CUR`           |       3 | 返回 `sf_cur_[3]`                                     |
| `SET_CUR`           |       3 | 数据阶段写入 `sf_cur_`，并置 `pending_set_sf_ = true` |
| `GET_MIN / GET_MAX` |       3 | 返回 `sf_cur_`（单频点实现）                          |
| `GET_RES`           |       3 | 返回 `{1,0,0}`（1 Hz）                                |

数据阶段 `OnClassData()`：

- 当 `bRequest == SET_CUR && pending_set_sf_`：
  - 解析 `sf_cur_` 得到 `NEW_SR`
  - `NEW_SR > 0` 且与当前不同则更新 `sr_hz_` 并 `RecomputeTiming()`
  - 清 `pending_set_sf_`

### 9.2 Feature Unit：Mute / Volume

匹配条件：

- `ITF = (wIndex & 0xFF)` 必须等于 AC 接口号 `itf_ac_num_`
- `ENT = (wIndex >> 8)` 必须等于 Feature Unit ID（`ID_FU = 2`）
- `CH = (wValue & 0xFF)`：0=Master，1..CHANNELS

#### Mute（1 字节）

- `SET_CUR (wLength=1)`：写入 `mute_`
- `GET_CUR (wLength=1)`：读出 `mute_`

#### Volume（2 字节，单位 1/256 dB）

- `SET_CUR (wLength=2)`：写入 `vol_cur_`
- `GET_CUR (wLength=2)`：读出 `vol_cur_`
- `GET_MIN / GET_MAX / GET_RES (wLength=2)`：返回构造参数 `vol_min_ / vol_max_ / vol_res_`

当前类保存并返回 Mute / Volume 控制值，但发送路径不会自动修改 PCM 样本；需要实际静音或增益时，由上游采集/处理层应用这些控制值。

---

## 10. 使用示例

```cpp
#include "uac_mic.hpp"

using Mic = LibXR::USB::UAC1MicrophoneQ<2, 16>; // 2ch, 16-bit

Mic mic(/*iso_in_ep*/LibXR::USB::Endpoint::EPNumber::EP1,
        /*sample_rate*/48000,
        /*vol_min*/-90*256, /*vol_max*/0, /*vol_res*/256,
        /*speed*/LibXR::USB::Speed::FULL,
        /*queue_bytes*/2048,
        /*interval*/1);

// USB Device 初始化时将 &mic 放入 class 列表：{{&mic}}
// usb_dev.Init(false);
// usb_dev.Start(false);

// 上层：持续写入 S16LE 交错 PCM
mic.WritePcm(pcm_bytes, pcm_len);
```

主机在 AS 接口选择 Alt=1 后开始取流；切回 Alt=0 即停止。
