---
id: core-mem
sidebar_position: 11
title: Fast Memory Operations
---

# Memory FastCopy / FastMove / FastSet / FastCmp

`LibXR::Memory` provides a set of alignment- and burst-optimized memory primitives intended to replace generic `memcpy / memset / memcmp` on hot paths (such as ring buffer moves, IO TX/RX packing, etc.). The implementation selects a better 8/4/2/1-byte granularity based on pointer alignment and uses loop unrolling to improve throughput.

> `FastCopy` only supports **non-overlapping** copy semantics.

## API

```cpp
namespace LibXR {
class Memory {
 public:
  /**
   * @brief Fast memory copy (non-overlapping semantics)
   * @param dst  Destination address
   * @param src  Source address
   * @param size Number of bytes to copy
   */
  void FastCopy(void* dst, const void* src, size_t size);

  /**
   * @brief Fast memory move (overlap-safe)
   * @param dst  Destination address
   * @param src  Source address
   * @param size Number of bytes to move
   */
  void FastMove(void* dst, const void* src, size_t size);

  /**
   * @brief Fast memory fill (memset-like)
   * @param dst   Destination address
   * @param value Fill value (repeated per byte)
   * @param size  Number of bytes to fill
   */
  void FastSet(void* dst, uint8_t value, size_t size);

  /**
   * @brief Fast memory compare (memcmp-like)
   * @param a    Address A
   * @param b    Address B
   * @param size Number of bytes to compare
   * @return 0 if equal; otherwise non-zero. The sign and difference semantics match memcmp (difference of the first mismatching byte).
   */
  int FastCmp(const void* a, const void* b, size_t size);
};
} // namespace LibXR
```

## FastCopy Semantics

- If `dst` and `src` have the same alignment phase (alignment offset), the implementation first handles the unaligned head bytes, then switches to burst copies using `LibXR::ALIGN_SIZE` (typically 8 or 4) with 8x unrolling.
- If their alignment phases differ, it tries to fall back to the largest possible width based on address delta:
  - When `LibXR::ALIGN_SIZE == 8` and the address delta is a multiple of 4, it can fall back to 4-byte burst copies.
  - When the address delta is even, it can fall back to 2-byte burst copies.
  - Otherwise it falls back to byte-by-byte copying.
- The tail that does not fill a full "wide copy" unit is completed byte-by-byte.

## FastMove Semantics

- The current implementation of `FastMove()` first checks whether `dst` and `src` overlap:
  - if they do not overlap, it falls back directly to `FastCopy()`;
  - if they do overlap, it uses the safe move path.
- It is intended for “possibly overlapping” regions; if you already know the regions do not overlap, prefer `FastCopy()`.

## FastSet Semantics

- Returns immediately if `size == 0`.
- Writes head bytes until aligned, then performs bulk stores using a `LibXR::ALIGN_SIZE`-wide pattern (8 or 4) with 8x unrolling, and finally writes the tail bytes.

## FastCmp Semantics

- Equivalent to `memcmp(a, b, size)`: returns 0 if equal; otherwise non-zero.
- Returns 0 when `size == 0` or `a == b`.
- If alignment conditions allow, it compares using `LibXR::ALIGN_SIZE`-wide loads (8 or 4) with 8x unrolling. When a wide word differs, it falls back to byte-by-byte comparison within that word to produce the same return value semantics as `memcmp`.
- Falls back to byte-by-byte comparison when alignment conditions do not allow the wide path.

## Usage Example

```cpp
#include "libxr_mem.hpp"

uint8_t src[256];
uint8_t dst[256];

// ... fill src ...

// Non-overlapping fast copy
LibXR::Memory::FastCopy(dst, src, sizeof(src));

// Overlap-safe move
LibXR::Memory::FastMove(dst + 8, dst, 64);

// Fast fill
LibXR::Memory::FastSet(dst, 0x00, sizeof(dst));

// Fast compare
int diff = LibXR::Memory::FastCmp(dst, src, sizeof(src));
if (diff == 0) {
  // equal
} else if (diff < 0) {
  // dst < src
} else {
  // dst > src
}
```
