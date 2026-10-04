---
id: swd-gpio
title: SWD GPIO Implementation
sidebar_position: 2
---

# SWD GPIO Implementation

`LibXR::Debug::SwdGeneralGPIO<SwclkGpioType, SwdioGpioType, SwdIoDriveMode>` is a GPIO polling (bit-bang) SWD probe implementation. It inherits from `LibXR::Debug::Swd`, provides SWD link-layer capability, and is typically used by upper layers such as a CMSIS-DAP processor or debugger.

The focus here is on practical usage and on choosing/calibrating the delay parameter `loops_per_us`, not on implementation details.

---

## 1. Overview

`SwdGeneralGPIO` implements SWD using two GPIOs:

- SWCLK: driven by `SwclkGpioType` to output the clock.
- SWDIO: provided by `SwdioGpioType` for bidirectional data, switching at runtime between “output drive” and “input sampling”.

Timing is generated in software: it computes the number of busy-loop iterations for each half-period from the target clock `hz` and the delay calibration factor `loops_per_us`, approximating the requested SWCLK.

Recommended external circuitry:
- 33Ω series resistors on SWCLK/SWDIO (current limiting / ringing suppression)
- 10k pull-up on SWDIO

---

## 2. Template Parameters and Required GPIO Capabilities

Class definition:

```cpp
template <typename SwclkGpioType, typename SwdioGpioType,
          SwdIoDriveMode IO_DRIVE_MODE = SwdIoDriveMode::PUSH_PULL>
class SwdGeneralGPIO final : public Swd;
```

Minimum expected capabilities from the GPIO types (abstractly):
- `SetConfig({Direction, Pull}) -> ErrorCode`
- `Write(bool)`
- `Read() -> bool`

SWDIO must support:
- Input sampling: `Direction::INPUT` + `Pull::UP`
- Output drive selected by `IO_DRIVE_MODE`
  - `SwdIoDriveMode::PUSH_PULL` -> `OUTPUT_PUSH_PULL`
  - `SwdIoDriveMode::OPEN_DRAIN` -> `OUTPUT_OPEN_DRAIN`

When choosing the output mode, open-drain suits boards with an external pull-up on SWDIO, and push-pull suits boards without one. The actual electrical behavior of SWDIO/SWCLK also depends on GPIO drive strength, trace length, damping resistors, probe load, and the target's input structure.

---

## 3. Quick Start

Constructor:

```cpp
explicit SwdGeneralGPIO(SwclkGpioType& swclk,
                        SwdioGpioType& swdio,
                        uint32_t loops_per_us,
                        uint32_t default_hz = DEFAULT_CLOCK_HZ);
```

Typical usage flow:
1) Create GPIO objects and the probe instance (start with a “conservative” frequency and a calibrated `loops_per_us`).
2) Call `EnterSwd()` (recommended when the target's current debug mode is unknown).
3) Use the `Swd` base class “retry-enabled” APIs in upper layers (to handle WAIT, insert idle clocks, etc.).

Example:

```cpp
using Probe = LibXR::Debug::SwdGeneralGPIO<
    MyGpio, MyGpio, LibXR::Debug::SwdIoDriveMode::PUSH_PULL>;

MyGpio swclk, swdio;

// Calibrate loops_per_us first; start default_hz conservatively (e.g., 100k~500k)
Probe probe(swclk, swdio, /*loops_per_us=*/calibrated, /*default_hz=*/500000);

probe.EnterSwd();

// Read DP IDCODE (ReadIdCode does not retry; retrying transactions such as DpReadTxn are in the Swd base class)
uint32_t idcode = 0;
LibXR::Debug::SwdProtocol::Ack ack;
probe.ReadIdCode(idcode, ack);
```

---

## 4. Clock and Delay Parameter (Key)

### 4.1 Meaning and Behavior of `hz`

`SetClockHz(hz)` sets the **target SWCLK frequency**.

- A nonzero `hz` is clamped to 50 kHz–100 MHz (`MIN_HZ`/`MAX_HZ`); the constructor default is 500 kHz (`DEFAULT_CLOCK_HZ`).
- Whether the actual frequency matches the configured value depends on `loops_per_us`, GPIO toggle speed, CPU load, etc.
- `hz == 0` forces the internal “no-delay path” (no BusyLoop delay is inserted). In this mode, the SWCLK frequency is determined by CPU and GPIO toggle speed and is typically “as fast as possible”.

### 4.2 What `loops_per_us` Means

`loops_per_us` is a **delay calibration factor**: the approximate number of BusyLoop iterations required per 1 microsecond.

It is not a universal constant and typically varies significantly with:
- CPU clock frequency
- Compiler optimization level (`-O0/-O2/-Os`, etc.)
- LTO and compiler version
- Instruction/bus wait states (on some MCUs, power/clock domains may also affect it)

`loops_per_us` is re-calibrated whenever any of the above changes.

### 4.3 When the “No-Delay Path” Is Used

In practice, the implementation enters the “no-delay path” in two cases:
- You explicitly set `loops_per_us = 0`; or
- At a high enough `hz`, the computed half-period delay is < 1 loop, so the internal half-period loop count becomes 0 and the implementation automatically switches to the no-delay path.

Implications of the no-delay path:
- Pros: lower overhead and higher throughput.
- Cons: SWCLK is no longer precisely controlled by `hz`; it becomes “as fast (and as stable) as the platform allows”.

Engineering guidance:
- For a controllable and reproducible SWCLK, keep the computed `half_period_loops_` above 0 (calibrate `loops_per_us` and avoid an overly high `hz`).
- When only maximum speed matters, set `loops_per_us = 0`, or set `hz` high enough that the implementation falls into the no-delay path.

---

## 5. Choosing and Calibrating `loops_per_us`

Two common calibration methods are provided below. The key principle: calibrate with the same compiler options and CPU frequency as the final firmware.

### Method A: Calibrate with a Hardware Timer / Cycle Counter

Idea: run a BusyLoop with a known iteration count and measure elapsed time, then infer `loops_per_us`.

Steps:
1) Choose a sufficiently large iteration count N (e.g., around 1e6) so measurement time is well above timer resolution.
2) Record start time t0, run BusyLoop(N), record end time t1.
3) Compute elapsed time `dt_us` in microseconds.
4) `loops_per_us ≈ N / dt_us` (integer rounding is fine).

Pros: independent of SWD/target state; after calibration, frequency control is predictable.

### Method B: Fit by Measuring SWCLK with a Logic Analyzer / Oscilloscope

Idea: start with a rough `loops_per_us`, set a low-to-mid `hz` (e.g., 100 kHz or 500 kHz), measure SWCLK frequency, and adjust `loops_per_us` until it matches.

Steps:
1) Start with a configuration that **ensures the delayed path is used** (i.e., choose a lower `hz`).
2) Measure SWCLK frequency `f_meas`.
3) Adjust proportionally: `loops_per_us_new ≈ loops_per_us_old * (f_meas / f_target)`, iterate 1–2 times to converge.

Pros: no need to use timer resources; GPIO toggle overhead is included in the fit.  
In the no-delay path (very high frequency) this method does not apply, because adjusting `loops_per_us` may not return to the delayed path.

---

## 6. Practical Frequency Selection

Increase frequency gradually from conservative to aggressive, rather than starting at the limit:

- Initial bring-up: 100 kHz ~ 500 kHz (easier to debug wiring and signal integrity)
- After stable: try 1 MHz, 2 MHz, 4 MHz in steps
- For higher speeds: first confirm trace length, series damping, ground reference, and target pin drive capability; then increase frequency

If you see the following symptoms, it usually indicates frequency is too high or signal integrity is insufficient:
- ACK frequently becomes WAIT/FAULT/NO_ACK
- Parity failures on read data
- Instability only on certain cable lengths / certain boards

Recommended mitigation order:
1) Lower frequency first;
2) Verify 33Ω series resistors and SWDIO pull-up;
3) Shorten the cable / improve grounding;
4) Re-calibrate `loops_per_us` (especially after changing compiler optimization options).

At higher SWCLK frequencies, edge rate, ringing, overshoot/undershoot, and settling time affect ACK and sampling stability. When a link works at low frequency but fails randomly at high frequency, the SWCLK/SWDIO edges are checked with an oscilloscope.

---

## 7. Close and Safe State

Calling `Close()` returns the probe pins to a safer state (useful when exiting debug or switching pin muxing):
- SWCLK driven high
- SWDIO switched to input with pull-up
