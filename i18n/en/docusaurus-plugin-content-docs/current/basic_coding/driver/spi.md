---
id: spi
title: SPI
sidebar_position: 4
---

# SPI (Serial Peripheral Interface)

`LibXR::SPI` provides a platform-agnostic abstraction for SPI bus communication. It supports full-duplex transfers, register read/write operations, prescaler selection, and optional double-buffer helpers, making it suitable for peripherals such as sensors and displays.

## Interface Overview

### Enumerations

```cpp
enum class ClockPolarity : uint8_t {
  LOW,   // Idle low level
  HIGH   // Idle high level
};

enum class ClockPhase : uint8_t {
  EDGE_1, // Sample on the first clock edge
  EDGE_2  // Sample on the second clock edge
};

enum class Prescaler : uint8_t {
  DIV_1 = 0, DIV_2, DIV_4, DIV_8, DIV_16, DIV_32, DIV_64, DIV_128,
  DIV_256, DIV_512, DIV_1024, DIV_2048, DIV_4096, DIV_8192,
  DIV_16384, DIV_32768, DIV_65536,
  UNKNOWN = 0xFF // Unknown divider
};
```

### Configuration Structure

```cpp
struct Configuration {
  ClockPolarity clock_polarity = ClockPolarity::LOW;
  ClockPhase    clock_phase    = ClockPhase::EDGE_1;
  Prescaler     prescaler      = Prescaler::UNKNOWN;
  bool          double_buffer  = false;
};
```

### Primary APIs

```cpp
// Construction & configuration
SPI(RawData rx_buffer, RawData tx_buffer);
virtual ErrorCode SetConfig(Configuration config) = 0;
inline Configuration& GetConfig();
inline bool IsDoubleBuffer() const;

// Rate / prescaler capabilities
virtual uint32_t GetMaxBusSpeed() const = 0;
virtual Prescaler GetMaxPrescaler() const = 0;
static constexpr uint32_t PrescalerToDiv(Prescaler prescaler);
uint32_t GetBusSpeed() const;
Prescaler CalcPrescaler(uint32_t target_max_bus_speed,
                        uint32_t target_min_bus_speed,
                        bool increase);

// Buffer management and double-buffer helpers
RawData GetRxBuffer();
RawData GetTxBuffer();
void SwitchBuffer();
void SetActiveLength(size_t len);
size_t GetActiveLength() const;

// Transfer interface
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

// Register read/write
virtual ErrorCode MemWrite(uint16_t reg,
                           ConstRawData write_data,
                           OperationRW& op,
                           bool in_isr = false) = 0;

virtual ErrorCode MemRead(uint16_t reg,
                          RawData read_data,
                          OperationRW& op,
                          bool in_isr = false) = 0;
```

- `OperationRW` is an alias of `WriteOperation` (SPI read/write completion reports `ErrorCode` uniformly).
- `in_isr` indicates whether this SPI operation is initiated/progressed in ISR context (forwarded to the underlying implementation).
- `GetConfig()` returns the currently stored configuration reference; `IsDoubleBuffer()` only reflects whether `config_.double_buffer` is currently enabled.

See [Operation Model](../core/core-op.md) and [BLOCK Timeout and Completion Handoff](../../adv_coding/driver/block_timeout_semantics.md) for completion modes of `OperationRW`.

### Operation Struct

```cpp
struct ReadWriteInfo {
  RawData read_data;
  ConstRawData write_data;
  OperationRW op;
};
```

## Behavior

The following rules apply to `ReadAndWrite()`, `Read()`, `Write()`, `Transfer()`, `MemRead()` and `MemWrite()`:

- An SPI object handles one transfer at a time and does not queue. While the previous transfer is still running, a new call returns `BUSY`.
- A `BLOCK` operation returns the transfer result, or `TIMEOUT` when the wait times out. Other operations return `OK` to mean that the transfer has started or has already completed; the result is reported through the `Operation`.
- When the length exceeds the backend constructor parameter `dma_enable_min_size` (3 by default on STM32, CH32, ESP32 and MSPM0) and the backend can use DMA, the transfer runs by DMA and the result is reported from the completion interrupt; other transfers complete by polling inside the call, and the callback has run or the polling status has been updated before the call returns.
- The `rx_buffer` and `tx_buffer` passed to the constructor are the buffers the backend transfers through. `ReadAndWrite()` and the other calls first copy the write data into the transmit buffer and copy the received data into `read_data` after the transfer, so a single transfer cannot be longer than the buffer; a longer one triggers an `ASSERT`. With double buffering enabled, each buffer is split in two halves and a single transfer is limited to the size of one half.
- `Transfer(size, op)` copies nothing: it sends the first `size` bytes already written to `GetTxBuffer()`, and the received data stays in `GetRxBuffer()`.

## Feature Summary

- Supports configuration of SPI clock **polarity** and **phase**.
- **Prescaler** and **bus-rate calculation**: choose an appropriate prescaler within a target speed range.
- Provides full-duplex transfer APIs together with buffer helpers such as `GetRxBuffer()` / `GetTxBuffer()`, `SwitchBuffer()`, and `SetActiveLength()` when double-buffered paths are used.
- A generic operation model (`OperationRW = WriteOperation`) supporting synchronous, callback, and polling modes.

## Notes

- `ReadAndWrite(...)`, `Transfer(...)`, `MemRead(...)`, and `MemWrite(...)` are abstract behaviors that platform implementations must provide; this page does not assume all backends share the same register protocol or DMA organization.
- In the current implementation, `GetRxBuffer()` / `GetTxBuffer()` return the constructor-provided `rx_buffer_ / tx_buffer_` when double buffering is disabled, and the current active half when it is enabled.
- `SwitchBuffer()` only changes internal `DoubleBuffer` state when `double_buffer == true`; otherwise it is a no-op.
- `SetActiveLength()` / `GetActiveLength()` currently operate only on the transmit-side `double_buffer_tx_` auxiliary length field.
