---
id: xrusb-dev-stack-dfu-runtime
title: DFU Runtime
sidebar_position: 7
---

# DFU Runtime Device Stack

`LibXR::USB::DfuRuntimeClass` provides the Runtime DFU interface used while the application firmware is already running.

It handles runtime `DETACH`: after the host requests an upgrade, the device jumps to the board-level bootloader once the configured timeout expires; `DfuBootloaderClass` in the bootloader transfers the firmware.

---

## 1. Class and Construction

### 1.1 `LibXR::USB::DfuRuntimeClass`

Constructor:

```cpp
using JumpCallback = void (*)(void*);

LibXR::USB::DfuRuntimeClass dfu_rt(
    jump_to_bootloader,
    jump_ctx,
    50,
    "XRUSB DFU RT");
```

Parameters:

- `jump_to_bootloader`: board-level jump callback executed after timeout
- `jump_ctx`: callback context
- `detach_timeout_ms`: default `DETACH` timeout
- `interface_string`: interface string, default `"XRUSB DFU RT"`

If `webusb_landing_page_url` and `webusb_vendor_code` are provided, the class also publishes an additional WebUSB BOS capability.

By default, the runtime DFU path also exposes a WinUSB MS OS 2.0 descriptor set through the shared `DfuInterfaceClassBase`, using function-scoped WinUSB metadata.

---

## 2. Interface and Descriptors

`DfuRuntimeClass` contributes one interface only, does not use an IAD, and does not allocate extra data endpoints.

- `GetInterfaceCount() = 1`
- `HasIAD() = false`
- `bInterfaceClass = 0xFE`
- `bInterfaceSubClass = 0x01`
- `bInterfaceProtocol = 0x01`

Key fields of the Runtime DFU Functional Descriptor:

- `bmAttributes`
  - includes `WillDetach` when `jump_to_bootloader` is available
  - otherwise stays `0`
- `wDetachTimeOut`
  - comes from the constructor, or later from the `DETACH` request `wValue`
- `wTransferSize = 0`
- `bcdDFUVersion = 0x0110`

---

## 3. Request Handling

Runtime DFU mainly handles these class requests:

| Request | Behavior |
| ---- | ---- |
| `DETACH` | accepted only in `APP_IDLE`, records timeout and enters `APP_DETACH` |
| `GETSTATUS` | returns current state and remaining timeout |
| `GETSTATE` | returns current DFU state |

Notes:

- `DETACH` does not jump immediately
- the real effect of `DETACH` is “record the deadline, then wait for external `Process()` calls”
- if there is no `jump_to_bootloader` callback, `DETACH` returns not supported

---

## 4. Runtime Behavior

Runtime DFU requires periodic external calls to `Process()`:

```cpp
dfu_rt.Process();
```

`Process()` calls `jump_to_bootloader(jump_ctx)` when `detach_pending_` is set and the timeout has expired.

So this path can live in:

- the main loop
- a periodic task
- a timed scheduler entry

`Process()` must be called periodically; without it, the device does not jump to the bootloader after the host issues `DETACH`.

---

## 5. Usage Example

```cpp
#include "dfu/dfu_runtime.hpp"

static void JumpToBootloader(void*)
{
  BoardJumpToBootloader();
}

LibXR::USB::DfuRuntimeClass dfu_rt(JumpToBootloader, nullptr, 50);

// USB class list: {{&dfu_rt}}
// usb_dev.Init(false);
// usb_dev.Start(false);

for (;;)
{
  dfu_rt.Process();
}
```

---

## 6. Relation to DFU Bootloader

- Runtime DFU: exposes `DETACH` in application mode and jumps into bootloader after timeout
- DFU Bootloader: handles `DNLOAD / UPLOAD / manifest` in bootloader mode

Projects without a separate bootloader usually do not need this class.
