---
id: debug-swd
title: SWD Debug Interface
sidebar_position: 1
---

# SWD Debug Interface

These pages are organized into two layers:

- [SWD Base Class](./swd-base.md): describes the `LibXR::Debug::Swd` abstraction, transfer policy, and DP/AP helper APIs
- [SWD GPIO Implementation](./swd-gpio.md): describes the GPIO bit-bang `SwdGeneralGPIO` implementation, plus `loops_per_us` calibration and frequency selection

In current mainline, these two layers map directly to the real source layering:

- the `Swd` base class owns link control, the single-transfer `Transfer()` primitive, the WAIT-retry wrapper, and DP/AP helper APIs;
- `SwdGeneralGPIO` is one concrete backend that implements that abstraction over GPIO bit-banging.
