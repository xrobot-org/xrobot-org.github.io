---
id: crc
title: CRC
sidebar_position: 8
---

# CRC

`crc.hpp` provides `CRC8`, `CRC16`, `CRC32` and `CRC64`. All four expose `Calculate(data, size)`. CRC8/16/32 also provide `Verify()` for a checksum stored at the end of the buffer.

## Basic use

```cpp
#include "crc.hpp"

uint8_t packet[5]{1, 2, 3, 4, 0};
LibXR::CRC8::GenerateTable();
packet[4] = LibXR::CRC8::Calculate(packet, 4);

bool valid = LibXR::CRC8::Verify(packet, sizeof(packet));
```

Tables are also generated lazily on first calculation. If several contexts can race the first use of one CRC class, generate its table during initialization.

## Parameters

| Class | Initial value | Reflected polynomial |
| --- | --- | --- |
| CRC8 | `0xFF` | `0x8C` |
| CRC16 | `0xFFFF` | `0x8408` |
| CRC32 | `0xFFFFFFFF` | `0xEDB88320` |
| CRC64 | `0xFFFFFFFFFFFFFFFF` | `0xC96C5795D7870F42` |

Calculation returns the current accumulator without an extra final XOR. When matching an external protocol, compare polynomial, initial value, reflection, final XOR and checksum byte order together.

## Verify

`Verify(raw, len)` includes the trailing CRC in `len`:

- CRC8 needs at least 2 bytes;
- CRC16 needs at least 2 bytes;
- CRC32 should be called with at least 4 bytes.

CRC16/32 read the checksum tail in native integer representation. Cross-platform protocols usually define checksum endianness explicitly and compare `Calculate()` with a decoded integer.

CRC64 currently provides `Calculate()` only.
