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
static STM32ADC adc3(&hadc3, adc3_buf, {ADC_CHANNEL_8}, 3.3);
// One reference per channel, named <ADC instance>_<channel>
static auto& adc3_adc_channel_8 = adc3.GetChannel(0);
UNUSED(adc3_adc_channel_8);
```

In polling mode, all enabled channels are recognized; in DMA mode, only channels with a configured Rank are recognized. With XRobot integration (`--xrobot`), each channel reference is registered under the same name as `LibXR::ADC`.

`STM32ADC` is not derived from the ADC base class. Instead, it contains multiple ADC channel objects that are derived from the base ADC class.

## Configuration File

After the code is generated, an ADC configuration section will appear in the `User/libxr_config.yaml` file, formatted as follows:

```yaml
ADC:
  adcX:
    buffer_size: 32
    dma_section: ''
    vref: 3.3
```

- `buffer_size`: Buffer bytes per channel. The generated `uint16_t` buffer holds `buffer_size / 2 × channel count` elements (16 for the single channel above).
- `dma_section`: The memory section where the DMA buffer is located.
- `vref`: The reference voltage for the ADC, in volts.

The file can be edited directly. To apply the updated configuration, regenerate the code with either of the following commands:  
`libxr stm32 setup -d .`  
or  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
