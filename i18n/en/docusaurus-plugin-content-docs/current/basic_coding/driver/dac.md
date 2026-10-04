---
id: dac
title: Digital-to-Analog Conversion
sidebar_position: 7
---

# DAC (Digital-to-Analog Conversion)

`LibXR::DAC` provides a platform-independent abstract interface for digital-to-analog conversion (DAC), used to output an analog quantity represented by a floating-point value.

## Interface Definition

```cpp
class DAC {
public:
  DAC() = default;

  // Outputs the DAC floating-point value
  virtual ErrorCode Write(float voltage) = 0;
};
```

- `Write(voltage)` is a pure virtual function, and must be implemented by derived classes;
- `voltage` is in volts; the existing backends (STM32, ESP32) clamp it to `[0, reference voltage]` before output;
- Returns `ErrorCode`, indicating success or failure of the operation;

## Example Usage

```cpp
// Example: output 1.23 V
dac->Write(1.23f);
```
