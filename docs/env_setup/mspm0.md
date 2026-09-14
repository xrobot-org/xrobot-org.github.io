---
id: env-setup-mspm0
title: MSPM0环境配置
sidebar_position: 3
---

# MSPM0 环境配置

当前默认使用 GNU Arm Embedded Toolchain，编译器前缀为 `arm-none-eabi-`。目前没有验证在 TI Arm Clang 工具链下的兼容性。

当前 `driver/mspm0/CMakeLists.txt` 已把 `GPIO / PWM / Timebase / UART / SPI / I2C` 以及共享 GROUP1 中断与原子适配源文件一起加入默认 MSPM0 驱动构建。

如果只是想快速开始，推荐直接使用 XRobot 的 MSPM0 Docker 镜像：`ghcr.io/xrobot-org/docker-image-mspm0:main`。

## CMake 配置

在 LibXR 外部工程中，MSPM0 通常按下面的方式接入：

```cmake
set(LIBXR_SYSTEM None)
set(LIBXR_DRIVER mspm0)
set(LIBXR_NO_EIGEN True)
set(MSPM0_SDK_DIR "${CMAKE_CURRENT_SOURCE_DIR}/mspm0-sdk")

include("${CMAKE_SOURCE_DIR}/cmake/LibXR.CMake")
```

其中：

* `LIBXR_SYSTEM None` 表示当前按裸机方式集成
* `LIBXR_DRIVER mspm0` 表示启用 LibXR 的 MSPM0 驱动目录
* `MSPM0_SDK_DIR` 指向 TI MSPM0 SDK 根目录
* `cmake/LibXR.CMake` 负责把 LibXR 和 MSPM0 SDK 接到工程里

一个清晰的职责分工通常是：

* 根 `CMakeLists.txt` 负责最终应用目标、用户源文件、链接选项和后处理
* `cmake/LibXR.CMake` 负责 LibXR 平台选择、SDK 路径检查、SysConfig 输出检查，以及给 `xr` 目标补齐 MSPM0 相关依赖

## 目录结构约定

推荐采用下面的目录结构：

```text
.
|-- CMakeLists.txt
|-- cmake/
|   `-- LibXR.CMake
|-- libxr/
|-- mspm0-sdk/
|-- src/
`-- sysconfig/
```

其中：

* `libxr/` 是 LibXR 源码目录
* `mspm0-sdk/` 是 TI MSPM0 SDK 根目录
* `src/` 是应用层源文件
* `sysconfig/` 保存 SysConfig 生成的配置文件

如果你的 SDK 不在仓库内，也可以把 `MSPM0_SDK_DIR` 改到其他位置。

## SysConfig 输出要求

MSPM0 工程通常依赖 SysConfig 输出的配置文件。CMake 一般只负责“查找并使用”，不负责调用 SysConfig 自动生成。

推荐把 SysConfig 输出统一放到：

```text
sysconfig/
```

CMake 侧通常需要能找到这些文件：

* `ti_msp*_config.c`
* `ti_msp*_config.h`
* `device.opt`
* 一份 `.lds` 链接脚本，常见文件名为 `device_linker.lds`

如果项目采用自动发现方式，那么根工程里不需要手工写死 `ti_msp_dl_config.c` 这类具体文件名，只需要保证生成文件位于 `sysconfig/` 目录即可。

如果你修改了 `.syscfg` 文件，需要先重新生成这些输出，再重新执行 CMake 构建。

## 芯片型号相关项

虽然本文是通用说明，但 MSPM0 项目里仍有几项内容必须随芯片型号或开发板变化：

* 启动文件路径
* `driverlib.a` 所在目录
* SysConfig 目标板或目标芯片
* 编译宏，例如 `__MSPM0xxxx__`

MSPM0 工程里，很多编译问题本质上都是“芯片型号相关文件没有同步替换”。

## 当前主线已接入的 MSPM0 驱动范围

默认 MSPM0 驱动列表包含：

- `mspm0_gpio.*`
- `mspm0_pwm.*`
- `mspm0_timebase.*`
- `mspm0_uart.*`
- `mspm0_spi.*`
- `mspm0_i2c.*`
- `mspm0_group1_shared.cpp`
- `mspm0_atomic_shim.c`

SPI / I2C 已在 LibXR 默认 MSPM0 构建列表中，上层工程不需要重复手工添加对应源文件。工程仍然需要提供匹配芯片的 SDK、SysConfig 输出和外设初始化配置。

## 工具链要求

推荐使用：

* `cmake`
* `ninja`
* `arm-none-eabi-gcc`
* `arm-none-eabi-g++`
* `arm-none-eabi-objcopy`

本机直接构建的典型命令如下：

```powershell
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=arm-none-eabi-gcc -DCMAKE_CXX_COMPILER=arm-none-eabi-g++ -DCMAKE_ASM_COMPILER=arm-none-eabi-gcc
cmake --build build
```

## Docker 构建

如果不希望在本机单独安装工具链，可以直接用 Docker。

PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\docker_build.ps1
```

Bash：

```bash
bash ./tools/docker_build.sh
```

PowerShell 脚本支持：

```powershell
.\tools\docker_build.ps1 -Image ghcr.io/xrobot-org/docker-image-mspm0:main -BuildType Release -BuildDir build -CCompiler arm-none-eabi-gcc -CxxCompiler arm-none-eabi-g++ -AsmCompiler arm-none-eabi-gcc
```

Bash 脚本支持这些环境变量：

* `XROBOT_MSPM0_IMAGE`
* `BUILD_TYPE`
* `BUILD_DIR`
* `C_COMPILER`
* `CXX_COMPILER`
* `ASM_COMPILER`

## 常见问题

### CMake 提示找不到 MSPM0 SDK

先检查：

```text
${MSPM0_SDK_DIR}/source
```

是否存在。如果不存在，说明 SDK 路径配置不对。

### CMake 提示找不到 SysConfig 文件

先检查 `sysconfig/` 下是否已经生成：

* `ti_msp*_config.c`
* `ti_msp*_config.h`
* `device.opt`
* `.lds`

如果缺文件，说明还没有完成 SysConfig 输出生成，或者输出目录与 CMake 约定不一致。

### 链接阶段出现 `_write/_read/_close` 一类 warning

如果工程使用了：

```text
--specs=nano.specs
--specs=nosys.specs
```

那么 `_write`、`_read`、`_close`、`_isatty`、`_fstat` 等未实现 warning 是常见现象。只要最终成功生成 ELF，通常不影响裸机程序运行。

## 示例工程

* [MSPM0G3507 LibXR Template](https://github.com/xrobot-org/MSPM0G3507_LibXR_Template)
