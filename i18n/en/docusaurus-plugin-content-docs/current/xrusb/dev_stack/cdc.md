---
id: xrusb-dev-stack-cdc
title: CDC
sidebar_position: 1
---

# CDC Device Stack

This section introduces XRUSB’s USB CDC ACM (virtual serial port) device class implementation, focusing on:

- Descriptor organization (IAD + Communication Interface + Data Interface)
- Endpoint resource allocation, configuration, and callback dispatch
- CDC ACM standard class request handling (Line Coding / Control Line State)
- Serial State notification format and sending strategy
- Upper-layer adaptation (`CDCUart` / `CDCToUart`) and throughput test classes (`CDCWriteTest` / `CDCReadTest`)

The current CDC stack consists of the following header files (source code is included in the repository):

- `cdc_base.hpp`: CDC ACM common base (descriptors / class requests / endpoint management / callback dispatch)
- `cdc_uart.hpp`: CDC ↔ UART semantic adapter (exposes `LibXR::UART`-style Read/Write to the upper layer)
- `cdc_to_uart.hpp`: CDC ↔ UART bidirectional bridge (`CDCToUart`, continuous CDC to external UART pumping)
- `cdc_test.hpp`: Throughput test classes (continuous write-out / continuous read-in)

---

## Component Overview

### `LibXR::USB::CDCBase`

`CDCBase` inherits from `DeviceClass` and implements the common CDC ACM functionality:

- Endpoint resource allocation and configuration (Data IN / Data OUT / Comm IN)
- Filling a configuration-descriptor block for IAD + Communication Interface + Data Interface
- CDC ACM standard class request handling (`GET_LINE_CODING` / `SET_LINE_CODING` / `SET_CONTROL_LINE_STATE` / `SEND_BREAK`; `SEND_BREAK` is answered with a ZLP only)
- Notifying the upper layer via callbacks for control line changes (DTR/RTS) and line parameter changes (Line Coding)
- Providing TX/RX completion hooks (`OnDataOutComplete` / `OnDataInComplete`) for derived classes to implement concrete data paths

`CDCBase` does not implement a data path directly; derived classes must implement:

```cpp
virtual void OnDataOutComplete(bool in_isr, ConstRawData& data) = 0;
virtual void OnDataInComplete(bool in_isr, ConstRawData& data) = 0;
```

These hooks are triggered by endpoint transfer completion, and dispatched after an `inited_` guard via `CDCBase`’s static trampoline.

### `LibXR::USB::CDCUart`

`CDCUart` inherits from `CDCBase` and also from `LibXR::UART`, exposing typical UART semantics to the upper layer:

- `Read()`: reads data from OUT transactions sent by the host
- `Write()`: sends IN data to the host
- `SetConfig()`: maps UART configuration to CDC Line Coding, and sends one Serial State notification

Internally it uses `LibXR::ReadPort` / `LibXR::WritePort` as a software RX buffer and TX queue manager, and performs enqueue/dequeue in endpoint callbacks. When the RX queue lacks space, the received data is held and OUT reception pauses; after the upper layer reads data, the held data is queued and reception restarts.

### `LibXR::USB::CDCToUart`

`CDCToUart` derives from `CDCUart` and bridges a USB CDC virtual serial port with an external `LibXR::UART` instance bidirectionally:

- CDC RX → UART TX: CDC OUT data is written to the UART
- UART RX → CDC TX: UART RX data is written to CDC

It is implemented as a callback chain: completing a write on one side starts the next read, so data is forwarded continuously.

Notes:

- The constructor performs dynamic allocation (heap buffers for RX/TX temporary storage).
- The bridged UART's write-port capacity must be at least `rx_buffer_size` (asserted in the constructor).
- After construction it arms one CDC read and one UART read (`Read({nullptr, 0}, ...)`) to enter the callback chain.
- The constructor registers its own callback with `SetOnSetLineCodingCallback()` that forwards host line coding to the bridged UART's `SetConfig()`; calling `SetOnSetLineCodingCallback()` on a `CDCToUart` replaces this forwarding.

### `LibXR::USB::CDCWriteTest` / `LibXR::USB::CDCReadTest`

Both derive from `CDCBase` and are used to validate link throughput and driver stability:

- `CDCWriteTest`: ignores host OUT data; when DTR is asserted, continuously returns data through Data IN (tests device → host path)
- `CDCReadTest`: on top of the `CDCBase` initial `MaxPacketSize()` OUT arm, it immediately re-arms the OUT endpoint with `MaxTransferSize()` and keeps restarting with `MaxTransferSize()` on each completion (tests host → device path)

---

## Interfaces and Endpoint Layout

### Interfaces

A CDC ACM device is exposed as two interfaces (Communication + Data) and includes an IAD (Interface Association Descriptor), allowing the host to recognize it as a single CDC composite function.

- Communication Interface: includes 1 Interrupt IN endpoint (Notification Endpoint)
- Data Interface: includes 1 Bulk OUT + 1 Bulk IN endpoint (data RX/TX)

`CDCBase::GetInterfaceCount()` always returns `2`, and `HasIAD()` always returns `true`.

Notes:

- The IAD’s `bFirstInterface` is derived from the `start_itf_num` offset
- The Communication Interface is typically the target interface for class requests (the request `wIndex` points to this interface number)
- `CDCBase` records the communication interface number as `itf_comm_in_num_ = start_itf_num`, which is used as `wIndex` in the Serial State notification

### Endpoints

`CDCBase::BindEndpoints()` requests and configures the following endpoints from `EndpointPool`:

| Endpoint | Direction | Type      | Typical Use                           |
| -------- | --------- | --------- | ------------------------------------- |
| Data OUT | OUT       | BULK      | Host → device data reception          |
| Data IN  | IN        | BULK      | Device → host data transmission       |
| Comm IN  | IN        | INTERRUPT | CDC notifications (Serial State, etc) |

The Comm IN endpoint max packet size is fixed at 16 bytes; the Serial State notification itself is a 10-byte structure (see below).

Constructors of `CDCBase`-derived classes take endpoint numbers in this order: data IN, data OUT, notification IN. Data IN and data OUT may share one number (for example EP1); the notification endpoint uses another. `CDCUart`, `CDCWriteTest` and `CDCReadTest` also take two interface strings at the end, defaulting to `"XRUSB CDC Control"` and `"XRUSB CDC Data"`; `CDCToUart` has no such parameters.

### Speed and Max Packet Size

The endpoint descriptor `wMaxPacketSize` for Data IN/OUT is taken from the endpoint object’s `MaxPacketSize()`.

- Full-Speed Bulk is typically 64 bytes/packet
- High-Speed Bulk is typically 512 bytes/packet (if the platform supports HS)

The actual value depends on the platform USB controller and endpoint implementation. The stack writes whatever value is reported by the endpoint into the descriptor.

---

## Key Capabilities of CDCBase

### DTR/RTS Control Line State

`CDCBase` maintains a control line state `control_line_state_` and provides:

```cpp
bool IsDtrSet() const;
bool IsRtsSet() const;
```

When receiving the `SET_CONTROL_LINE_STATE` class request, the behavior is:

- Update `control_line_state_` (from `wValue`)
- Return a ZLP (Zero-Length Packet) as acknowledgement
- Call `SendSerialState()` to attempt reporting the current serial state via Comm IN
- Trigger the user callback set by `SetOnSetControlLineStateCallback(cb)`, with `(DTR, RTS)` as arguments

Engineering recommendation:

- Treat DTR as the key signal indicating “the host has opened the serial port / is ready to communicate”
- When DTR is deasserted, avoid continuing to transmit to prevent upper-layer blocking or meaningless queue buildup

### Line Coding (Baud Rate / Parity / Stop Bits / Data Bits)

CDC ACM Line Coding is read/written via the class requests `SET_LINE_CODING` / `GET_LINE_CODING`.

- `GET_LINE_CODING`: the device returns the current `line_coding_` (7 bytes)
- `SET_LINE_CODING`: the 7-byte `line_coding_` is written in the control transfer data stage, then converted to `LibXR::UART::Configuration` and delivered to the upper layer in `OnClassData()`

The data length for `SET_LINE_CODING` must be exactly 7 bytes; otherwise it returns `ErrorCode::ARG_ERR`.

#### Line Coding Mapping Rules

`CDCBase` currently maps CDC Line Coding to `LibXR::UART::Configuration` as follows:

| CDC Field     | Value      | Mapped UART Configuration                                       |
| ------------- | ---------- | --------------------------------------------------------------- |
| `dwDTERate`   | any        | `cfg.baudrate = dwDTERate`                                      |
| `bCharFormat` | 0          | `stop_bits = 1`                                                 |
| `bCharFormat` | 2          | `stop_bits = 2`                                                 |
| `bCharFormat` | other      | fallback to `stop_bits = 1` (`1.5 stop bits` not yet supported) |
| `bParityType` | 1          | `parity = ODD`                                                  |
| `bParityType` | 2          | `parity = EVEN`                                                 |
| `bParityType` | other      | fallback to `NO_PARITY` (Mark/Space will be downgraded)         |
| `bDataBits`   | 5/6/7/8/16 | `data_bits = bDataBits` (passthrough)                           |

Tips:

- On most desktop OSes, CDC Line Coding is more of a “negotiation / hint”; whether it truly affects host-side serial parameters depends on driver policy
- If bridging a real UART peripheral, trust the callback parameters and validate legality on the peripheral side

---

## Serial State Notification

`SendSerialState()` sends a Serial State notification to the host via the Comm IN (Interrupt IN) endpoint.

The notification is 10 bytes:

- 8-byte CDC Notification Header
- 2-byte UART state bitmap `serialState`

The code defines the structure as:

```cpp
#pragma pack(push, 1)
struct SerialStateNotification
{
  uint8_t  bmRequestType;   // fixed 0xA1
  uint8_t  bNotification;   // fixed SERIAL_STATE (0x20)
  uint16_t wValue;          // fixed 0
  uint16_t wIndex;          // Interface number (Communication Interface)
  uint16_t wLength;         // fixed 2
  uint16_t serialState;     // UART state bitmap
};
#pragma pack(pop)
```

---

## Callbacks and Execution Context

`CDCBase` exposes two upper-layer callbacks:

- `SetOnSetControlLineStateCallback(LibXR::Callback<bool, bool> cb)`
- `SetOnSetLineCodingCallback(LibXR::Callback<LibXR::UART::Configuration> cb)`

---

## Initialization and Resource Release Behavior

### Binding Endpoints

Key actions in `CDCBase::BindEndpoints(endpoint_pool, start_itf_num, in_isr)`:

- Clear `control_line_state_`
- Request three endpoints from `EndpointPool` and `Configure` them
- Fill the descriptor block for IAD, Communication Interface, Data Interface, and endpoint descriptors
- Pass the descriptor block to the device framework via `SetData(RawData{...})` to be stitched into the configuration descriptor
- Register transfer-complete callbacks for Data OUT / Data IN endpoints
- Set `inited_ = true`
- Start pre-receiving on Data OUT: `ep_data_out_->Transfer(ep_data_out_->MaxPacketSize())`

Notes:

- The pre-receive length uses `MaxPacketSize()` as the first receive length to enter the continuous receive loop quickly
- `CDCBase` does not buffer received data; derived classes must consume the data in `OnDataOutComplete` and restart the OUT transfer (or restart according to their own strategy)

### Unbinding Endpoints

Key actions in `CDCBase::UnbindEndpoints(endpoint_pool, in_isr)`:

- Set `inited_ = false`
- Clear `control_line_state_`
- Close three endpoints and clear active length
- Return endpoints to the `EndpointPool`
- Set endpoint pointers to null

Derived classes or upper-layer adapters should ensure in `UnbindEndpoints()`:

- Terminate all asynchronous operations that depend on endpoint objects
- Finish pending read/write requests (with success or an error) so the upper layer does not wait forever

`CDCUart::UnbindEndpoints()` calls `CDCBase::UnbindEndpoints()` and then only clears the ZLP flag and the receive-pause state (`recv_pause_` / `pending_data_`); data still in the TX queue is kept, and pending writes are not finished with an error.

---

## Usage Examples

### Using as a CDC Virtual Serial Port (Recommended: `CDCUart`)

```cpp
#include "cdc_uart.hpp"

using EPNumber = LibXR::USB::Endpoint::EPNumber;

// data IN EP1, data OUT EP1, notification IN EP2
LibXR::USB::CDCUart cdc_uart(EPNumber::EP1, EPNumber::EP1, EPNumber::EP2,
                             /*rx*/ 256, /*tx*/ 256, /*tx_queue*/ 8);

// When constructing the USB device, put &cdc_uart into the class list: {{&cdc_uart}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

Optional: listen to host changes for Line Coding and DTR/RTS:

```cpp
cdc_uart.SetOnSetLineCodingCallback(
  LibXR::Callback<LibXR::UART::Configuration>::Create(
    [](bool in_isr, int, LibXR::UART::Configuration cfg) {
      (void)in_isr;
      // Synchronize to a real UART peripheral here if needed
      // (do not block in ISR context)
    },
    0
  )
);

cdc_uart.SetOnSetControlLineStateCallback(
  LibXR::Callback<bool, bool>::Create(
    [](bool in_isr, int, bool dtr, bool rts) {
      (void)in_isr;
      (void)rts;
      // dtr=true: the host has opened the port; transmission can start
    },
    0
  )
);
```

### CDC ↔ External UART Bidirectional Bridge (`CDCToUart`)

```cpp
#include "cdc_to_uart.hpp"

extern LibXR::UART& uart1;  // hardware UART being bridged

LibXR::USB::CDCToUart cdc_to_uart(
  LibXR::USB::Endpoint::EPNumber::EP1,  // data IN
  LibXR::USB::Endpoint::EPNumber::EP1,  // data OUT
  LibXR::USB::Endpoint::EPNumber::EP2,  // notification IN
  uart1,
  /*rx_buffer_size*/ 128,
  /*tx_buffer_size*/ 128,
  /*tx_queue_size*/  5
);

// When constructing the USB device, put &cdc_to_uart into the class list: {{&cdc_to_uart}}
// usb_dev.Init(false);
// usb_dev.Start(false);
```

### Throughput Tests

Write test:

```cpp
#include "cdc_test.hpp"
using EPNumber = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::CDCWriteTest cdc_write_test(EPNumber::EP1, EPNumber::EP1, EPNumber::EP2);
```

Read test:

```cpp
#include "cdc_test.hpp"
using EPNumber = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::CDCReadTest cdc_read_test(EPNumber::EP1, EPNumber::EP1, EPNumber::EP2);
```

Pass them into the USB Device class list in the same way.
