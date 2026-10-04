---
id: stm32-code-gen-i2c
title: I2C
sidebar_position: 9
---

# I2C

在 STM32CubeMX 中，I2C 设为 I2C 模式，需要启用对应的 DMA 通道，并配置相关中断。SMBus 模式的实例使用 SMBUS 句柄，不生成对象，`libxr parse` 给出警告。

## 示例

最后一个参数是 DMA 切换阈值，判断条件为传输长度**严格大于**该值。阈值为 `3` 时，3 字节不进入 DMA 分支，4 字节才满足条件。

```cpp
static STM32I2C i2c1(&hi2c1, i2c1_buf, 3);
```

## 配置文件

代码生成后，会在 `User/libxr_config.yaml` 文件中生成如下 I2C 配置：

```yaml
I2C:
  i2c1:
    buffer_size: 32
    dma_section: ''
    dma_enable_min_size: 3
```

- `buffer_size`：I2C 传输/接收缓冲区大小  
- `dma_section`：缓冲区所在的内存区域
- `dma_enable_min_size`：DMA 切换阈值；传输长度严格大于该值时才进入相应 DMA 分支

生成规则：

- 每个 I2C 实例生成一个收发共用的缓冲区，例如 `i2c1_buf`，长度为 `buffer_size` 字节；
- `dma_enable_min_size` 作为 `STM32I2C` 构造函数的最后一个参数；
- `dma_section` 决定缓冲区所在的 section，见 [Cache](./cache.md)；
- FMPI2C 外设不生成对象，`libxr parse` 给出警告；LibXR 没有 FMPI2C 驱动。

修改该文件后运行 `libxr stm32 setup -d .` 重新生成代码。
