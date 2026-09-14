---
id: value-encoding
title: 周期角度与数值编码
sidebar_position: 7
---

# 周期角度与数值编码

`cycle_value.hpp` 与 `float_encoder.hpp` 提供两个独立的数值工具：周期角度处理和有限区间量化。

## CycleValue

```cpp
#include "cycle_value.hpp"

LibXR::CycleValue<float> heading(-0.2f);
heading += 0.5f;

float normalized = heading.Value();
float error = heading - 0.1f;
```

内部值保持在 `[0, 2π)`。`CycleValue - value` 返回 `[-π, π)` 范围内的最短有符号角差，适合周期角度误差计算。

赋值、`+=` 和 `-=` 会重新归一化；`Calculate(value)` 可直接计算归一化结果。

## FloatEncoder

`FloatEncoder<Bits, Scalar>` 将 `[min, max]` 线性映射到 `[0, 2^Bits-1]`：

```cpp
#include "float_encoder.hpp"

LibXR::FloatEncoder<12> encoder(-10.0f, 10.0f);
uint32_t code = encoder.Encode(2.5f);
float value = encoder.Decode(code);
```

`Bits` 范围为 1–31。`Encode()` 会先把输入限制到 `[min, max]`，再缩放和四舍五入。量化步长为：

```text
(max - min) / (2^Bits - 1)
```

`Decode()` 按整数码直接反算浮点值；协议接收端应先保证整数码在 `0..MaxInt()` 范围内。

这两个类只处理数值本身，通信中的位打包和字节序由上层协议决定。
