---
id: stm32-code-gen-adc
title: ADC
sidebar_position: 5
---

# ADC

强烈建议在STM32CubeMX里面开启dma传输。轮询模式下同一ADC的不同通道无法被多线程同时调用，可能会导致数据错误。

## DMA模式配置要求

* 需要配置ADC的转换顺序（Rank），确保每个通道只有一个对应的Rank
* 开启连续转换模式与DMA连续转换请求
* DMA配置为循环模式

## 轮询模式配置要求

* 转换通道数量必须为1（即只能有一个Rank）
* 连续转换模式关闭

## 示例

代码生成工具会读取每个ADC外设开启的通道和连续转换模式下的通道顺序，生成如下代码:

```cpp
// 生成ADC对象
STM32ADC adcX(&hadcX, adcX_buf, {ADC_CHANNEL_1, ADC_CHANNEL_2, ...}, 3.3);

// 获取每个ADC通道对象
auto adcX_adc_channel_1 = adcX.GetChannel(0);
auto adcX_adc_channel_2 = adcX.GetChannel(1);
...
```

轮询模式下会识别所有开启的通道，DMA模式下只会识别配置了Rank的通道。

STM32ADC类并不是由ADC基类的派生，而是包含了多个由ADC基类派生的ADC通道对象。

## 配置文件

在上一步代码生成后，会在`User/libxr_config.yaml`文件中出现ADC配置文件，格式如下：

```yaml
ADC:
  adcX:
    buffer_size: 32 # 默认基础缓冲大小；实际生成的 uint16_t 缓冲区会按启用通道/Rank 数量展开
    dma_section: ''
    vref: 3.3
```

其中`buffer_size`为ADC基础缓冲大小，实际生成的 `uint16_t` 缓冲区会根据启用的通道/Rank 数量展开；`dma_section`为缓冲区所在的内存区域，`vref`为ADC参考电压，单位为V。

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`libxr stm32 setup -d .`  
或  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
