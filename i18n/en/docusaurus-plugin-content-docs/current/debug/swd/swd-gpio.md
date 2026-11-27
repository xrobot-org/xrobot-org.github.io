---
id: swd-gpio
title: SWD GPIO Implementation
sidebar_position: 2
---

# SWD GPIO Implementation

`LibXR::Debug::SwdGeneralGPIO<SwclkGpioType, SwdioGpioType, IO_DRIVE_MODE, TimebaseType>` is a GPIO polling (bit-bang) SWD probe implementation. It derives from `LibXR::Debug::Swd` and provides SWD link-layer operations for upper layers such as CMSIS-DAP.

## 1. Wiring and Pin Requirements

`SwdGeneralGPIO` runs SWD over two GPIOs:

- SWCLK: driven by `SwclkGpioType` to output the clock;
- SWDIO: driven by `SwdioGpioType` for bidirectional data, switching at runtime between output drive and input sampling.

Recommended external circuitry:

- 33 Ω series resistors on SWCLK and SWDIO (ringing suppression);
- 10 kΩ pull-up resistor on SWDIO.

Class declaration:

```cpp
template <typename SwclkGpioType, typename SwdioGpioType,
          SwdIoDriveMode IO_DRIVE_MODE = SwdIoDriveMode::PUSH_PULL,
          typename TimebaseType = Timebase>
class SwdGeneralGPIO final : public Swd;
```

`TimebaseType` must derive from `LibXR::Timebase` and provide a static `BusyLoop()`; the default `Timebase` uses the generic loop, while a platform timebase may supply its own. `SwclkGpioType` and `SwdioGpioType` must support `SetConfig({Direction, Pull})`, `Write(bool)`, and `Read() -> bool`:

- Input sampling uses `Direction::INPUT` and `Pull::UP`;
- Output drive follows `IO_DRIVE_MODE`: `OUTPUT_PUSH_PULL` for `SwdIoDriveMode::PUSH_PULL`, or `OUTPUT_OPEN_DRAIN` for `SwdIoDriveMode::OPEN_DRAIN`.

Open-drain suits boards with an external pull-up; push-pull suits boards without one. On some MCUs, switching SWDIO to output takes several CPU cycles to propagate through a slower peripheral bus; for fast bit-banging, `GpioType::SetConfig` must account for that delay.

## 2. Construction and Usage

```cpp
explicit SwdGeneralGPIO(SwclkGpioType& swclk, SwdioGpioType& swdio, uint32_t cpu_hz,
                        const SwdGpioTiming& timing,
                        uint32_t default_hz = DEFAULT_CLOCK_HZ);
```

The constructor configures SWCLK as push-pull high, drives SWDIO high, and calls `SetClockHz(default_hz)` (500 kHz by default). Typical sequence:

1. Construct the probe with the CPU clock `cpu_hz` and a calibrated `SwdGpioTiming`.
2. Call `EnterSwd()` on the target.
3. Run transactions through the retry-capable `Swd` base methods (`DpReadTxn`, `ApReadTxn`, etc.).

```cpp
using Probe = LibXR::Debug::SwdGeneralGPIO<
    MyGpio, MyGpio, LibXR::Debug::SwdIoDriveMode::PUSH_PULL, MyTimebase>;

constexpr LibXR::Debug::SwdGpioTiming TIMING{16.9f, 9.0f, 11.4f};
MyGpio swclk, swdio;

Probe probe(swclk, swdio, /*cpu_hz=*/144'000'000, TIMING, /*default_hz=*/500'000);
probe.EnterSwd();

uint32_t idcode = 0;
LibXR::Debug::SwdProtocol::Ack ack;
probe.ReadIdCode(idcode, ack);
```

## 3. Clock Control and `SwdGpioTiming`

`SetClockHz(hz)` configures the requested SWCLK frequency:

- Non-zero `hz` is clamped to 50 kHz–100 MHz (`MIN_HZ`–`MAX_HZ`).
- When `hz == 0` or `cpu_hz == 0`, `half_period_loops_` is set to 0 and the probe takes the no-delay path, running as fast as platform GPIO toggling allows.

`SwdGpioTiming` models timing in CPU cycles, independent of the CPU clock frequency:

- Delayed path (`N >= 1` iterations of `TimebaseType::BusyLoop()` per half-period): `a + b·N` CPU cycles per SWCLK period;
- No-delay path (`N = 0`): `c` CPU cycles per SWCLK period.

```cpp
constexpr SwdGpioTiming();  // Conservative defaults: b = 2, a = 0, c = 1

template <std::floating_point Step, std::floating_point Intercept,
          std::floating_point Fast>
consteval SwdGpioTiming(Step step_cycles, Intercept intercept_cycles, Fast fast_cycles);
```

The constructor evaluates at compile time, quantizing cycle counts (0 to 100000 cycles, fractional allowed) to integer fixed point so runtime calculation uses integer arithmetic only. `DelayLoops(cpu_hz, hz)` selects `N` as follows:

- Returns `0` when `f >= f_cpu / c` (the no-delay path does not overshoot).
- Otherwise picks `N >= 1` whose cycles per period (`a + b·N`) are closest to `f_cpu / f`; on a tie, the slower step is chosen.

Because a `SwdGpioTiming` instance captures instruction timing of `BusyLoop()`, it is valid only for the `TimebaseType`, compiler, and optimization flags used during calibration. The default constructor (`b = 2, a = 0, c = 1`) is conservative and typically runs slower than requested on uncalibrated platforms.

## 4. Calibration Procedure

Calibrate under the same `TimebaseType`, compiler version, and optimization flags (`-O2`/`-Os`/`-O3`, LTO) as the target firmware:

1. Fix several delay counts (for example, `N = 0, 1, 2, 4, 8, 16`) and measure the SWCLK frequency with an oscilloscope or logic analyzer across the read data phase, write data phase, and request byte; convert each measurement with `cpu_hz` into CPU cycles per SWCLK period.
2. Fit `a + b·N` over the `N >= 1` points to obtain `step_cycles` (`b`) and `intercept_cycles` (`a`).
3. Take the typical `N = 0` cycle count across paths as `fast_cycles` (`c`).
4. Pass `constexpr SwdGpioTiming{step_cycles, intercept_cycles, fast_cycles}` to `SwdGeneralGPIO`.

## 5. Frequency Selection and Troubleshooting

Start bring-up at 100 kHz–500 kHz, then step up through 1 MHz, 2 MHz, and 4 MHz once the link is stable. Higher clocks require checking trace length, 33 Ω series resistors, SWDIO pull-up, and target pin drive strength.

If `WAIT`/`FAULT`/`NO_ACK` responses, parity errors, or cable-dependent failures occur:

1. Lower the `SetClockHz()` target first;
2. Verify the 33 Ω series resistors, 10 kΩ SWDIO pull-up, and ground return;
3. Inspect SWCLK/SWDIO edges on an oscilloscope for ringing and settling time;
4. Re-calibrate `SwdGpioTiming` if compiler options or `TimebaseType` changed.

## 6. Close and Safe State

Calling `Close()` invalidates the internal SELECT cache and places the probe pins in a safe state:

- SWCLK is driven high;
- SWDIO is switched to input with pull-up (no drive).
