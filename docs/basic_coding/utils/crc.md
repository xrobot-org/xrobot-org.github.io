---
id: crc
title: CRC 校验
sidebar_position: 8
---

# CRC 校验

`crc.hpp` 提供 `CRC8`、`CRC16`、`CRC32` 和 `CRC64`。四个类都提供 `Calculate(data, size)`；CRC8/16/32 还提供带尾部校验值的 `Verify()`。

## 基本使用

```cpp
#include "crc.hpp"

uint8_t packet[5]{1, 2, 3, 4, 0};
LibXR::CRC8::GenerateTable();
packet[4] = LibXR::CRC8::Calculate(packet, 4);

bool valid = LibXR::CRC8::Verify(packet, sizeof(packet));
```

查找表也可以在首次计算时生成。多个上下文可能同时首次使用同一 CRC 类时，初始化阶段先调用 `GenerateTable()`。

## 参数

| 类 | 初值 | 反射形式多项式 |
| --- | --- | --- |
| CRC8 | `0xFF` | `0x8C` |
| CRC16 | `0xFFFF` | `0x8408` |
| CRC32 | `0xFFFFFFFF` | `0xEDB88320` |
| CRC64 | `0xFFFFFFFFFFFFFFFF` | `0xC96C5795D7870F42` |

计算过程返回当前累积值，没有额外 final XOR。与外部协议对接时，同时核对多项式、初值、反射、final XOR 和校验值字节序。

## Verify

`Verify(raw, len)` 的 `len` 包含尾部 CRC：

- CRC8 至少需要 2 字节；
- CRC16 至少需要 2 字节；
- CRC32 调用前至少提供 4 字节。

CRC16/32 使用本机整数表示读取尾部校验值。跨平台协议通常显式定义校验值字节序，再用 `Calculate()` 与解码后的整数比较。

CRC64 当前只提供 `Calculate()`。
