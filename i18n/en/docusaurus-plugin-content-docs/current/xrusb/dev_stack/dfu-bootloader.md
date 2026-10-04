---
id: xrusb-dev-stack-dfu-bootloader
title: DFU Bootloader
sidebar_position: 8
---

# DFU Bootloader Device Stack

This page describes the XRUSB bootloader-side DFU implementation:

- frontend device class: `LibXR::USB::DfuBootloaderClass`
- storage/state-machine backend: `LibXR::USB::DfuBootloaderBackend`

This path is used after the device has already entered the bootloader and needs to handle `DNLOAD / UPLOAD / manifest`.

---

## 1. Class and Construction

### 1.1 `LibXR::USB::DfuBootloaderBackend`

`DfuBootloaderBackend` implements bootloader-side storage and state-machine behavior around the `LibXR::Flash` abstraction.

Constructor:

```cpp
LibXR::USB::DfuBootloaderBackend backend(
    flash,
    image_offset,
    image_limit,
    seal_offset,
    jump_to_app,
    jump_app_ctx,
    true);
```

Parameters:

- `flash`: underlying `Flash` instance
- `image_offset` (named `image_base` in `DfuBootloaderClass`): start offset of the image region inside the `flash` object, not an absolute address
- `image_limit`: total image-region size
- `seal_offset`: offset of the seal record inside the image region
- `jump_to_app`: callback used to jump into the application firmware
- `jump_app_ctx`: callback context
- `autorun`: whether manifest completion may automatically request app launch

### 1.2 `LibXR::USB::DfuBootloaderClass`

In normal use, code constructs `DfuBootloaderClass` directly. It is currently an alias of `DfuBootloaderClassT<4096>`.

```cpp
LibXR::USB::DfuBootloaderClass dfu_bl(
    flash,
    image_base,
    image_limit,
    seal_offset,
    jump_to_app,
    jump_app_ctx,
    true,
    "XRUSB DFU");
```

Internally, the class combines:

- `DfuBootloaderBackend`
- `DFUClass<Backend, MAX_TRANSFER_SIZE>`

---

## 2. Interface and Descriptors

`DfuBootloaderClass` contributes one DFU interface only, does not use an IAD, and does not allocate additional data endpoints. All data moves over control transfers.

- `GetInterfaceCount() = 1`
- `HasIAD() = false`
- `bInterfaceClass = 0xFE`
- `bInterfaceSubClass = 0x01`
- `bInterfaceProtocol = 0x02`

The DFU Functional Descriptor fields are reported from backend `DFUCapabilities`:

- `can_download`
- `can_upload`
- `manifestation_tolerant`
- `will_detach`
- `detach_timeout_ms`
- `transfer_size`

The current default alias `DfuBootloaderClass` uses a maximum transfer block size of `4096` bytes, and that value is written into `wTransferSize`.

In addition to the optional WebUSB BOS capability, the bootloader DFU path also exposes a WinUSB MS OS 2.0 descriptor set by default through `DfuInterfaceClassBase`, using device-scoped WinUSB metadata unless overridden in the constructor.

---

## 3. Supported Requests and Behavior

Supported requests:

| Request | Behavior |
| ---- | ---- |
| `DNLOAD` | downloads firmware blocks; zero-length `DNLOAD` enters manifest |
| `UPLOAD` | reads back from the image region block by block |
| `GETSTATUS` | returns current DFU state, error code, and poll timeout |
| `GETSTATE` | returns current DFU state-machine state |
| `ABORT` | aborts the current transfer session |
| `CLRSTATUS` | clears the error state |

Additional notes:

- bootloader-side `DETACH` is not implemented and is treated as a protocol error
- an extra vendor request `0x5A` is supported to request execution of a verified image

---

## 4. What the Backend Owns

`DfuBootloaderBackend` is responsible for:

- download / upload / manifest session state
- flash erase management per erase block
- chunk buffering with deferred write execution
- image CRC32 calculation
- seal-record writing
- tracking image validity and launchability

The seal record format is:

```cpp
struct SealRecord
{
  uint32_t magic;
  uint32_t image_size;
  uint32_t crc32;
  uint32_t crc32_inv;
};
```

`magic` is fixed to `0x4C414553`, corresponding to `"SEAL"`.

---

## 5. Runtime Behavior

Bootloader DFU also needs periodic external `Process()` calls:

```cpp
dfu_bl.Process();
```

`Process()` advances deferred backend work, including:

- pending writes
- manifest processing

`Process()` must be called continuously from the main loop or a periodic task. Without it, the host sees `GETSTATUS` stay in a waiting state, and writes and manifest do not proceed.

If `autorun` is enabled, a ready image still needs to be consumed explicitly at the upper layer:

```cpp
if (dfu_bl.TryConsumeAppLaunch(now_ms))
{
}
```

Alternatively, the application can record one “request app launch” through `RequestRunApp()` or vendor request `0x5A`; the actual jump still happens later when `TryConsumeAppLaunch(...)` is explicitly consumed by the upper layer.

---

## 6. Usage Example

```cpp
#include "dfu/dfu_bootloader.hpp"

static void JumpToApp(void*)
{
  BoardJumpToApplication();
}

LibXR::USB::DfuBootloaderClass dfu_bl(
    flash,
    APP_IMAGE_OFFSET,  // offset inside the flash object
    APP_IMAGE_LIMIT,
    APP_SEAL_OFFSET,
    JumpToApp,
    nullptr,
    true);

// USB class list: {{&dfu_bl}}
// usb_dev.Init(false);
// usb_dev.Start(false);

for (;;)
{
  dfu_bl.Process();
  dfu_bl.TryConsumeAppLaunch(LibXR::Timebase::GetMilliseconds());
}
```

---

## 7. Relation to Runtime DFU

- Runtime DFU: handles `DETACH` in application mode and jumps into bootloader
- DFU Bootloader: handles image transfer, seal, manifest, and app launch in bootloader mode
