---
id: stm32-code-gen-can
title: CAN与CAN FD
sidebar_position: 10
---

# CAN 与 CAN FD

LibXR 支持标准 CAN 和 CAN FD。对代码生成器而言，这一页主要覆盖的是**实例生成与队列配置**；至于过滤器、FIFO 或消息 RAM 的更细节初始化，属于 CubeMX 工程本身和底层驱动侧的职责，不应被扩大理解成当前 generator 直接生成的一套统一策略。

在 STM32CubeMX 中，仍然需要先把对应外设与中断配置完整；如果目标工程依赖特定过滤器或 FIFO 分配，也应在 CubeMX / HAL 初始化侧确认，而不是假定 generator 会替你统一生成这一层策略。

## 示例

第二个参数表示发送队列大小，用于缓冲待发送的数据帧。

```cpp
STM32CAN can1(&hcan1, 5);
STM32CANFD fdcan1(&hfdcan1, 5);
```

## 配置文件

代码生成后，会在 `User/libxr_config.yaml` 中添加如下配置：

```yaml
CAN:
  CAN1:
    queue_size: 5

FDCAN:
  FDCAN1:
    queue_size: 5
```

- `queue_size`：发送队列的大小，用于缓存待发送的 CAN/FDCAN 数据帧。

## 当前 generator 覆盖范围

就当前 `GeneratorCodeSTM32.py` 而言，这一项生成逻辑主要做两件事：

- 从 `CAN.<instance>.queue_size` 或 `FDCAN.<instance>.queue_size` 读取配置；
- 生成 `STM32CAN` / `STM32CANFD` 的实例构造代码。

它只处理实例名和队列大小，不生成跨芯片一致的过滤器 / FIFO 拓扑。

可直接修改该配置文件。如需应用更改，请执行以下命令重新生成代码：  
`xr_cubemx_cfg -d .`  
或  
`xr_gen_code_stm32 -i ./.config.yaml -o ./User/app_main.cpp`
