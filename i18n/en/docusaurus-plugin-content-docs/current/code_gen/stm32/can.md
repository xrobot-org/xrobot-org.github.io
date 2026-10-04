---
id: stm32-code-gen-can
title: CAN & CAN FD
sidebar_position: 10
---

# CAN & CAN FD

LibXR supports both classic CAN and CAN FD. Code generation emits a driver object for every CAN/FDCAN instance and sets its transmit queue length. The peripherals and their interrupts are configured in STM32CubeMX; filters, FIFO assignment and message RAM are handled by the HAL initialization code CubeMX generates and by the LibXR drivers.

## Example

The second constructor argument is the transmit queue size used to buffer outgoing CAN frames.

```cpp
static STM32CAN can1(&hcan1, 5);
static STM32CANFD fdcan1(&hfdcan1, 5);
```

## Configuration File

After code generation, the following configuration will appear in `User/libxr_config.yaml`:

```yaml
CAN:
  can1:
    queue_size: 5

FDCAN:
  fdcan1:
    queue_size: 5
```

- `queue_size`: size of the transmit queue used to buffer pending CAN/FDCAN frames.

Instances are keyed by their lower-case name. The upper-case keys of earlier versions (such as `CAN1` or `FDCAN1`) are renamed to lower case on regeneration, keeping their settings.

## Generation Rules

- objects are named after the lower-case instance, such as `can1` or `fdcan1`;
- the transmit queue length comes from `CAN.<instance>.queue_size` or `FDCAN.<instance>.queue_size` and defaults to 5;
- with XRobot integration (`--xrobot`), each FDCAN object also gets a `LibXR::CAN` reference, see [Integrate with XRobot](../xrobot_inter.md).

After editing the file, run `libxr stm32 setup -d .` to regenerate the code.
