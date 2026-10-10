---
id: quick_start
title: 快速开始
sidebar_position: 2
---

# 快速开始

本页从安装工具开始，到构建出第一个程序为止。起点有三种：已有的 BSP、STM32CubeMX 工程和新建的 BSP，按工程的情况阅读对应的一节。

## 安装

工具的安装见[环境配置](./env_setup/README.md#安装)，编译器见对应平台的页面，例如 [STM32 环境配置](./env_setup/stm32.md) 和 [Linux 环境配置](./env_setup/linux.md)。安装后确认版本：

```text
$ xrobot --version
xrobot 1.0.1
$ libxr --version
libxr 6.0.1
```

BSP 使用的 xrobot 版本记录在 `Modules/modules.yaml` 的 `xrobot:` 字段中，使用 CodeGenerator 的 STM32 工程另在 `User/libxr_config.yaml` 的 `generator:` 字段中记录 libxr 的版本，安装的版本应与之一致。

## 从已有的 BSP 开始

以 STM32F103RC 的 BSP [bsp_stm32f103](https://github.com/xrobot-org/bsp_stm32f103) 为例。克隆时带上子模块 LibXR，再由 `xrobot setup` 拉取 `xrobot.lock` 中锁定的模块，最后用 BSP 自带的 CMake 预设构建：

```bash
git clone --recursive https://github.com/xrobot-org/bsp_stm32f103.git
cd bsp_stm32f103
xrobot setup
cmake --preset debug
cmake --build --preset debug
```

`xrobot setup` 检查全部配置，并为选中的配置生成 `User/xrobot_main.hpp`：

```text
$ xrobot setup
已解析 1 个模块提交
已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp
```

构建使用 `starm-clang`，固件为 `build/debug/BluePill.elf`，同一目录下另有 `BluePill.hex` 和 `BluePill.bin`。板子、配置和烧录方法见该 BSP 的 README。

## 从 STM32CubeMX 工程开始

在 STM32CubeMX 中配置好外设并导出 CMake 工程（工程要求见 [STM32 代码生成](./code_gen/stm32/README.md#项目要求)）后，在工程根目录运行：

```bash
libxr stm32 setup -d .
```

这条命令把 LibXR 加为子模块，在 `User/` 下生成入口源文件 `app_main.cpp` 及相关文件，并把 LibXR 接入工程的 CMake 构建。还没有源文件调用 `app_main()` 时，输出的末尾给出调用的位置和构建命令（节选）：

```text
[信息] 已生成 User：已写入 app_main.cpp、app_main.h、flash_map.hpp、libxr_config.yaml
[信息] 已生成 LibXR.CMake：cmake/LibXR.CMake
[信息] 已在 CMakeLists.txt 中 include LibXR.CMake。
[信息] [通过] 全部任务已完成。
[信息] 下一步：在默认任务 StartDefaultTask（Core/Src/main.c）中 #include "app_main.h" 并调用 app_main()，写在 USER CODE 区域中，CubeMX 重新生成代码时保留。
[信息] 构建：cmake --preset debug && cmake --build --preset debug
```

按提示在 `Core/Src/main.c` 的默认任务中调用 `app_main()`。代码写在 `USER CODE` 区域内，STM32CubeMX 重新生成时保留：

```c
/* USER CODE BEGIN 0 */
#include "app_main.h"
/* USER CODE END 0 */

// ...

void StartDefaultTask(void const * argument)
{
  /* USER CODE BEGIN 5 */
  app_main();
  // ...
```

然后运行输出最后一行的构建命令。命令取自工程 `CMakePresets.json` 中的第一个 preset，本例为：

```bash
cmake --preset debug && cmake --build --preset debug
```

裸机工程在 `main()` 中初始化完外设后调用 `app_main()`，见[使用说明](./code_gen/stm32/README.md#使用说明)。生成的外设对象和各项设置见[代码生成](./code_gen/README.md)。

## 新建 BSP

以 Linux 上的一个最小 BSP 为例：一个 LED 接在 `/dev/gpiochip0` 的 17 号线上，由模块 BlinkLED 控制闪烁。主机需要安装的软件包见 [Linux 环境配置](./env_setup/linux.md)。

### 创建 BSP

新建目录，加入 LibXR 子模块，再由 `xrobot init` 创建 BSP 文件：

```bash
mkdir blink && cd blink
git init
git submodule add https://github.com/xrobot-org/libxr.git libxr
xrobot init
```

`xrobot init` 创建 `Modules/modules.yaml`、`Modules/sources.yaml` 和配置 `User/xrobot.yaml`，并把生成的文件写入 `.gitignore`。各文件的含义见 [BSP 目录约定](./proj_man/README.md#bsp-目录约定)。

### CMake 与入口源文件

`CMakeLists.txt` 在添加 LibXR 之前设置 `XROBOT_MODULES_DIR`，LibXR 据此加入模块并检查生成的头文件（见 [CMake 集成](./proj_man/setup.md#cmake-集成)）：

```cmake
cmake_minimum_required(VERSION 3.19)
project(blink CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(XROBOT_MODULES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/Modules)
add_subdirectory(libxr)

add_executable(blink User/main.cpp)
target_include_directories(blink PRIVATE User)
target_link_libraries(blink PRIVATE xr)
```

入口源文件 `User/main.cpp` 构造 BSP 对象，用 `XR_REGISTER` 注册配置可以使用的对象，然后进入主函数：

```cpp
#include "linux_gpio.hpp"
#include "xrobot_main.hpp"

int main()
{
  LibXR::PlatformInit();
  static LibXR::LinuxGPIO LED_R("/dev/gpiochip0", 17);
  LED_R.SetConfig({LibXR::GPIO::Direction::OUTPUT_PUSH_PULL, LibXR::GPIO::Pull::NONE});
  XR_REGISTER(LED_R, LibXR::GPIO);
  XROBOT_MAIN();
}
```

### 加入模块与实例

```text
$ xrobot module add xrobot-org/BlinkLED@dev
已添加 xrobot-org/BlinkLED@dev；请运行 `xrobot setup` 获取它
$ xrobot setup
已解析 1 个模块提交
已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp
$ xrobot instance add xrobot-org/BlinkLED
已将 blinkled_0 添加到 User/xrobot.yaml；生成前请填写值为空的依赖参数
  led（LibXR::GPIO&）：LED_R
```

`xrobot setup` 拉取模块并把它锁定到具体的提交，记录在 `xrobot.lock` 中。`instance add` 按构造函数写出全部参数及源码中的默认值；没有默认值的依赖参数留空（`null`，表示“未填写”），并列出可以填写的已注册对象。将依赖参数 `led` 填写为已注册的 BSP 对象名：

```text
$ xrobot instance set blinkled_0 args.led LED_R
已修改 User/xrobot.yaml 中 blinkled_0 的 args.led
```

`User/xrobot.yaml` 随之变为：

```yaml
modules:
  - module: xrobot-org/BlinkLED
    id: blinkled_0
    args:
      - led: LED_R
      - blink_cycle: 250
settings:
  monitor_sleep_ms: 1000
```

### 生成与构建

由配置生成 `User/xrobot_main.hpp`，用原生工具构建，然后运行：

```bash
xrobot gen
cmake -S . -B build
cmake --build build
./build/blink
```

运行后 LED 每 250 ms 翻转一次。配置的格式、模块的编写和其他命令见[项目管理](./proj_man/README.md)；STM32 BSP 的入口源文件 `User/app_main.cpp` 由代码生成器写出，见[与 XRobot 集成](./code_gen/xrobot_inter.md)。
