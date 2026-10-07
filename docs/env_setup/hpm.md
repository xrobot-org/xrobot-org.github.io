---
id: env-setup-hpm
title: HPM 环境配置
sidebar_position: 5
---

# HPM 环境配置

HPM 工程是标准的 HPM SDK CMake 工程，用 RISC-V GCC 工具链（编译器前缀 `riscv32-unknown-elf-`）构建。BSP [bsp-hpm5301evklite](https://github.com/xrobot-org/bsp-hpm5301evklite) 和 [bsp-rmcs-slave-lite](https://github.com/xrobot-org/bsp-rmcs-slave-lite) 是可以完整构建的工程，本页以它们为例；[代码生成](../code_gen/hpm/README.md)说明 `libxr hpm setup` 如何在这样的工程里生成 LibXR 代码。

## 工具链

HPM SDK 从环境变量 `GNURISCV_TOOLCHAIN_PATH` 读取工具链的安装目录（`bin` 的上一级目录），编译器为其中的 `bin/riscv32-unknown-elf-gcc`；没有设置这个变量时，CMake 配置报错 `GNURISCV_TOOLCHAIN_PATH is not set yet`。SDK 本体由 `HPM_SDK_BASE` 指向。

工具链的来源：

- Windows：HPMicro 的开发环境包 [sdk_env](https://github.com/hpmicro/sdk_env)，工具链放在其中的 `toolchains/` 目录，由 `start_cmd.cmd` 打开的命令行设置 `GNURISCV_TOOLCHAIN_PATH` 等环境变量；
- Linux x64：[hpm-linux-gcc-release v0.1.0](https://github.com/Jiu-xiao/hpm-linux-gcc-release/releases/tag/v0.1.0) 发布的 `riscv32-unknown-elf` 工具链；
- Docker：`ghcr.io/xrobot-org/docker-image-hpm:main` 在 `/opt/hpm-riscv32-unknown-elf` 中装有上述 Linux 工具链（GCC 15.2.0），路径同时记录在 `GNURISCV_TOOLCHAIN_PATH` 和 `XR_HPM_TOOLCHAIN_ROOT` 中，见 [Docker 环境配置](docker.md)。

## 工程结构

以 bsp-hpm5301evklite 为例：

```text
.
|-- CMakeLists.txt
|-- CMakePresets.json
|-- app.yaml
|-- main.c
|-- boards/
|   `-- hpm5301evklite/
|       |-- tool_config.hpmpc
|       |-- pinmux.c
|       `-- ...
|-- cmake/
|   `-- LibXR.CMake
|-- User/
|   `-- app_main.cpp
`-- libxr/
```

* `CMakeLists.txt` 用 `find_package(hpm-sdk REQUIRED HINTS $ENV{HPM_SDK_BASE})` 引入 HPM SDK，`BOARD_SEARCH_PATH` 指向 `boards/`，并设置 `CONFIG_DMA_MGR 1`（LibXR 的 HPM 驱动依赖 SDK 的 dma_mgr 组件）
* `app.yaml` 声明对 `board_gpt_pin` 的依赖；`boards/<board>/` 下有唯一的 `.hpmpc` 文件（BSP 命名为 `tool_config.hpmpc`）；`libxr hpm setup` 和 VS Code 扩展按这两项识别 HPM 工程
* `boards/<board>/pinmux.c` 由 HPM Pinmux Tool 从 `tool_config.hpmpc` 生成，提供 `init_bsp_pins()`
* `main.c` 在工程根目录：先 `init_bsp_pins()`，再 SDK 板级的 `board_init()`，然后调用各外设的时钟函数（`init_uart3_clock()` 一类），最后进入 `app_main()`
* `User/` 存放代码生成的 `app_main.cpp`；`libxr hpm setup` 会在其中生成 `libxr_config.yaml`
* `libxr/` 是 LibXR 子模块

## 构建

`CMakePresets.json` 提供 `debug-flash-xip`、`debug-ram` 和 `release-flash-xip` 三个 preset（Ninja 生成器，`HPM_BUILD_TYPE` 对应 `flash_xip` 或 `ram`）。BSP 使用 XRobot 模块，配置前先运行一次 `xrobot setup`，它按 `xrobot.lock` 拉取模块并生成 `Modules/CMakeLists.txt`：

```bash
xrobot setup
cmake --preset release-flash-xip
cmake --build --preset release-flash-xip
```

产物在 `build/output/` 下，如 `demo.elf`、`demo.bin`。

## CMake 集成

`cmake/LibXR.CMake` 用三个变量选择平台，然后把 LibXR 作为子工程加入：

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER hpm)
set(LIBXR_NO_EIGEN True)
```

`xr` 链接 `${HPM_SDK_LIB_ITF}`，LibXR 因此使用与 SDK 相同的编译选项和头文件路径；应用目标 `app` 和最终的 ELF 目标链接 `xr`。工具链的探测由 `find_package(hpm-sdk)` 完成。

## LibXR 的 HPM 驱动

`driver/hpm` 中的驱动由该目录的 `CMakeLists.txt` 统一加入构建：

- `hpm_gpio.*`：GPIO
- `hpm_i2c.*`：I2C 主机
- `hpm_pwm.*`：PWM
- `hpm_timebase.*`：基于 MCHTMR 的时间基准
- `hpm_dma.*`：初始化 SDK 的 dma_mgr（只做一次），供 I2C 的 DMA 后台路径使用

驱动只调用 SDK 的驱动函数；外设的引脚复用、时钟和初始化顺序由工程负责（`init_bsp_pins()`、`board_init()` 和 `init_*_clock()`），LibXR 对象在 `app_main()` 中创建。驱动依赖 SDK 的 `dma_mgr` 组件，BSP 用 `CONFIG_DMA_MGR 1` 启用它。

`HPMI2C` 在 SDK 的 `hpm_i2c_drv` 之上实现 LibXR 的 I2C 主机抽象：阻塞式字节流传输和寄存器/存储器地址式传输；默认 7 位主机寻址，`SetAddressMode()` 可切换到 SDK 支持的 10 位主机寻址；POLLING、CALLBACK 等等待策略可以走 dma_mgr 的 DMA 后台路径；超时、总线忙、无响应等典型主机故障出现时，驱动按最近一次成功配置重建控制器。

`HPMPWM` 的构造参数在两条代码路径下相同（外设地址、时钟、输出通道索引、比较器索引、极性）：SoC 提供标准 PWM 外设时走 SDK 的 `hpm_pwm_drv`，其余 SoC 走 GPTMR 路径。`SetDutyCycle()` 接受 0.0 到 1.0 的占空比，`SetConfig()` 配置频率。

## Docker 构建

镜像 `ghcr.io/xrobot-org/docker-image-hpm:main` 内置 RISC-V 工具链（GCC 15.2.0）、CMake、Ninja 和 HPM SDK v1.13.0，并设置好了 `GNURISCV_TOOLCHAIN_PATH` 与 `HPM_SDK_BASE`：

```bash
docker run --rm -v "$PWD:/work" -w /work ghcr.io/xrobot-org/docker-image-hpm:main \
  bash -c 'pip install xrobot==1.0.0 && xrobot setup && cmake --preset release-flash-xip && cmake --build --preset release-flash-xip'
```
