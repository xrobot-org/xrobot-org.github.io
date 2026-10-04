---
id: perf-can
title: CAN/CAN FD 性能测试
sidebar_position: 2
---

# CAN/CAN FD性能测试

## 测试环境

* STM32H750VB 480MHz
* FDCAN1 连接到 FDCAN2
* FDCAN1/FDCAN2 接收回调中直接转发
* 每秒统计回调中接收到的包数量
* 仲裁段配置为1Mbps，FD数据段配置为2.5Mbps

## 测试代码

```cpp
  STDIO::write_ = uart_cdc.write_port_;
  constexpr uint32_t PACK_ID = 0x123;
  constexpr CAN::Type PACK_TYPE = CAN::Type::STANDARD;
  constexpr uint32_t PACK_NUM = 8;

  static volatile uint32_t counter = 0, speed = 0;

  void (*can_func)(bool, LibXR::STM32CANFD *, const CAN::ClassicPack &) =
      [](bool, LibXR::STM32CANFD *can, const CAN::ClassicPack &pack)
  {
    can->AddMessage(pack);
    counter++;
  };

  auto cb_can1 = CAN::Callback::Create(can_func, &fdcan1);
  fdcan1.Register(cb_can1, PACK_TYPE);
  auto cb_can2 = CAN::Callback::Create(can_func, &fdcan2);
  fdcan2.Register(cb_can2, PACK_TYPE);

  LibXR::CAN::ClassicPack pack;
  pack.id = PACK_ID;
  pack.type = PACK_TYPE;
  pack.dlc = 8;

  for (uint32_t i = 0; i < PACK_NUM; i++)
  {
    fdcan1.AddMessage(pack);
  }

  while (true)
  {
    Thread::Sleep(1000);
    speed = counter;
    counter = 0;
    XR_LOG_DEBUG("speed: %u", speed);
  }
```

## 测试结果

总线负载按每帧位数加 3 位帧间隔计算，未计入位填充

### 标准帧 8字节数据

8917包/s，每包108位，数据段的速率[^1]为0.57Mbps，平均总线负载接近100%

无位填充时的理论上限为 `64 / (108 + 3) × 1 Mbps ≈ 0.577 Mbps`

### 扩展帧 8字节数据

7401包/s，每包128位，数据段的速率为0.47Mbps，平均总线负载接近100%

### 标准远程帧

20357包/s，每包44位，平均总线负载接近100%

### 扩展远程帧

14054包/s，每包64位，平均总线负载接近100%

### FD标准帧 64字节数据

3929包/s，数据段的速率[^1]为2.01Mbps，平均总线负载接近100%

### FD扩展帧 64字节数据

3617包/s，数据段的速率[^1]为1.85Mbps，平均总线负载接近100%

[^1]: 此处“数据段的速率”指有效载荷吞吐率，即 `包/s × 每包数据字节数 × 8`，不是 CAN FD 控制器中配置的物理数据段 bit rate；按本文测试条件说明，FD 数据段物理 bit rate 为 2.5Mbps。

## 总结

在 STM32H750（480 MHz）上，FDCAN1 与 FDCAN2 板级互连、接收回调中直接转发的条件下，经典帧与 FD 帧的总线负载均接近 100%。
