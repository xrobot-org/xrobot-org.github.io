---
id: double_buffer
title: Double Buffer
sidebar_position: 9
---

# Double Buffer

`LibXR::DoubleBuffer` is a double-buffer state manager designed for embedded scenarios. It is mainly used to control switching and filling across two half-buffers in high-speed paths such as DMA and USB. It manages the active/pending halves and their state bits, but does not allocate or free the backing storage itself.

## Key Features

- Splits one contiguous memory block into two equal halves.
- Supports switching between the active buffer and the pending buffer.
- Provides direct access and data fill interfaces for both buffers.
- Supports default construction followed by later `Init()` binding.
- Exposes pending state plus auxiliary active/pending length metadata.

## Interface Overview

### Construction and initialization

```cpp
DoubleBuffer() = default;
explicit DoubleBuffer(const LibXR::RawData& raw_data);
void Init(const LibXR::RawData& raw_data);
void Reset();
```

- `DoubleBuffer(raw_data)` and `Init(raw_data)` use the same initialization path.
- `raw_data` must be aligned to `alignof(size_t)` and its size must be a multiple of `2 * alignof(size_t)`, otherwise Debug builds assert; an empty double buffer may use `nullptr + 0`.
- `Reset()` only clears runtime state and keeps the two bound halves attached.

### Data Operation Interfaces

- `uint8_t* ActiveBuffer()`: Get the currently active buffer.
- `uint8_t* PendingBuffer()`: Get the pending buffer.
- `uint8_t* Buffer(int block)`: Access half `0` or `1` by stable block number.
- `bool FillActive(const uint8_t* data, size_t len)`: Write data to the active buffer.
- `bool FillPending(const uint8_t* data, size_t len)`: Write data to the pending buffer.
- `void EnablePending()`: Manually mark the current pending state as valid; this API **does not copy data and does not switch the active block**.
- `bool HasPending() const`: Check if there is a pending buffer ready to be switched.
- `void Switch()`: If pending is valid, flips the active block and clears the pending-valid bit.
- `size_t GetPendingLength() const`: Get the valid data length in the pending buffer.
- `size_t GetActiveLength() const`: Get the auxiliary length field of the active buffer.
- `void SetPendingLength(size_t length)`: Set the auxiliary length field of the pending buffer.
- `void SetActiveLength(size_t length)`: Set the auxiliary length field of the active buffer.
- `int ActiveBlock() const` / `void SetActiveBlock(bool)` / `void FlipActiveBlock()`: Directly control the active block index.
- `size_t Size() const`: Get the capacity of each buffer.

Additional notes:

- `FillPending()` copies bytes into the pending half and records their length.
- `FillActive()` only copies bytes into the active half and does not update the active length; call `SetActiveLength()` when the length is needed.
- `EnablePending()` only marks the pending half valid and does not set the pending length.

## Usage Example

```cpp
alignas(size_t) uint8_t mem[512] = {};
LibXR::RawData raw(mem, sizeof(mem));
LibXR::DoubleBuffer buf;
buf.Init(raw);

// Write to the current pending half and mark it ready for the next switch
buf.FillPending(data1, len1);
if (buf.HasPending()) {
    buf.Switch();  // Switch to the new active buffer
}
```

If the upper layer writes bytes into the pending half by itself and only needs the state transition, it should usually also provide the length explicitly:

```cpp
std::memcpy(buf.PendingBuffer(), data2, len2);
buf.SetPendingLength(len2);
buf.EnablePending();
```

## Notes

- The pending buffer becomes active only after `Switch()`.
- The class does not allocate; the caller provides the storage (a static array or caller-managed dynamic memory) meeting the alignment and size rules above.
- While pending is valid, `FillPending()` writes nothing and returns `false`; `GetPendingLength()` returns 0 while pending is not valid.
- `EnablePending()` only changes the pending-valid bit. It does not copy data and does not synchronize the length fields automatically.

## Application Scenarios

- USB CDC / UART data transmission
- Optimized DMA data streaming
- Ping-pong buffering communication mechanism
