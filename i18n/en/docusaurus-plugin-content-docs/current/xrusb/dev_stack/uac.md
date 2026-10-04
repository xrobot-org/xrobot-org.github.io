---
id: xrusb-dev-stack-uac
title: UAC
sidebar_position: 3
---

# UAC Device Stack

This document describes XRUSB’s USB Audio Class 1.0 (UAC1) microphone device class implementation: `LibXR::USB::UAC1MicrophoneQ`. The class targets the UAC1 recording (Device → Host) use case. It uses a queue-driven byte FIFO to continuously feed upper-layer PCM data into an Isochronous IN endpoint, and implements the typical UAC1 control plane (sampling rate, mute, volume).

Supported capabilities:

- Standard UAC1 descriptor organization with IAD + AC + AS (two interfaces: AC/AS)
- Alt Setting 0/1 switching on the AS interface to start/stop the isochronous stream based on the host’s selection
- Sampling Frequency Control on the Iso IN endpoint (3-byte little-endian)
- Feature Unit Mute / Volume control (UAC1 semantics: Volume unit is 1/256 dB)
- Automatic computation of the bytes sent per isochronous service based on the sampling rate and service period (FS = 1 ms; HS service rate is determined by `bInterval`)

---

## 1. Class and Template Parameters

### `LibXR::USB::UAC1MicrophoneQ<CHANNELS, BITS_PER_SAMPLE>`

Template parameters:

- `CHANNELS`: number of channels (1..8)
- `BITS_PER_SAMPLE`: bit depth (8 / 16 / 24)

Internal constant:

- `K_SUBFRAME_SIZE`: bytes per sample per channel  
  - 8-bit → 1  
  - 16-bit → 2  
  - 24-bit → 3 (packed as 3 bytes; not a 32-bit container)

---

## 2. Constructor Parameters and Runtime State

Constructor parameters (in order):

- `iso_in_ep_num`: Iso IN endpoint number (required)
- `sample_rate_hz`: sampling rate (Hz)
- `vol_min / vol_max / vol_res`: volume range and step, unit 1/256 dB, default `0 / 0 / 1`
- `speed`: USB speed (`Speed::FULL` / `Speed::HIGH`), default `Speed::FULL`
- `queue_bytes`: PCM queue capacity (bytes), default 2048
- `interval`: Iso IN endpoint `bInterval`, default 1
  - Full-Speed: must be 1 (asserted when binding endpoints)
  - High-Speed: allowed 1..16 (spec meaning: microframe exponent scheduling)
- `control_interface_string` / `streaming_interface_string`: default `"XRUSB UAC1 Control"` / `"XRUSB UAC1 Streaming"`

Key runtime state after initialization:

- `streaming_`: `true` when AS Alt=1 is selected (actively streaming)
- `sr_hz_`: current sampling rate (can be changed by host via SET_CUR)
- `w_max_packet_size_`: runtime-computed `wMaxPacketSize` (bounded by FS/HS limits)
- `pcm_queue_`: PCM byte queue (`LibXR::SPSCQueue<uint8_t>`)

---

## 3. Upper-Layer PCM Input Interface (Producer API)

The minimal interface exposed to the upper layer is:

```cpp
ErrorCode WritePcm(const void* data, size_t nbytes);
size_t QueueSize() const;
size_t QueueSpace();
void ResetQueue();
```

### 3.1 PCM Data Format Requirements

- `WritePcm()` writes interleaved PCM bytes. The exact format is defined by the upper layer (and must match the descriptor):
  - 16-bit: S16LE (little-endian)
  - 24-bit: S24_3LE (3-byte little-endian)
- Channel interleaving: e.g., for 2ch: `L0 R0 L1 R1 ...`

### 3.2 Queue Sizing Recommendation

To reduce underflow caused by short-term jitter, it is recommended that `queue_bytes` covers at least tens of milliseconds of buffering:

- Estimate: `bytes_per_ms ≈ sample_rate_hz * CHANNELS * K_SUBFRAME_SIZE / 1000`
- Example: 48 kHz / 2ch / 16-bit → `48000 * 2 * 2 / 1000 = 192 bytes/ms`  
  2048 bytes ≈ 10.7 ms buffering

---

## 4. UAC1 Interfaces and Descriptor Layout

The device exposes two interfaces and associates them with an IAD:

- Audio Control (AC) interface: entity topology and controls (Feature Unit)
- Audio Streaming (AS) interface: carries the audio stream (Alt 0/Alt 1)

Implementation constraints:

- `GetInterfaceCount()` returns `2`
- `HasIAD()` returns `true`

### 4.1 Entity Topology (Entity Graph)

Entity IDs (fixed in code):

| Entity                          |   ID | Description                                 |
| ------------------------------- | ---: | ------------------------------------------- |
| Input Terminal (Microphone)     |    1 | `wTerminalType = 0x0201`                    |
| Feature Unit (Mute/Volume)      |    2 | Control selectors: Mute(0x01), Volume(0x02) |
| Output Terminal (USB Streaming) |    3 | `wTerminalType = 0x0101`                    |

Connection:

`IT_MIC (1) → FU (2) → OT_USB (3) → AS Interface`

### 4.2 Alternate Settings on the AS Interface

- Alt 0: no endpoint (no transmission)
- Alt 1: includes 1 Isochronous IN endpoint (start transmission)

On the host side, switching the Alt Setting is the only trigger to start/stop audio streaming (see Section 6).

### 4.3 Channel Configuration `wChannelConfig`

The current implementation explicitly declares only `CHANNELS == 2`:

- `wChannelConfig = 0x0003` (Left Front | Right Front)

Other channel counts default to `0x0000` (unspecified). For stricter multichannel position declarations, consider extending the mapping per the UAC1 specification.

---

## 5. Isochronous IN Endpoint and Packet Size Limits

Endpoint type and attributes:

- Type: Isochronous IN
- `bmAttributes = 0x05` (Isochronous + Asynchronous + Data)
- `bInterval`:
  - FS: fixed to 1 (1 ms frame)
  - HS: uses the constructor parameter `interval`

Runtime limits for `wMaxPacketSize`:

- Full-Speed: single transaction ≤ 1023
- High-Speed: single transaction ≤ 1024  
  > Note: This implementation computes and limits the size per “single transaction / per service”. It does not use the HS multiplier (multiple transactions per microframe).

---

## 6. Stream Control: Behavior of `SetAltSetting()`

`SetAltSetting(itf, alt)` is effective only for the AS interface:

- `alt = 0` (stop transmission)
  - `streaming_ = false`
  - `ep_iso_in_->SetActiveLength(0)`
  - `ep_iso_in_->Close()`
- `alt = 1` (start transmission)
  - reconfigure the endpoint with the current `w_max_packet_size_`
  - reset the remainder accumulator `acc_rem_ = 0`
  - `streaming_ = true`
  - call `KickOneFrame()` immediately to submit the first frame

`GetAltSetting()` mirrors `streaming_` (true→1, false→0).

---

## 7. Timing and Per-Frame Byte Count Computation (`RecomputeTiming()`)

This function is invoked in two cases:

- during construction (initial sampling rate)
- after the host changes the sampling rate via endpoint SET_CUR (see Section 9)

### 7.1 Service Frequency `service_hz_`

- Full-Speed: fixed `1000 Hz` (1 ms frame) and enforces `interval_ == 1`
- High-Speed: compute service frequency from `bInterval` (8000 microframes per second)
  - `service_hz_ = 8000 / 2^(bInterval-1)`  
  - `bInterval` is clamped to 1..16

### 7.2 Bytes per Second `bytes_per_sec_`

```text
bytes_per_sec_ = sr_hz_ * CHANNELS * K_SUBFRAME_SIZE
```

### 7.3 Target Bytes per Service (base + remainder)

```text
base_bytes_per_service = bytes_per_sec_ / service_hz_
rem_bytes_per_service  = bytes_per_sec_ % service_hz_
```

The implementation uses a remainder accumulator to distribute `rem` evenly:

- send `base_bytes_per_service` each service
- `acc_rem_ += rem_bytes_per_service`
- if `acc_rem_ >= service_hz_`, send one extra byte and `acc_rem_ -= service_hz_`

The result is then clamped (FS≤1023, HS≤1024) to form `w_max_packet_size_`.

---

## 8. Data Transmission Strategy (Queue Pop + Iso IN)

### 8.1 Core Flow: `KickOneFrame()`

Trigger conditions:

- `streaming_ == true`
- `ep_iso_in_` state is `IDLE`

Steps:

1. compute the target number of bytes to send in this service, `to_send`
2. clamp `to_send` to `w_max_packet_size_` and the endpoint buffer size
3. pop from `pcm_queue_`:
   - `take = min(queue_size, to_send)`
   - `PopBatch(buf, take)`
4. call `ep_iso_in_->Transfer(take)` to submit the transfer

### 8.2 Underflow Behavior

The current implementation first computes the target transfer length `to_send`, then pops at most `take = min(queue_size, to_send)` bytes from the PCM queue.

- When `take == to_send`, the whole packet comes from queued PCM data.
- When `take < to_send`, the remaining `to_send - take` bytes in the endpoint buffer are zero-filled.
- The length submitted to the endpoint is always `to_send`.

---

## 9. Class Request Handling (Control Plane)

Two control surfaces are implemented:

1. Endpoint sampling-frequency control (Recipient = Endpoint)
2. Feature Unit control (Recipient = Interface / Entity)

### 9.1 Endpoint Sampling Frequency Control

Match conditions (implementation logic):

- `wIndex & 0xFF` equals the Iso IN endpoint address
- `(wValue >> 8) == 0x01` (Sampling Freq Control Selector)
- data length must be 3 bytes (24-bit little-endian)

Supported requests:

| Request             | wLength | Behavior                                                       |
| ------------------- | ------: | -------------------------------------------------------------- |
| `GET_CUR`           |       3 | return `sf_cur_[3]`                                            |
| `SET_CUR`           |       3 | write `sf_cur_` in data stage and set `pending_set_sf_ = true` |
| `GET_MIN / GET_MAX` |       3 | return `sf_cur_` (single-frequency implementation)             |
| `GET_RES`           |       3 | return `{1,0,0}` (1 Hz)                                        |

Data stage `OnClassData()`:

- when `bRequest == SET_CUR && pending_set_sf_`:
  - parse `sf_cur_` into `NEW_SR`
  - if `NEW_SR > 0` and differs from current, update `sr_hz_` and call `RecomputeTiming()`
  - clear `pending_set_sf_`

### 9.2 Feature Unit: Mute / Volume

Match conditions:

- `ITF = (wIndex & 0xFF)` must equal the AC interface number `itf_ac_num_`
- `ENT = (wIndex >> 8)` must equal the Feature Unit ID (`ID_FU = 2`)
- `CH = (wValue & 0xFF)`: 0=Master, 1..CHANNELS

#### Mute (1 byte)

- `SET_CUR (wLength=1)`: write `mute_`
- `GET_CUR (wLength=1)`: read `mute_`

#### Volume (2 bytes, unit 1/256 dB)

- `SET_CUR (wLength=2)`: write `vol_cur_`
- `GET_CUR (wLength=2)`: read `vol_cur_`
- `GET_MIN / GET_MAX / GET_RES (wLength=2)`: return constructor parameters `vol_min_ / vol_max_ / vol_res_`

---

## 10. Usage Example

```cpp
#include "uac_mic.hpp"

using Mic = LibXR::USB::UAC1MicrophoneQ<2, 16>; // 2ch, 16-bit

Mic mic(/*iso_in_ep*/LibXR::USB::Endpoint::EPNumber::EP1,
        /*sample_rate*/48000,
        /*vol_min*/-90*256, /*vol_max*/0, /*vol_res*/256,
        /*speed*/LibXR::USB::Speed::FULL,
        /*queue_bytes*/2048,
        /*interval*/1);

// Add &mic to the USB Device class list during initialization: {{&mic}}
// usb_dev.Init(false);
// usb_dev.Start(false);

// Upper layer: continuously write S16LE interleaved PCM
mic.WritePcm(pcm_bytes, pcm_len);
```

The host starts pulling the stream after selecting Alt=1 on the AS interface; switching back to Alt=0 stops the stream.
