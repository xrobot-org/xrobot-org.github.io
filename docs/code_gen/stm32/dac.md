---
id: stm32-code-gen-dac
title: DAC
sidebar_position: 6
---

# DAC

代码生成为 CubeMX 中开启的每个 DAC 输出通道生成一个 `STM32DAC` 对象，初始输出电压和参考电压取自 `libxr_config.yaml`。

## 示例

代码生成工具会读取每个DAC外设开启的通道，生成如下代码:

```cpp
static STM32DAC dac1_out2(&hdac1, DAC_CHANNEL_2, 0.0, 3.3);
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

## 生成规则

- 每个启用的输出通道生成一个对象，名字为 `<实例>_<通道>`，例如 `dac1_out2`；
- `DAC_OUTx` 写作 `DAC_CHANNEL_x`；
- 构造参数取自 `DAC.<实例>.init_voltage`（默认 0.0）和 `DAC.<实例>.vref`（默认 3.3）；
- 没有启用通道的 DAC 外设不生成对象。

修改该文件后运行 `libxr stm32 setup -d .` 重新生成代码。
