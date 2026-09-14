---
id: core-mem
sidebar_position: 11
title: 快速内存操作
---

# Memory FastCopy / FastMove / FastSet / FastCmp

`LibXR::Memory` 提供一组经过对齐与突发（burst）优化的内存操作路径，用于替代通用 `memcpy / memset / memcmp` 的热路径场景（如环形缓冲搬运、IO 收发缓存打包等）。实现会根据源/目的指针的对齐关系，自动选择更优的 8/4/2/1 字节粒度，并进行环路展开以提升吞吐。

> `FastCopy` 仅面向非重叠（non-overlapping）的拷贝语义。

## API

```cpp
namespace LibXR {
class Memory {
 public:
  /**
   * @brief 快速内存拷贝（非重叠语义）
   * @param dst  目标地址
   * @param src  源地址
   * @param size 拷贝字节数
   */
  void FastCopy(void* dst, const void* src, size_t size);

  /**
   * @brief 快速内存搬移（允许重叠）
   * @param dst  目标地址
   * @param src  源地址
   * @param size 搬移字节数
   */
  void FastMove(void* dst, const void* src, size_t size);

  /**
   * @brief 快速内存填充（类似 memset）
   * @param dst   目标地址
   * @param value 填充值（按字节重复）
   * @param size  填充字节数
   */
  void FastSet(void* dst, uint8_t value, size_t size);

  /**
   * @brief 快速内存比较（类似 memcmp）
   * @param a    地址 A
   * @param b    地址 B
   * @param size 比较字节数
   * @return 0 表示相等；非 0 表示不等，符号与差值语义与 memcmp 一致（首个不同字节的差）
   */
  int FastCmp(const void* a, const void* b, size_t size);
};
} // namespace LibXR
```

## FastCopy 语义说明

- 若 `dst` 与 `src` 具有相同的对齐相位（alignment offset），会先处理头部非对齐字节，然后进入按 `LibXR::ALIGN_SIZE`（通常为 8 或 4）为粒度的突发拷贝，并做 8 倍展开。
- 若两者对齐相位不同，会根据地址差尽可能选择更大的粒度：
  - 在 `LibXR::ALIGN_SIZE == 8` 且地址差为 4 的倍数时，可退化为 4 字节突发拷贝；
  - 地址差为偶数时，可退化为 2 字节突发拷贝；
  - 其它情况回退到按字节复制。
- 末尾不足一个“宽拷贝”粒度的部分会以字节方式补齐。

## FastMove 语义说明

- `FastMove()` 当前实现会先判断 `dst` 和 `src` 是否重叠：
  - 若不重叠，则直接退化为 `FastCopy()`；
  - 若重叠，则走安全的 move 路径。
- 它面向“可能重叠”的场景；如果你已经明确知道两段区域不会重叠，优先使用 `FastCopy()`。

## FastSet 语义说明

- `size == 0` 时直接返回。
- 先写入头部字节直到对齐，然后使用按 `LibXR::ALIGN_SIZE`（8 或 4）宽度的 pattern 批量写入，并做 8 倍展开，最后写入尾部字节。

## FastCmp 语义说明

- 返回值语义与 `memcmp(a, b, size)` 一致：返回 0 表示相等；非 0 表示不等。
- `size == 0` 或 `a == b` 时返回 0。
- 在对齐条件满足时会进入按 `LibXR::ALIGN_SIZE`（8 或 4）宽度的比较路径，并做 8 倍展开；一旦发现某个宽字不等，会回退到该宽字范围内的逐字节比较以获得与 `memcmp` 一致的返回值。
- 对齐条件不满足时会回退到逐字节比较。

## 使用示例

```cpp
#include "libxr_mem.hpp"

uint8_t src[256];
uint8_t dst[256];

// ... 填充 src ...

// 非重叠快速复制
LibXR::Memory::FastCopy(dst, src, sizeof(src));

// 允许重叠的安全搬移
LibXR::Memory::FastMove(dst + 8, dst, 64);

// 快速填充
LibXR::Memory::FastSet(dst, 0x00, sizeof(dst));

// 快速比较
int diff = LibXR::Memory::FastCmp(dst, src, sizeof(src));
if (diff == 0) {
  // equal
} else if (diff < 0) {
  // dst < src
} else {
  // dst > src
}
```
