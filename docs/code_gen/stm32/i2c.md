---
id: stm32-code-gen-i2c
title: I2C
sidebar_position: 9
---

# I2C

在 STM32CubeMX 中，需要启用 I2C 对应的 DMA 通道，并配置相关中断。

对当前 generator 而言，这一页主要覆盖的是**共享缓冲区大小**与**DMA 启用阈值**这两个生成参数。

## 示例

最后一个参数是 DMA 切换阈值，判断条件为传输长度**严格大于**该值。阈值为 `3` 时，3 字节不进入 DMA 分支，4 字节才满足条件。

```cpp
STM32I2C i2c1(&hi2c1, i2c1_buf, 3);
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

当前生成逻辑要点：

- generator 会为每个 I2C 实例生成一个共享 buffer，例如 `i2c1_buf`；
- `dma_enable_min_size` 当前会直接作为 `STM32I2C(..., dma_enable_min_size)` 的最后一个参数生成；
- 页中的 `dma_section` 只影响缓冲区声明落在哪个 section，不改变 `STM32I2C` 构造形状本身。

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`xr_cubemx_cfg -d .`  
或  
`xr_gen_code_stm32 -i ./.config.yaml -o ./User/app_main.cpp`
