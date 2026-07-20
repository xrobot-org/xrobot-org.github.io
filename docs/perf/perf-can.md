---
id: perf-can
title: CAN性能测试
sidebar_position: 2
---

# CAN/CAN FD性能测试

> 本页记录的是一个特定板级环回测试样例，不应被理解成 LibXR 当前主线对所有 MCU、所有收发路径或所有总线负载形态的通用性能承诺。

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
    XR_LOG_DEBUG("speed: %d", speed);
  }
```

## 测试结果

负载按5%位填充计算

### 标准帧 8字节数据

8917包/s，每包108位，数据段的速率[^1]为0.57Mbps，平均总线负载接近100%

理想情况下，数据段的速率位`64 / 108 * 1Mbps / 105% = 0.564Mbps`

### 拓展帧 8字节数据

7401包/s，每包128位，数据段的速率为0.47Mbps，平均总线负载接近100%

### 标准远程帧

20357包/s，每包44位，平均总线负载接近100%

### 拓展远程帧

14054包/s，每包64位，平均总线负载接近100%

### FD标准帧 64字节数据

3929包/s，数据段的速率[^1]为2.01Mbps，平均总线负载接近100%

### FD拓展帧 64字节数据

3617包/s，数据段的速率[^1]为1.85Mbps，平均总线负载接近100%

[^1]: 此处“数据段的速率”指有效载荷吞吐率，即 `包/s × 每包数据字节数 × 8`，不是 CAN FD 控制器中配置的物理数据段 bit rate；按本文测试条件说明，FD 数据段物理 bit rate 为 2.5Mbps。

## 总结

本次测试表明，在 **STM32H750（480MHz）+ FDCAN1/FDCAN2 板级回环 + 当前测试代码形状** 这个特定场景下，LibXR 当前主线的 FDCAN 驱动可以达到接近理论极限的收发速率。

阅读边界：

- 这里的结果直接依赖测试平台、HAL/FDCAN 配置、回调里“收到即转发”的代码形状以及主频；
- 它不能直接外推到其它 MCU、其它 FIFO/过滤器配置、实际业务负载或多任务竞争场景；
- 如果需要针对你自己的平台做性能判断，应以本页的测试代码和条件为参考，在目标板上复测。
