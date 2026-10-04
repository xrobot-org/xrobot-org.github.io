---
id: pwm
title: PWM
sidebar_position: 8
---

# PWM (Pulse-Width Modulation)

`LibXR::PWM` provides a platform-independent interface for PWM signal control, used for adjusting the duty cycle of peripherals such as LEDs, motors, etc.

## Interface Definition

```cpp
class PWM {
public:
  struct Configuration {
    uint32_t frequency;  // PWM frequency (Hz)
  };

  // Set the duty cycle, range: 0.0 ~ 1.0
  virtual ErrorCode SetDutyCycle(float value) = 0;

  // Set PWM parameters (e.g., frequency)
  virtual ErrorCode SetConfig(Configuration config) = 0;

  // Enable PWM output
  virtual ErrorCode Enable() = 0;

  // Disable PWM output
  virtual ErrorCode Disable() = 0;
};
```

## Feature Summary

- Abstracts duty cycle adjustment and frequency configuration;  
- Unified interface suitable for controlling LEDs, motors, buzzers, etc.;  
- Provides enable and disable methods for state control and power management;  
- Platform-specific logic handles signal output, while upper layers use a consistent interface.

## Notes

- `SetDutyCycle(float value)` currently documents the common `0.0 ~ 1.0` duty-cycle expression only at the interface-comment level; if a specific backend clamps, quantizes, or rejects out-of-range values, that behavior remains backend-specific.
- `Configuration` currently contains only `frequency`; duty cycle is not configured through `SetConfig()`, but through the separate `SetDutyCycle()` path.
