---
id: stm32-code-gen-adc
title: ADC
sidebar_position: 5
---

# ADC

It is strongly recommended to enable DMA transfers in STM32CubeMX. In polling mode, different channels of the same ADC cannot be called by multiple threads simultaneously, which may lead to incorrect data.

## DMA Mode Configuration Requirements

* Configure the ADC conversion sequence (Rank), ensuring each channel has exactly one corresponding Rank.
* Enable Continuous Conversion Mode and DMA Continuous Requests.
* Set DMA to Circular mode.

## Polling Mode Configuration Requirements

* The number of conversion channels must be 1 (i.e., only one Rank).
* Disable Continuous Conversion Mode.

## Example

The code generator will read the enabled channels for each ADC peripheral and their order in continuous conversion mode to generate the following code:

```cpp
// Create the ADC object
STM32ADC adcX(&hadcX, adcX_buf, {ADC_CHANNEL_1, ADC_CHANNEL_2, ...}, 3.3);

// Retrieve each ADC channel object
auto adcX_adc_channel_1 = adcX.GetChannel(0);
auto adcX_adc_channel_2 = adcX.GetChannel(1);
...
```

In polling mode, all enabled channels are recognized; in DMA mode, only channels with a configured Rank are recognized.

`STM32ADC` is not derived from the ADC base class. Instead, it contains multiple ADC channel objects that are derived from the base ADC class.

## Configuration File

After the code is generated, an ADC configuration section will appear in the `User/libxr_config.yaml` file, formatted as follows:

```yaml
ADC:
  adcX:
    buffer_size: 32 # Default per-channel buffer size; generated uint16_t storage scales with active channel/Rank count
    dma_section: ''
    vref: 3.3
```

- `buffer_size`: Base ADC buffer size. The generated `uint16_t` storage is expanded according to the number of active DMA channels/Ranks.
- `dma_section`: The memory section where the DMA buffer is located.
- `vref`: The reference voltage for the ADC, in volts.

You can modify this file directly. To apply the updated configuration, run either of the following commands to regenerate the code:  
`libxr stm32 setup -d .`  
or  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
