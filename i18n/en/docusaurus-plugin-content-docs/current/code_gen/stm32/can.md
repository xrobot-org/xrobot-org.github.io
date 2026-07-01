---
id: stm32-code-gen-can
title: CAN & CAN FD
sidebar_position: 10
---

# CAN & CAN FD

LibXR supports both classic CAN and CAN FD. From the generator's point of view, this page mainly covers **instance emission and queue-size configuration**. More detailed topics such as filters, FIFO layout, or message RAM partitioning still belong to the CubeMX project and the lower-level driver side; they should not be over-read as a unified strategy generated directly by the current generator.

You still need to configure the peripheral instances and interrupts correctly in STM32CubeMX first. If the target project depends on a specific filter setup or FIFO assignment, confirm that on the CubeMX / HAL side rather than assuming the generator will synthesize that policy for you.

## Example

The second constructor argument is the transmit queue size used to buffer outgoing CAN frames.

```cpp
STM32CAN can1(&hcan1, 5);
STM32CANFD fdcan1(&hfdcan1, 5);
```

## Configuration File

After code generation, the following configuration will appear in `User/libxr_config.yaml`:

```yaml
CAN:
  CAN1:
    queue_size: 5

FDCAN:
  FDCAN1:
    queue_size: 5
```

- `queue_size`: size of the transmit queue used to buffer pending CAN/FDCAN frames.

## Current Generator Scope

In current `GeneratorCodeSTM32.py`, the generation logic here mainly does two things:

- read `CAN.<instance>.queue_size` or `FDCAN.<instance>.queue_size` from the config;
- emit the corresponding `STM32CAN` / `STM32CANFD` constructor code.

You can edit the config file directly. To apply the changes, rerun:
`xr_cubemx_cfg -d .`
or
`xr_gen_code_stm32 -i ./.config.yaml -o ./User/app_main.cpp`
