---
id: env-setup-hpm
title: HPM 环境配置
sidebar_position: 5
---

# HPM 环境配置

本页说明 LibXR 在 HPM 平台上的接入方式。

可以从模板工程开始：

- [HPM5301_LibXR_Template](https://github.com/xrobot-org/HPM5301_LibXR_Template)

## 工具链

HPM 工程使用 RISC-V GCC 工具链，编译器前缀为 `riscv32-unknown-elf-`。HPM SDK 从环境变量 `GNURISCV_TOOLCHAIN_PATH` 读取工具链的安装目录（`bin` 的上一级目录），编译器为其中的 `bin/riscv32-unknown-elf-gcc`；没有设置这个变量时，CMake 配置报错 `GNURISCV_TOOLCHAIN_PATH is not set yet`。

工具链的来源：

- Windows：HPMicro 的开发环境包 [sdk_env](https://github.com/hpmicro/sdk_env)，工具链放在其中的 `toolchains/` 目录，由 `start_cmd.cmd` 打开的命令行设置 `GNURISCV_TOOLCHAIN_PATH` 等环境变量；
- Linux x64：[hpm-linux-gcc-release v0.1.0](https://github.com/Jiu-xiao/hpm-linux-gcc-release/releases/tag/v0.1.0) 发布的 `riscv32-unknown-elf` 工具链；
- Docker：`ghcr.io/xrobot-org/docker-image-hpm:main` 在 `/opt/hpm-riscv32-unknown-elf` 中装有上述 Linux 工具链（GCC 15.2.0），路径记录在环境变量 `XR_HPM_TOOLCHAIN_ROOT` 中，见 [Docker 环境配置](docker.md)。

镜像没有设置 `GNURISCV_TOOLCHAIN_PATH`，在镜像中构建前先由 `XR_HPM_TOOLCHAIN_ROOT` 设置它，模板工程的 CI 也是这样做的：

```bash
export GNURISCV_TOOLCHAIN_PATH="$XR_HPM_TOOLCHAIN_ROOT"
cmake --preset release-flash-xip
cmake --build --preset release-flash-xip
```

## 当前主线里已经有什么

按 `libxr master` 当前 `driver/hpm` 目录，已经存在这些驱动实现：

- `hpm_gpio.*`
- `hpm_i2c.*`
- `hpm_pwm.*`
- `hpm_timebase.*`

它们通过 `driver/hpm/CMakeLists.txt` 统一加入构建。

## 基本集成思路

以下节选自 [HPM5301_LibXR_Template](https://github.com/xrobot-org/HPM5301_LibXR_Template) 的 `cmake/LibXR.CMake`：

```cmake
# LibXR platform/driver selection
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER hpm)
set(LIBXR_NO_EIGEN True)

# ...

# Import LibXR as a subproject
add_subdirectory("${LIBXR_DIR}" "${CMAKE_CURRENT_BINARY_DIR}/libxr")

# Make LibXR compile with the same HPM SDK compile options/includes.
if(DEFINED HPM_SDK_LIB_ITF AND TARGET ${HPM_SDK_LIB_ITF})
    target_link_libraries(xr PUBLIC ${HPM_SDK_LIB_ITF})
endif()

# Let app sources directly include LibXR headers.
if(TARGET app)
    target_link_libraries(app PUBLIC xr)
endif()

# Ensure LibXR object files are linked into the final ELF target.
if(DEFINED APP_ELF_NAME AND TARGET ${APP_ELF_NAME})
    target_link_libraries(${APP_ELF_NAME} xr)
endif()
```

`xr` 链接 `${HPM_SDK_LIB_ITF}`，LibXR 因此与应用使用相同的 HPM SDK 编译选项和头文件路径。

这里的前提是：

- 工程已经能用 HPM SDK 正常编译；
- 工程已经把 HPM SDK 的头文件、启动文件、链接脚本和板级初始化接好；
- LibXR 只是在这个基础上接入 `driver/hpm` 与通用 runtime/middleware。

## 当前文档建议的实际入口

HPM 工程按以下顺序接入：

1. 先用 HPM SDK 或模板工程把最小工程跑通。
2. 再检查工程里是否已经能正常 `add_subdirectory(libxr)`。
3. 最后再按需要接入具体外设类，例如 `HPMGPIO`、`HPMI2C`、`HPMPWM`、`HPMTimebase`。

外设的引脚复用和时钟由工程在创建 LibXR 对象之前配置，例如调用 HPM Pinmux Tool 生成的引脚函数和时钟函数；LibXR 的 HPM 驱动只调用 SDK 驱动，不调用 `board.c` 中的板级函数：

```cpp
static LibXR::HPMI2C i2c3(HPM_I2C3, clock_i2c3, {100000});
static LibXR::HPMPWM pwm(HPM_PWM0, clock_mot0, 0, 0, LibXR::HPMPWM::Polarity::NORMAL);
```

## 当前 I2C 支持情况

`HPMI2C` 已不是简单的 blocking-only 包装，当前主线还覆盖了：

- 7-bit / 10-bit 主机寻址模式；
- sequence frame；
- transfer flags；
- 可选 DMA helper 背景路径；
- 等待策略与恢复路径。

上述能力在具体工程中能否使用，取决于：

- HPM SDK 头文件是否完整；
- 工程是否启用了 SDK 的 `dma_mgr` 组件（`CONFIG_DMA_MGR`），未启用时编译报错；
- 引脚和时钟是否已在创建对象前配置。总线恢复使用 I2C 控制器自身产生的复位信号（9 个 SCL 脉冲）。

## 当前 PWM 支持情况

`HPMPWM` 当前主线支持两类路径：

- 如果目标 SoC 提供标准 PWM 外设，则走 `hpm_pwm_drv`；
- 如果不满足该条件，代码里还有 `GPTMR` fallback 路径。

具体走哪条，取决于芯片和 SDK 宏条件。
