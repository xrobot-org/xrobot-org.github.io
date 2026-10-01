---
id: stm32-code-gen-dac
title: DAC
sidebar_position: 6
---

# DAC

当前 generator 对 DAC 的职责主要是：根据 CubeMX 中开启的 DAC 通道，生成对应的 `STM32DAC` 实例，并把初始输出值与参考电压从 `libxr_config.yaml` 注入构造参数。

这一路径当前不涉及 DMA 配置生成，也不在代码生成阶段额外组织复杂的数据通路。

## 示例

代码生成工具会读取每个DAC外设开启的通道，生成如下代码:

```cpp
STM32DAC dac1_out1(&hdac1, DAC_CHANNEL_1, 0.0, 3.3);
```

## 配置文件

在上一步代码生成后，会在`User/libxr_config.yaml`文件中出现 DAC 配置，格式如下：

```yaml
DAC:
  dac1:
    init_voltage: 0.0
    vref: 3.3
```

其中`init_voltage`为初始输出电压，`vref`为参考电压。

## 当前 generator 覆盖范围

就当前 `GeneratorCodeSTM32.py` 而言，DAC 这一项主要做：

- 读取每个 DAC 外设启用的通道列表；
- 将 `DAC_OUTx` 规范化成 `DAC_CHANNEL_x`；
- 从 `DAC.<instance>.init_voltage` 与 `DAC.<instance>.vref` 读取配置；
- 生成形如 `STM32DAC dac1_out1(&hdac1, DAC_CHANNEL_1, 0.0, 3.3);` 的实例代码。

如果一个 DAC 外设没有启用任何通道，当前 generator 不会为它生成实例。

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`libxr stm32 setup -d .`  
或  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
