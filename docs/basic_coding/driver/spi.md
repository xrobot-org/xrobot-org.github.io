---
id: spi
title: SPI
sidebar_position: 4
---

# SPI（串行外设接口）

`LibXR::SPI` 提供平台无关的 SPI 总线通信抽象接口，支持全双工传输、寄存器读写、分频选择以及可选双缓冲辅助，适用于传感器、显示器等外设驱动。

## 接口概览

### 枚举类型

```cpp
enum class ClockPolarity : uint8_t {
  LOW,   // 空闲时低电平
  HIGH   // 空闲时高电平
};

enum class ClockPhase : uint8_t {
  EDGE_1, // 第一个时钟边沿采样
  EDGE_2  // 第二个时钟边沿采样
};

enum class Prescaler : uint8_t {
  DIV_1 = 0, DIV_2, DIV_4, DIV_8, DIV_16, DIV_32, DIV_64, DIV_128,
  DIV_256, DIV_512, DIV_1024, DIV_2048, DIV_4096, DIV_8192,
  DIV_16384, DIV_32768, DIV_65536,
  UNKNOWN = 0xFF // 未知分频系数
};
```

### 配置结构

```cpp
struct Configuration {
  ClockPolarity clock_polarity = ClockPolarity::LOW;
  ClockPhase    clock_phase    = ClockPhase::EDGE_1;
  Prescaler     prescaler      = Prescaler::UNKNOWN;
  bool          double_buffer  = false;
};
```

### 主要接口

```cpp
// 构造与配置
SPI(RawData rx_buffer, RawData tx_buffer);
virtual ErrorCode SetConfig(Configuration config) = 0;
inline Configuration& GetConfig();
inline bool IsDoubleBuffer() const;

// 速率/分频能力
virtual uint32_t GetMaxBusSpeed() const = 0;
virtual Prescaler GetMaxPrescaler() const = 0;
static constexpr uint32_t PrescalerToDiv(Prescaler prescaler);
uint32_t GetBusSpeed() const;
Prescaler CalcPrescaler(uint32_t target_max_bus_speed,
                        uint32_t target_min_bus_speed,
                        bool increase);

// 缓冲管理与双缓冲辅助
RawData GetRxBuffer();
RawData GetTxBuffer();
void SwitchBuffer();
void SetActiveLength(size_t len);
size_t GetActiveLength() const;

// 传输接口
virtual ErrorCode ReadAndWrite(RawData read_data,
                               ConstRawData write_data,
                               OperationRW& op,
                               bool in_isr = false) = 0;

virtual ErrorCode Read(RawData read_data,
                       OperationRW& op,
                       bool in_isr = false);

virtual ErrorCode Write(ConstRawData write_data,
                        OperationRW& op,
                        bool in_isr = false);

virtual ErrorCode Transfer(size_t size,
                           OperationRW& op,
                           bool in_isr = false) = 0;

// 寄存器读写
virtual ErrorCode MemWrite(uint16_t reg,
                           ConstRawData write_data,
                           OperationRW& op,
                           bool in_isr = false) = 0;

virtual ErrorCode MemRead(uint16_t reg,
                          RawData read_data,
                          OperationRW& op,
                          bool in_isr = false) = 0;
```

- `OperationRW` 为 `WriteOperation` 的别名（SPI 读写完成统一回传 `ErrorCode`）。
- `in_isr` 指示是否在中断上下文中发起/推进本次 SPI 操作（透传给底层实现）。
- `GetConfig()` 返回当前内部保存的配置引用；`IsDoubleBuffer()` 只反映 `config_.double_buffer` 当前是否开启。

### 操作结构体

```cpp
struct ReadWriteInfo {
  RawData read_data;
  ConstRawData write_data;
  OperationRW op;
};
```

## 特性总结

- 支持 SPI 的极性与相位配置；
- **分频（Prescaler）**与**总线速率计算**，可按目标速率范围选择合适分频；
- 提供全双工传输接口，并暴露 `GetRxBuffer()` / `GetTxBuffer()`、`SwitchBuffer()`、`SetActiveLength()` 等双缓冲辅助接口；
- 通用操作模型（`OperationRW = WriteOperation`），支持同步、回调、轮询等模式；

## 说明

- `ReadAndWrite(...)`、`Transfer(...)`、`MemRead(...)`、`MemWrite(...)` 都是平台实现需要提供的抽象行为；各平台的寄存器协议和 DMA 组织方式不一定相同。
- 当前 `GetRxBuffer()` / `GetTxBuffer()` 在双缓冲关闭时返回构造时传入的 `rx_buffer_ / tx_buffer_`；双缓冲开启时返回当前 active 半区。
- `SwitchBuffer()` 只在 `double_buffer == true` 时切换内部 `DoubleBuffer` 状态；否则不做任何操作。
- `SetActiveLength()` / `GetActiveLength()` 当前只作用在发送侧 `double_buffer_tx_` 的辅助长度字段上，不表示一条独立的统一“传输长度元信息协议”。
