---
id: can
title: Controller Area Network
sidebar_position: 5
---

# CAN / FDCAN (Controller Area Network)

`LibXR::CAN` and `LibXR::FDCAN` provide cross-platform abstractions for Controller Area Network communication, supporting:

- A unified subscription interface for classic CAN frames (`ClassicPack`) and CAN FD frames (`FDPack`);
- Bit timing configuration for nominal (arbitration) and data phases;
- Error state querying and virtual error-frame reporting;
- Lock-free subscriber lists that can safely dispatch frames from ISR context.

They are suitable for real-time bus scenarios such as in-vehicle networks and sensor networks.

---

## CAN Abstraction Interface (`LibXR::CAN`)

### Frame Type `Type`

```cpp
enum class Type : uint8_t {
  STANDARD = 0,         ///< Standard data frame (11-bit ID).
  EXTENDED = 1,         ///< Extended data frame (29-bit ID).
  REMOTE_STANDARD = 2,  ///< Standard remote frame.
  REMOTE_EXTENDED = 3,  ///< Extended remote frame.
  ERROR = 4,            ///< Error frame (virtual event).
  TYPE_NUM = 5          ///< Upper bound of types (internal use).
};
```

- `STANDARD` / `EXTENDED`: Classic CAN data frames with 11-bit / 29-bit identifiers.
- `REMOTE_*`: Classic CAN Remote Frames (RTR). They carry no valid payload, but the DLC may still be used to indicate the **requested data length** (`0–8`).
- `ERROR`: Virtual error frames (not physical bus frames), used to report controller error events via `ClassicPack`.
- `TYPE_NUM`: Internal use only, for sizing the per-type subscriber list array.

> For CAN FD (FD frames), the protocol does not define a Remote Frame concept; the FD-side subscription callback currently supports only `STANDARD` / `EXTENDED` (see `FDCAN::Register` constraints below).

---

### Bit Timing and Operating Modes

#### `BitTiming` – Nominal Phase Bit Timing

```cpp
struct BitTiming {
  uint32_t brp = 0;         ///< Baud rate prescaler.
  uint32_t prop_seg = 0;    ///< Propagation segment.
  uint32_t phase_seg1 = 0;  ///< Phase segment 1.
  uint32_t phase_seg2 = 0;  ///< Phase segment 2.
  uint32_t sjw = 0;         ///< Synchronization jump width.
};
```

Describes nominal (arbitration) phase bit timing parameters. These typically map 1:1 to controller registers (e.g., bxCAN, FDCAN).

#### `Mode` – Operating Mode

```cpp
struct Mode {
  bool loopback = false;         ///< Loopback mode.
  bool listen_only = false;      ///< Listen-only (silent) mode.
  bool triple_sampling = false;  ///< Triple sampling.
  bool one_shot = false;         ///< One-shot transmission.
};
```

- `loopback`: Enables internal loopback; frames are not sent onto the physical bus.
- `listen_only`: Silent monitoring mode; do not actively transmit, only listen.
- `triple_sampling`: Enables triple sampling to improve noise immunity (hardware-dependent).
- `one_shot`: One-shot mode; do not automatically retransmit on failure.

#### `Configuration` – CAN Configuration

```cpp
struct Configuration {
  uint32_t bitrate = 0;       ///< Target nominal bitrate.
  float sample_point = 0.0f;  ///< Nominal sample point (0–1).
  BitTiming bit_timing;       ///< Bit timing configuration.
  Mode mode;                  ///< Operating mode.
};
```

- `bitrate` / `sample_point`: High-level (macro) configuration, typically used by an upper-layer bit timing calculator.
- `bit_timing`: Concrete bit timing parameters, usually produced by platform tools or algorithms.
- `mode`: Controller operating mode switches.

#### Configuration Interfaces

```cpp
virtual ErrorCode SetConfig(const CAN::Configuration &cfg) = 0;
virtual uint32_t GetClockFreq() const = 0;
```

- `SetConfig`: Configures the CAN controller per `Configuration`. Implementations should update bit timing only when the controller is disabled or in a safe state (per hardware requirements).
- `GetClockFreq`: Returns the CAN peripheral input clock frequency (Hz), typically used for upper-layer bit timing calculations.

---

### Error State Query `ErrorState`

```cpp
struct ErrorState {
  uint8_t tx_error_counter = 0;  ///< Transmit error counter (TEC).
  uint8_t rx_error_counter = 0;  ///< Receive error counter (REC).

  bool bus_off = false;        ///< True if controller is bus-off.
  bool error_passive = false;  ///< True if controller is error-passive.
  bool error_warning = false;  ///< True if controller is error-warning.
};
```

Error state query interface:

```cpp
virtual ErrorCode GetErrorState(ErrorState &state) const;
```

- The default implementation returns `ErrorCode::NOT_SUPPORT` and does not modify `state`.
- Platform implementations (e.g., bxCAN / FDCAN) may override this and read TEC/REC and status flags from hardware registers.
- Callers can use `bus_off` / `error_passive` / `error_warning` to implement diagnostics and fault tolerance.

---

### Classic CAN Frame `ClassicPack`

```cpp
#pragma pack(push, 1)
struct ClassicPack {
  uint32_t id;      ///< CAN ID (11/29 bits or ErrorID).
  Type type;        ///< Frame type.
  uint8_t dlc;      ///< Data length code (0–8).
  uint8_t data[8];  ///< Data payload (up to 8 bytes).
};
#pragma pack(pop)
```

- `id`:
  - For `STANDARD`: only the lowest 11 bits are used.
  - For `EXTENDED`: only the lowest 29 bits are used.
  - For `ERROR`: uses a virtual error ID (see `ErrorID` below).
- `type`: Frame type.
- `dlc`: `0–8`.
  - Data frames (`STANDARD` / `EXTENDED`): number of valid bytes in `data[]`.
  - Remote frames (`REMOTE_*`): may indicate the requested data length (`0–8`); `data[]` is invalid/ignored.
- `data`: Data payload; meaningful only for data frames.

---

### Virtual Error Frames `ErrorID`

Error events are reported via `ClassicPack::type == Type::ERROR` plus a virtual ID in `ClassicPack::id`. The virtual ID space is:

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

Helper methods:

```cpp
static constexpr uint32_t FromErrorID(ErrorID e) noexcept;
static constexpr bool IsErrorId(uint32_t id) noexcept;
static constexpr ErrorID ToErrorID(uint32_t id) noexcept;
```

- `FromErrorID`: Converts an `ErrorID` into a value suitable for `ClassicPack::id`.
- `IsErrorId`: Checks whether `id` is in the error ID space, i.e. `(id & 0xFFFF0000u) == CAN_ERROR_ID_PREFIX`.
- `ToErrorID`: Interprets `id` as an `ErrorID`.

> Since physical CAN IDs are at most 11/29 bits, the `0xFFFF0000` virtual ID space does not overlap with real bus IDs and therefore cannot conflict.

Typical usage (in a member function of the derived driver that handles the error interrupt):

```cpp
LibXR::CAN::ClassicPack pack{};
pack.type = LibXR::CAN::Type::ERROR;
pack.id   = LibXR::CAN::FromErrorID(LibXR::CAN::ErrorID::CAN_ERROR_ID_BUS_OFF);
pack.dlc  = 0;
pack.data[0] = 0;  // Optional: carry extra info if needed
OnMessage(pack, /*in_isr=*/true);  // OnMessage is protected; call it from a member of the derived driver
```

---

### Callbacks and Filters

#### Callback Type

```cpp
using Callback = LibXR::Callback<const ClassicPack &>;
```

Callbacks are triggered by `OnMessage(pack, in_isr)`, and internally invoked as:

```cpp
cb.Run(in_isr, pack);
```

User callbacks have the form `void(bool in_isr, ArgType arg, const ClassicPack &pack)` and are created with `Callback::Create(fun, arg)` (see [General Callback](../core/core-cb.md)):

- `in_isr`: whether the callback runs in ISR context;
- `arg`: the argument bound when the callback was created;
- `pack`: the received frame.

> `pack` is a read-only reference. Do not store this reference for asynchronous use.

Callbacks may be invoked in interrupt context. Callback implementations should therefore:

- Avoid blocking operations (locks, waits, long I/O);
- Avoid RTOS APIs that are not ISR-safe;
- If task-level processing is required, quickly enqueue/copy data into a thread-safe or lock-free queue.

#### Filter Mode `FilterMode`

```cpp
enum class FilterMode : uint8_t {
  ID_MASK = 0,  ///< Mask match: (id & start_id_mask) == end_id_mask.
  ID_RANGE = 1  ///< Range match: start_id_mask <= id && id <= end_id_mask.
};
```

- `ID_MASK`: `(id & start_id_mask) == end_id_mask`
- `ID_RANGE`: `start_id_mask <= id && id <= end_id_mask`

> Here `id` refers to `ClassicPack::id`. For `STANDARD` / `EXTENDED`, callers should keep filter values within the corresponding ID width.

#### Filter Structure `Filter`

```cpp
struct Filter {
  FilterMode mode;         ///< Filter mode.
  uint32_t start_id_mask;  ///< Start ID or mask.
  uint32_t end_id_mask;    ///< End ID or match value.
  Type type;               ///< Frame type.
  Callback cb;             ///< Callback function.
};
```

- When `mode == ID_MASK`:
  - `start_id_mask` is the mask;
  - `end_id_mask` is the match value.
- When `mode == ID_RANGE`:
  - `start_id_mask` is the start ID;
  - `end_id_mask` is the end ID.

#### Registering Callbacks `Register`

```cpp
void Register(Callback cb,
              Type type,
              FilterMode mode = FilterMode::ID_RANGE,
              uint32_t start_id_mask = 0,
              uint32_t end_id_mask = UINT32_MAX);
```

- Callbacks are registered per frame type (`type`). Internally, one lock-free subscriber list is maintained for each `Type`.
- Multiple filters can be registered for the same `type`; all matching callbacks will be invoked.
- Default filter is `[0, UINT32_MAX]`, i.e. allow all IDs for the given `type`.

Example: subscribe to standard data frames with IDs in `[0x100, 0x1FF]`:

```cpp
LibXR::CAN &can = ...;

can.Register(
    LibXR::CAN::Callback::Create(
        [](bool in_isr, void *arg, const LibXR::CAN::ClassicPack &pack) {
          (void)in_isr;
          (void)arg;
          (void)pack;
          // Fast processing, no blocking
        },
        static_cast<void *>(nullptr)),
    LibXR::CAN::Type::STANDARD,
    LibXR::CAN::FilterMode::ID_RANGE,
    0x100, 0x1FF);
```

Example: subscribe to all virtual error frames:

```cpp
can.Register(
    LibXR::CAN::Callback::Create(
        [](bool in_isr, void *arg, const LibXR::CAN::ClassicPack &pack) {
          (void)in_isr;
          (void)arg;
          if (!LibXR::CAN::IsErrorId(pack.id)) {
            return;
          }
          auto err = LibXR::CAN::ToErrorID(pack.id);
          (void)err;
          // Diagnostics based on err
        },
        static_cast<void *>(nullptr)),
    LibXR::CAN::Type::ERROR,
    LibXR::CAN::FilterMode::ID_RANGE,
    LibXR::CAN::FromErrorID(LibXR::CAN::ErrorID::CAN_ERROR_ID_GENERIC),
    LibXR::CAN::FromErrorID(LibXR::CAN::ErrorID::CAN_ERROR_ID_OTHER));
```

---

### Transmission and Receive Dispatch

#### Transmit API `AddMessage` (TX)

```cpp
virtual ErrorCode AddMessage(const ClassicPack &pack) = 0;
```

- Transmit API, called by the upper layer to hand a `ClassicPack` to the driver.
- The actual sending mechanism is implementation-defined (direct mailbox, hardware queue, software queue, etc.).
- The return value tells whether the frame was accepted into the transmit queue: the existing backends (STM32, CH32) return `FULL` when the queue is full, `ARG_ERR` for a frame of type `ERROR`, and `OK` once queued.

#### Receive Dispatch Helper `OnMessage` (RX dispatch helper)

```cpp
protected:
  void OnMessage(const ClassicPack &pack, bool in_isr);
```

- Dispatch helper, called by the driver when a CAN frame is received, or when an error event is detected and represented as `Type::ERROR`.
- Internally, dispatches to matching filters in the per-type lock-free list `subscriber_list_[]`, invoking callbacks as `cb.Run(in_isr, pack)`.

---

## FDCAN Interface Extensions (`LibXR::FDCAN`)

`LibXR::FDCAN` derives from `LibXR::CAN` and extends classic CAN with CAN FD frames and data-phase configuration.

### CAN FD Frame `FDPack`

```cpp
#pragma pack(push, 1)
struct FDPack {
  uint32_t id;       ///< CAN ID.
  Type type;         ///< Frame type.
  uint8_t len;       ///< Data length (0–64 bytes).
  uint8_t data[64];  ///< Data payload.
};
#pragma pack(pop)
```

- `id`: Same semantics as `ClassicPack::id`; actual 11/29-bit interpretation is by convention.
- `type`: FD data frames use `STANDARD` / `EXTENDED`.
- `len`: Actual payload length (`0–64`).
  - Typical CAN FD DLC-supported lengths are `0..8, 12, 16, 20, 24, 32, 48, 64`.
  - DLC mapping and handling of non-standard lengths are platform/driver-defined.
- `data`: Payload; only the first `len` bytes are valid.

> The current implementation of `FDCAN::Register(CallbackFD, ...)` supports only `Type::STANDARD` / `Type::EXTENDED`. Error events are recommended to be reported using the classic CAN mechanism (`ClassicPack + Type::ERROR + ErrorID`) and subscribed via `CAN::Register(..., Type::ERROR, ...)`.

---

### FD-Specific Configuration

#### Data-Phase Bit Timing `DataBitTiming`

```cpp
struct DataBitTiming {
  uint32_t brp = 0;         ///< Prescaler.
  uint32_t prop_seg = 0;    ///< Propagation segment.
  uint32_t phase_seg1 = 0;  ///< Phase segment 1.
  uint32_t phase_seg2 = 0;  ///< Phase segment 2.
  uint32_t sjw = 0;         ///< Synchronization jump width.
};
```

Bit timing parameters for the data phase.

#### FD Mode `FDMode`

```cpp
struct FDMode {
  bool fd_enabled = false;  ///< Enable CAN FD.
  bool brs = false;         ///< Enable Bit Rate Switch.
  bool esi = false;         ///< ESI behavior configuration (controller-dependent).
};
```

- `fd_enabled`: Enables CAN FD protocol support.
- `brs`: Enables bit rate switching; data phase uses `data_bitrate` and related parameters.
- `esi`: Error State Indicator behavior; support is controller-dependent and may be ignored by some implementations.

#### `FDCAN::Configuration`

```cpp
struct Configuration : public CAN::Configuration {
  uint32_t data_bitrate = 0;       ///< Data-phase bitrate.
  float data_sample_point = 0.0f;  ///< Data-phase sample point.
  DataBitTiming data_timing;       ///< Data-phase bit timing.
  FDMode fd_mode;                  ///< FD mode configuration.
};
```

- Extends `CAN::Configuration` with data-phase and FD mode fields.
- For classic-only scenarios, set `fd_enabled = false` and ignore data-phase fields.

---

### Configuration Interfaces

```cpp
// Classic CAN-compatible configuration interface
virtual ErrorCode SetConfig(const CAN::Configuration &cfg) = 0;

// Full FDCAN configuration interface
virtual ErrorCode SetConfig(const FDCAN::Configuration &cfg) = 0;
```

- `SetConfig(const CAN::Configuration &cfg)`:
  - Kept for `LibXR::CAN` compatibility;
  - Implementations may apply only nominal-phase configuration.
- `SetConfig(const FDCAN::Configuration &cfg)`:
  - Full configuration for nominal phase + data phase + FD mode;
  - Recommended when using CAN FD.

---

### FD Filters and Callbacks

#### FD Callback Type

```cpp
using CallbackFD = LibXR::Callback<const FDPack &>;
```

Like classic CAN, FD callbacks are invoked by `OnMessage(pack, in_isr)` as:

```cpp
cb.Run(in_isr, pack);
```

User callbacks should therefore follow:

```cpp
[](bool in_isr, void *arg, const LibXR::FDCAN::FDPack &pack) { ... }  // created with CallbackFD::Create(fun, arg)
```

#### `FDCAN::Filter`

```cpp
struct Filter {
  FilterMode mode;         ///< Filter mode.
  uint32_t start_id_mask;  ///< Start ID or mask.
  uint32_t end_id_mask;    ///< End ID or match value.
  Type type;               ///< Frame type.
  CallbackFD cb;           ///< Callback function.
};
```

Filter semantics match `LibXR::CAN::Filter`:

- `ID_MASK`: `(id & start_id_mask) == end_id_mask`
- `ID_RANGE`: `start_id_mask <= id && id <= end_id_mask`

#### Registering FD Callbacks

```cpp
void Register(CallbackFD cb,
              Type type,
              FilterMode mode = FilterMode::ID_RANGE,
              uint32_t start_id_mask = 0,
              uint32_t end_id_mask = UINT32_MAX);
```

- Similar to classic `CAN::Register`, but for FD frames (`FDPack`).
- Supports multiple subscribers and per-type filtering.
- Current implementation constraint: `type` must be `Type::STANDARD` or `Type::EXTENDED`.

Example: subscribe to extended FD frames in `[0x18FF0000, 0x18FFFFFF]`:

```cpp
LibXR::FDCAN &fdcan = ...;

fdcan.Register(
    LibXR::FDCAN::CallbackFD::Create(
        [](bool in_isr, void *arg, const LibXR::FDCAN::FDPack &pack) {
          (void)in_isr;
          (void)arg;
          (void)pack;
          // Fast processing, no blocking
        },
        static_cast<void *>(nullptr)),
    LibXR::CAN::Type::EXTENDED,
    LibXR::CAN::FilterMode::ID_RANGE,
    0x18FF0000, 0x18FFFFFF);
```

---

### FD Transmission and Receive Dispatch

#### Transmit API `AddMessage` (TX)

```cpp
virtual ErrorCode AddMessage(const FDPack &pack) = 0;
```

- Transmit API, called by the upper layer to hand an `FDPack` to the driver.
- The return value tells whether the frame was accepted into the transmit queue: `FULL` when the queue is full, `ARG_ERR` for type `ERROR`; the STM32 backend returns `FAILED` for remote frame types.

#### Receive Dispatch Helper `OnMessage` (RX dispatch helper)

```cpp
protected:
  void OnMessage(const FDPack &pack, bool in_isr);
```

- Called by the driver on FD frame reception.
- Internally dispatches to matching FD filters and invokes callbacks as `cb.Run(in_isr, pack)`.
