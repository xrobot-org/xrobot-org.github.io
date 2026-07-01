---
id: stm32-code-gen-dac
title: DAC
sidebar_position: 6
---

# DAC

In current mainline, the generator’s DAC responsibility is straightforward: it reads the DAC channels enabled in CubeMX, generates matching `STM32DAC` instances, and injects the initial output value plus reference voltage from `libxr_config.yaml` into the constructor arguments.

This path currently does not generate DMA-related DAC setup.

## Example

The generator reads each enabled DAC channel and emits code like:

```cpp
STM32DAC dac1_out1(&hdac1, DAC_CHANNEL_1, 0.0, 3.3);
```

## Configuration File

After the previous generation step, a DAC section appears in `User/libxr_config.yaml`:

```yaml
DAC:
  dac1:
    init_voltage: 0.0
    vref: 3.3
```

- `init_voltage`: initial output voltage-like target
- `vref`: reference voltage used by the generated constructor arguments

## Current generator coverage

In current `GeneratorCodeSTM32.py`, the DAC generation path mainly does the following:

- read the enabled channel list for each DAC peripheral;
- normalize `DAC_OUTx` into `DAC_CHANNEL_x`;
- read `DAC.<instance>.init_voltage` and `DAC.<instance>.vref` from configuration;
- generate instance code such as `STM32DAC dac1_out1(&hdac1, DAC_CHANNEL_1, 0.0, 3.3);`.

If a DAC peripheral has no enabled channels, the current generator does not emit any DAC instance for it.
