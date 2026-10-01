---
id: stm32-code-gen-dac
title: DAC
sidebar_position: 6
---

# DAC

Code generation emits one `STM32DAC` object for each DAC output channel enabled in CubeMX, with the initial output voltage and the reference voltage taken from `libxr_config.yaml`.

## Example

The generator reads each enabled DAC channel and emits code like:

```cpp
static STM32DAC dac1_out2(&hdac1, DAC_CHANNEL_2, 0.0, 3.3);
```

## Configuration File

After the previous generation step, a DAC section appears in `User/libxr_config.yaml`:

```yaml
DAC:
  dac1:
    init_voltage: 0.0
    vref: 3.3
```

- `init_voltage`: initial output voltage
- `vref`: reference voltage

## Generation Rules

- each enabled output channel gets one object named `<instance>_<channel>`, such as `dac1_out2`;
- `DAC_OUTx` is written as `DAC_CHANNEL_x`;
- the constructor arguments come from `DAC.<instance>.init_voltage` (default 0.0) and `DAC.<instance>.vref` (default 3.3);
- a DAC peripheral without enabled channels gets no object.
