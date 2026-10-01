---
id: code-gen-xrobot-inter
title: 与XRobot集成
sidebar_position: 2
---

# 与XRobot集成

加上 `--xrobot` 后，代码生成器在 `app_main.cpp` 中为每个生成的外设对象写一行 `XR_REGISTER(名字, 类型)`，并在 User Code 3 区域之后调用 `XROBOT_MAIN();`。不加 `--xrobot` 时不生成任何 XRobot 代码。应用配置按这些名字引用硬件，见 [项目管理（XRobot）](../proj_man/README.md)。

## 示例

```bash
libxr stm32 setup -d . --xrobot
# 或单独重新生成 app_main.cpp：
libxr parse -d . -o .config.yaml
libxr gen -i .config.yaml -o User/app_main.cpp --xrobot --libxr-config User/libxr_config.yaml
```

STM32F407 工程生成的 `app_main.cpp`（节选）：

```cpp
#include "flash_map.hpp"
#include "xrobot_main.hpp"
......

extern "C" void app_main(void) {
  ......
  XR_REGISTER(power_manager, LibXR::PowerManager);
  XR_REGISTER(USER_KEY, LibXR::GPIO);
  ......
  XR_REGISTER(spi1, LibXR::SPI);
  XR_REGISTER(usart1, LibXR::UART);
  ......
  XR_REGISTER(can1, LibXR::CAN);
  ......
  XR_REGISTER(ramfs, LibXR::RamFS);
  XR_REGISTER(terminal, LibXR::Terminal<32, 32, 5, 5>);

  // clang-format on
  // NOLINTEND
  /* User Code Begin 3 */
  /* User Code End 3 */
  XROBOT_MAIN();
}
```

- 名字就是生成的 C++ 对象名：GPIO 取 CubeMX 中的引脚标签（没有标签时由引脚名得到），外设取实例名（如 `spi1`、`usart1`）。
- 每个名字只注册一种类型。FDCAN 对象 `fdcanN` 注册为 `LibXR::FDCAN`，同时生成引用 `LibXR::CAN& canN = fdcanN;` 并注册为 `LibXR::CAN`。芯片同时有 CAN 与 FDCAN 导致 `canN` 重名时，生成失败。
- 需要注册更多对象（例如在 User Code 3 中创建的数据库或额外串口）时，在 User Code 3 中写 `XR_REGISTER`，这些内容在重新生成时保留。
- `XROBOT_MAIN();` 由生成器维护。旧版本把它写在 User Code 3 中；若 User Code 区域中仍有该调用，生成器报告行号并停止、不写任何文件，删除该行后重新生成即可。

`libxr stm32 cmake` 新建 `cmake/LibXR.CMake` 时，若 `User/app_main.cpp` 由 `--xrobot` 生成，则在其中设置 `XROBOT_MODULES_DIR`。已有的 `LibXR.CMake` 由用户维护，其中的设置与 `app_main.cpp` 不一致时只给出警告。

## 生成器版本

在 `User/libxr_config.yaml` 顶层写 `generator: 6.0.0`（发布版本号或 40 位 commit）固定代码生成器版本，BSP CI 据此安装生成器。生成器保留该键和文件中的注释。

## 生成之后

```bash
xrobot setup      # 拉取模块、检查配置、生成 User/xrobot_main.hpp
```

`User/xrobot_main.hpp` 由 XRobot 生成，见 [入口与生成](../proj_man/gen_main.md)。
