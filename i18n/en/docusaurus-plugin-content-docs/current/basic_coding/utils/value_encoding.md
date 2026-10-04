---
id: value-encoding
title: Cyclic Angles and Value Encoding
sidebar_position: 7
---

# Cyclic Angles and Value Encoding

`cycle_value.hpp` and `float_encoder.hpp` provide two independent numeric utilities: cyclic-angle handling and bounded-range quantization.

## CycleValue

```cpp
#include "cycle_value.hpp"

LibXR::CycleValue<float> heading(-0.2f);
heading += 0.5f;

float normalized = heading.Value();
float error = heading - 0.1f;
```

The stored value stays in `[0, 2π)`. `CycleValue - value` returns the shortest signed angular difference in `[-π, π)`, which is useful for cyclic control errors.

Assignment, `+=` and `-=` renormalize the value. `Calculate(value)` exposes the normalization operation directly.

## FloatEncoder

`FloatEncoder<Bits, Scalar>` maps `[min, max]` linearly onto `[0, 2^Bits-1]`:

```cpp
#include "float_encoder.hpp"

LibXR::FloatEncoder<12> encoder(-10.0f, 10.0f);
uint32_t code = encoder.Encode(2.5f);
float value = encoder.Decode(code);
```

`Bits` ranges from 1 to 31. `Encode()` clamps to `[min, max]`, scales, then rounds. Quantization step is:

```text
(max - min) / (2^Bits - 1)
```

`Decode()` converts the integer code directly back to the floating-point interval. Protocol input should be range-checked to `0..MaxInt()` before decoding.

These classes handle values only. Bit packing and byte order belong to the surrounding protocol.
