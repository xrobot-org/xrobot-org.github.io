---
id: stm32-code-gen-i2c
title: I2C
sidebar_position: 9
---

# I2C

在 STM32CubeMX 中，需要启用 I2C 对应的 DMA 通道，并配置相关中断。

## 示例

最后一个参数表示启用 DMA 传输的最小字节数，低于该值将不启用 DMA。

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
- `dma_enable_min_size`：启用 DMA 的最小传输字节数

生成规则：

- 每个 I2C 实例生成一个收发共用的缓冲区，例如 `i2c1_buf`，长度为 `buffer_size` 字节；
- `dma_enable_min_size` 作为 `STM32I2C` 构造函数的最后一个参数；
- `dma_section` 决定缓冲区所在的 section，见 [Cache](./cache.md)；
- FMPI2C 外设不生成对象，`libxr parse` 给出警告；LibXR 没有 FMPI2C 驱动。

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`libxr stm32 setup -d .`  
或  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
