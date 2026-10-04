---
id: stm32-code-gen-adc
title: ADC
sidebar_position: 5
---

# ADC

ADC 建议在 STM32CubeMX 中开启 DMA 传输。轮询模式下，多个线程同时读取同一 ADC 的不同通道时可能得到错误的数据。

## DMA模式配置要求

* 需要配置ADC的转换顺序（Rank）
* 开启连续转换模式与DMA连续转换请求
* DMA配置为循环模式

## 轮询模式配置要求

* 转换通道数量必须为1（即只能有一个Rank）
* 连续转换模式关闭

## 示例

代码生成工具会读取每个ADC外设开启的通道和连续转换模式下的通道顺序，生成如下代码:

```cpp
// 生成ADC对象
static STM32ADC adc3(&hadc3, adc3_buf, {ADC_CHANNEL_8}, 3.3);
// 每个通道一个引用，名字为 <ADC 实例>_<通道>
static auto& adc3_adc_channel_8 = adc3.GetChannel(0);
UNUSED(adc3_adc_channel_8);
```

轮询模式下会识别所有开启的通道，DMA模式下只会识别配置了Rank的通道。DMA模式下通道引用按Rank排列，`GetChannel(i)` 对应第 i+1 个Rank；同一通道配置在多个Rank时，之后的引用名带上Rank后缀，例如 `adc3_adc_channel_8_rank12`。开启 XRobot 集成（`--xrobot`）时，每个通道引用以同名注册为 `LibXR::ADC`。

`STM32ADC` 包含多个通道对象，每个通道对象派生自 `LibXR::ADC`，由 `GetChannel(i)` 取得。

## 配置文件

在上一步代码生成后，会在`User/libxr_config.yaml`文件中出现ADC配置文件，格式如下：

```yaml
ADC:
  adcX:
    buffer_size: 32
    dma_section: ''
    vref: 3.3
```

其中`buffer_size`为每个通道的缓冲字节数，生成的 `uint16_t` 缓冲区有 `buffer_size / 2 × 通道数` 个元素（上例中 1 个通道，16 个元素）；`dma_section`为缓冲区所在的内存区域，`vref`为ADC参考电压，单位为V。

修改该文件后运行 `libxr stm32 setup -d .` 重新生成代码。
