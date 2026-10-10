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

  // Register the power command in the RamFS root
  void RegisterCommand(RamFS& ramfs);

  // Read the pin once and enter the bootloader when it reads level
  void CheckBootloaderPin(GPIO& pin, bool level);
};
```

## Usage Notes

- `Reset()` can be used to perform a soft reset, restart the system, etc.;
- `Shutdown()` is used for power-off, entering sleep, or other low-power control;
- `JumpToBootloader()` falls back to `Reset()` by default, and platform implementations may replace it with a real bootloader jump;
- `RegisterCommand(ramfs)` registers the `power` command in the RamFS root: in the terminal, `power reset`, `power shutdown` and `power bootloader` call the three methods above, while a missing or unknown argument prints the usage and returns -1. The command file is allocated on the first registration and is not freed afterwards, so one object is registered once;
- `CheckBootloaderPin(pin, level)` reads the pin once and calls `JumpToBootloader()` when it reads `level`, otherwise it returns; called once early during initialization, it enters the bootloader when the key on that pin is held through a reset, while the pin stays with the application at run time. The input direction and pull of the pin come from the project configuration and are left unchanged; a floating pin may trigger by accident;
- Can be applied in scenarios such as power button handling, remote commands, low battery strategies, etc.;
- The specific behavior is implemented by the platform, while the interface remains consistent to facilitate portability and abstraction.

## Platform Implementations

In the MSPM0 `MSPM0PowerManager`, `Reset()` triggers the boot configuration routine, resets most of the core logic and power-cycles the SRAM, so the device restarts from Flash like a fresh power-up; `Shutdown()` enters the SHUTDOWN mode, woken up by NRST, SWD activity or a wake-up capable IO, and leaving SHUTDOWN triggers a BOR, so waking up is equivalent to a reset; `JumpToBootloader()` resets into the ROM BSL and, following the SDK example, clears the SRAM data and ECC codes before the reset to work around `BSL_ERR_01`. The MSPM0 ROM BSL runs over the serial port, so firmware can be flashed over that port after `power bootloader`.

In the HPM `HPMPowerManager`, `Reset()` enables the PPOR software reset source and then issues the reset; `Shutdown()` sets the turn-off counter and waits for the power down on SoCs with a PDGO, woken up by the RESETN or WAKEUP pin, and falls back to disabling interrupts and executing WFI on SoCs without one; `JumpToBootloader()` disables the interrupts and calls the ROM API to enter the ROM ISP, with the peripheral auto-detected by the ROM; the call does not return normally, and a return resets the device. The ROM ISP over USB did not enumerate on the HPM5301 and HPM5361.

## Notes

- `PowerManager` exposes three platform calls, `Reset()`, `Shutdown()` and `JumpToBootloader()`, and two general calls implemented by the base class, `RegisterCommand()` and `CheckBootloaderPin()`.
- State queries, event callbacks, and low-power levels are left to concrete platform implementations or upper-layer code.
