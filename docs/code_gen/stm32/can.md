---
id: stm32-code-gen-can
title: CAN与CAN FD
sidebar_position: 10
---

# CAN 与 CAN FD

LibXR 支持标准 CAN 和 CAN FD。代码生成为每个 CAN/FDCAN 实例生成驱动对象，并设置发送队列长度。外设和中断在 STM32CubeMX 中配置；过滤器、FIFO 分配和消息 RAM 由 CubeMX 生成的 HAL 初始化代码和 LibXR 驱动处理。

## 示例

第二个参数表示发送队列大小，用于缓冲待发送的数据帧。

```cpp
static STM32CAN can1(&hcan1, 5);
static STM32CANFD fdcan1(&hfdcan1, 5);
```

## 配置文件

代码生成后，会在 `User/libxr_config.yaml` 中添加如下配置：

```yaml
CAN:
  can1:
    queue_size: 5

FDCAN:
  fdcan1:
    queue_size: 5
```

- `queue_size`：发送队列的大小，用于缓存待发送的 CAN/FDCAN 数据帧。

实例的键是小写的实例名。以前版本生成的大写键（如 `CAN1`、`FDCAN1`）在重新生成时改为小写，设置保持不变。

## 生成规则

- 对象名为小写的实例名，例如 `can1`、`fdcan1`；
- 从 `CAN.<实例>.queue_size` 或 `FDCAN.<实例>.queue_size` 读取发送队列长度，默认 5；
- 开启 XRobot 集成（`--xrobot`）时，FDCAN 对象另有一个 `LibXR::CAN` 引用，见[与XRobot集成](../xrobot_inter.md)。

修改该文件后重新生成代码，命令见[重新生成代码](./README.md#重新生成代码)。
