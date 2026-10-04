---
id: power
title: Power Management
sidebar_position: 10
---

# Power (Power Management)

`LibXR::PowerManager` provides a unified interface for power management, suitable for implementing system reset, shutdown, or entering low-power modes. It is intended for implementation by platform or power control drivers.

## Interface Definition

```cpp
class PowerManager {
public:
  PowerManager() = default;
  virtual ~PowerManager() = default;

  // System reset operation (to be implemented by subclass)
  virtual void Reset() = 0;

  // System shutdown operation (to be implemented by subclass)
  virtual void Shutdown() = 0;

  // Jump to bootloader (falls back to Reset by default)
  virtual void JumpToBootloader() { Reset(); }
};
```

## Usage Notes

- `Reset()` can be used to perform a soft reset, restart the system, etc.;  
- `Shutdown()` is used for power-off, entering sleep, or other low-power control;  
- `JumpToBootloader()` falls back to `Reset()` by default, and platform implementations may replace it with a real bootloader jump;
- Can be applied in scenarios such as power button handling, remote commands, low battery strategies, etc.;  
- The specific behavior is implemented by the platform, while the interface remains consistent to facilitate portability and abstraction.

## Notes

- `PowerManager` has three calls: `Reset()`, `Shutdown()`, and `JumpToBootloader()`, which calls `Reset()` by default.
- State queries, event callbacks, and low-power levels are left to concrete platform implementations or upper-layer code.
