---
id: code-gen-xrobot-inter
title: 与XRobot集成
sidebar_position: 2
---

# 与XRobot集成

加上 `--xrobot` 后，代码生成器在 `app_main.cpp` 中为每个生成的外设对象写一行 `XR_REGISTER(名字, 类型)`，并在 User Code 3 区域之后调用 `XROBOT_MAIN();`。加上 `--no-xrobot` 时不生成任何 XRobot 代码；两者都不写时，`libxr gen` 和 `libxr stm32 setup` 沿用已有 `app_main.cpp` 的选择，新工程不生成 XRobot 代码。配置按这些名字引用硬件，见 [项目管理（XRobot）](../proj_man/README.md)。

已有工程改为 `--xrobot` 时，User Code 3 若仍是不带 `--xrobot` 时生成的默认循环，重新生成会清空这个循环，使其后的 `XROBOT_MAIN()` 能够执行；User Code 3 的其他内容保持不变。

## 示例

```bash
libxr stm32 setup -d . --xrobot
# 或单独重新生成 app_main.cpp：
libxr parse -d . -o .config.yaml
libxr gen -i .config.yaml -o User/app_main.cpp --xrobot --libxr-config User/libxr_config.yaml
```

STM32F407 工程生成的 `app_main.cpp`（节选，省略处写作 `// ...`）：

```cpp
#include "app_main.h"

#include "cdc_uart.hpp"
#include "flash_map.hpp"
// ...
#include "xrobot_main.hpp"

// ...

extern "C" void app_main(void)
{
  // ...
  // Hardware registration
  XR_REGISTER(power_manager, LibXR::PowerManager);

  XR_REGISTER(USER_KEY, LibXR::GPIO);
  // ...

  XR_REGISTER(spi1, LibXR::SPI);

  XR_REGISTER(usart1, LibXR::UART);
  // ...
  XR_REGISTER(usb_otg_hs_cdc2, LibXR::UART);

  // ...
  XR_REGISTER(can1, LibXR::CAN);
  XR_REGISTER(can2, LibXR::CAN);

  XR_REGISTER(ramfs, LibXR::RamFS);

  XR_REGISTER(terminal, LibXR::Terminal<32, 32, 5, 5>);

  XR_REGISTER(database, LibXR::Database);

  /* User Code Begin 3 */
  /* User Code End 3 */
  XROBOT_MAIN();
}
```

注册名即生成的 C++ 对象名。各类对象的注册名和类型如下，顺序与生成代码中注册的顺序相同：

| 对象 | 注册名 | 类型 |
| --- | --- | --- |
| 电源管理 | `power_manager` | `LibXR::PowerManager` |
| GPIO 引脚 | CubeMX 中的引脚标签，没有标签时为引脚名，如 `USER_KEY`、`PA8` | `LibXR::GPIO` |
| ADC 通道 | `<ADC 实例>_<通道>`，如 `adc3_adc_channel_8`；同一通道配置在多个 Rank 时，之后的名字带 `_rank<N>` 后缀 | `LibXR::ADC` |
| DAC 输出 | `<DAC 实例>_<输出>`，如 `dac1_out2`；实例名为 `DAC` 时为 `dac_out2` | `LibXR::DAC` |
| PWM 通道 | `pwm_<定时器>_ch<通道>`，如 `pwm_tim1_ch1`；互补输出为 `pwm_tim1_ch1n` | `LibXR::PWM` |
| SPI | 小写的实例名，如 `spi1` | `LibXR::SPI` |
| 硬件串口（USART、UART、LPUART） | 小写的实例名，如 `usart1`、`uart7` | `LibXR::UART` |
| USB CDC | `<USB 实例>_cdc`、`<USB 实例>_cdc2`……，如 `usb_otg_fs_cdc` | `LibXR::UART` |
| I2C | 小写的实例名，如 `i2c1` | `LibXR::I2C` |
| CAN | 小写的实例名，如 `can1`；FDCAN 实例另有引用 `canN`（`LibXR::CAN& canN = fdcanN;`） | `LibXR::CAN` |
| FDCAN | 小写的实例名，如 `fdcan1` | `LibXR::FDCAN` |
| 独立看门狗 | 小写的实例名，如 `iwdg`、`iwdg1` | `LibXR::Watchdog` |
| RamFS | `ramfs`，`terminal_source` 指向已生成的串口时生成 | `LibXR::RamFS` |
| 终端 | `terminal`，与 `ramfs` 一同生成 | `LibXR::Terminal<...>`，模板参数为 `Terminal` 的前四项设置，如 `LibXR::Terminal<32, 32, 5, 5>` |
| 数据库 | `database`，`database.enable` 为 `true` 时生成，见 [Flash 数据库](./stm32/flash.md) | `LibXR::Database` |

- 每个名字只注册一种类型，生成的名字重复时生成失败，例如芯片同时有 CAN 与 FDCAN，`canN` 重名。
- 需要注册更多对象（例如在 User Code 3 中额外创建的串口）时，在 User Code 3 中写 `XR_REGISTER`，这些内容在重新生成时保留。
- `XROBOT_MAIN();` 由生成器维护。旧版本把它写在 User Code 3 中；若 User Code 区域中仍有该调用，生成器报告行号并停止、不写任何文件，删除该行后重新生成即可。

`libxr stm32 cmake` 和 `libxr stm32 setup` 按 `User/app_main.cpp` 是否由 `--xrobot` 生成，在 `cmake/LibXR.CMake` 开头的 “Project settings” 块中加入或删除 `set(XROBOT_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/Modules")`，加入时写在 `set(LIBXR_DRIVER st)` 之后。单独运行 `libxr gen` 不修改这个文件。

## 生成器版本

`User/libxr_config.yaml` 顶层的 `generator:` 固定代码生成器的版本（发布版本号或 40 位 commit），BSP CI 据此安装生成器。生成器新建这个文件时，在第一行写入已安装的版本，例如 `generator: 6.0.0`；重新生成时保留该键和文件中的注释。已有的文件没有这个键时，`libxr gen` 给出警告，生成照常进行：

```text
[警告] libxr_config.yaml 没有固定 generator 的版本；请添加 `generator: 6.0.0`（BSP 的 CI 安装固定的版本）
```

## 生成之后

`libxr stm32 setup -d . --xrobot` 在入口源文件中写出注册代码和 `XROBOT_MAIN();`，并在 `cmake/LibXR.CMake` 中设置模块目录；`Modules/` 下的文件和 `User/xrobot.yaml` 由 XRobot 创建。BSP 根目录还没有 `Modules/modules.yaml` 时，按以下顺序完成 XRobot 的设置。以加入 BlinkLED 模块、LED 接在标签为 `LED_B` 的引脚上为例：

```bash
xrobot init                                     # 创建 Modules/modules.yaml、Modules/sources.yaml 和 User/xrobot.yaml
xrobot module add xrobot-org/BlinkLED@dev       # 加入模块
xrobot setup                                    # 拉取模块、检查配置、生成 User/xrobot_main.hpp
xrobot instance add xrobot-org/BlinkLED         # 新增实例 blinkled_0
xrobot instance set blinkled_0 args.led LED_B   # 依赖参数填写已注册的对象名
xrobot gen                                      # 重新生成 User/xrobot_main.hpp
```

各命令的输出见[快速开始](../quick_start.md#新建-bsp)。模块的依赖参数为 `LibXR::RamFS&` 时，需要在 `User/libxr_config.yaml` 中设置 `terminal_source`（或运行 `libxr stm32 setup` 时给出 `-t`）；为 `LibXR::Database&` 时，需要设置 `database.enable: true`。修改后重新运行 `libxr stm32 setup -d .`，生成并注册 `ramfs` 或 `database`。没有这两个设置时，`xrobot instance add` 对这类参数没有可填写的对象。

`User/xrobot_main.hpp` 由 XRobot 生成，见 [主函数生成](../proj_man/gen_main.md)。
