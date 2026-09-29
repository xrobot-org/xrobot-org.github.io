---
id: code-gen-stm32
title: STM32 代码生成
sidebar_position: 1
---

# STM32 代码生成

LibXR 提供 `xr_cubemx_cfg` 命令用于从 STM32CubeMX 工程中一键生成符合 LibXR 架构的 C++ 初始化代码。该命令集成了配置解析、代码生成、CMake 集成等多个子工具。

---

## 快速使用

在 `STM32CubeMX` 工程根目录下执行：

```bash
xr_cubemx_cfg -d .
```

如果你已经在 `VS Code` 里使用 [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot)，也可以直接在插件提供的 GUI 页面里改配置；修改后会自动执行生成命令。

该命令将自动完成以下流程：

1. 初始化或更新 `libxr` 子模块；
2. 查找 `.ioc` 文件并解析为 `.config.yaml`；
3. 生成 `app_main.cpp` 初始化代码；
4. 修改 `CMakeLists.txt`，集成 LibXR 构建配置。

---

## 示例输出

```text
[INFO] LibXR submodule already exists. Checking for updates...
[INFO] [OK] cd . && git submodule update --init --recursive
[INFO] LibXR submodule updated.
Found .ioc file: ./atom.ioc
Parsing .ioc file...
[INFO] [OK] xr_parse_ioc -d . -o ./.config.yaml
Generating C++ code...
[INFO] [OK] xr_gen_code_stm32 -i ./.config.yaml -o ./User/app_main.cpp
[INFO] [OK] xr_stm32_cmake .
[INFO] [Pass] All tasks completed successfully!
```

---

## 输出结构

执行完成后，项目通常会新增或修改这些文件：

```txt
.
├── .config.yaml                      # 解析生成的配置文件
├── User/
│   │── app_main.cpp                  # 主入口初始化代码
│   │── app_main.h                    # 主入口初始化代码的头文件
│   │── libxr_config.yaml             # LibXR 配置文件
│   └── flash_map.hpp                 # FLASH 地址映射表
├── cmake/LibXR.CMake                 # LibXR 构建配置
├── CMakeLists.txt                    # 自动集成 LibXR
└── Middlewares/Third_Party/LibXR     # Git 子模块：LibXR 本体
```

---

## app_main.cpp

`app_main.cpp` 文件包含了 LibXR 初始化函数 `app_main()`，可以放心的在User Code Begin xxx 和 User Code End xxx 之间插入自己的代码，重新生成后不会被覆盖。

> 此函数应当永不返回，一旦函数返回所有外设对象（如usart1）将会析构并释放资源，此时访问将会导致崩溃。推荐向线程/任务中传递外设对象的基类指针并操作，在本章的`与XRobot集成中`会有更好的方式实现。

```cpp
#include "app_main.h"

#include "libxr.hpp"
#include "main.h"
#include "stm32_adc.hpp"
#include "stm32_can.hpp"
#include "stm32_dac.hpp"
#include "stm32_gpio.hpp"
#include "stm32_i2c.hpp"
......

using namespace LibXR;

/* User Code Begin 1 */

/* User Code End 1 */
/* External HAL Declarations */
extern ADC_HandleTypeDef hadc1;
extern CAN_HandleTypeDef hcan1;
extern I2C_HandleTypeDef hi2c1;
extern SPI_HandleTypeDef hspi1;
extern TIM_HandleTypeDef htim1;
......

/* DMA Resources */
static uint16_t adc1_buf[64];
static uint8_t spi1_tx_buf[32];
static uint8_t spi1_rx_buf[32];
static uint8_t usart1_tx_buf[128];
static uint8_t usart1_rx_buf[128];
static uint8_t i2c1_buf[32];
......

extern "C" void app_main(void) {
  /* User Code Begin 2 */
  
  /* User Code End 2 */
  STM32TimerTimebase timebase(&htim2);
  PlatformInit(2, 1024);
  STM32PowerManager power_manager;

  /* GPIO Configuration */
  STM32GPIO USER_KEY(USER_KEY_GPIO_Port, USER_KEY_Pin, EXTI0_IRQn);
  STM32GPIO LED_B(LED_B_GPIO_Port, LED_B_Pin);
  STM32PWM pwm_tim1_ch1(&htim1, TIM_CHANNEL_1, false);
  STM32SPI spi1(&hspi1, spi1_rx_buf, spi1_tx_buf, 3);
  STM32UART usart1(&huart1,
              usart1_rx_buf, usart1_tx_buf, 5);
  STM32I2C i2c1(&hi2c1, i2c1_buf, 3);
  STM32CAN can1(&hcan1, 5);
  /* User Code Begin 3 */
  while (1) {
      LibXR::Thread::Sleep(1000);
  }
  /* User Code End 3 */
}
```

---

## 使用说明

在工程入口处调用 `app_main()`：

### 裸机项目

```cpp
#include "app_main.h"

int main() {
    HAL_Init();
    SystemClock_Config();
    ...
    app_main();  // 初始化外设并启动应用层
    while (1){
        ...
    }
}
```

### FreeRTOS 项目

将 `app_main()` 放入主线程入口（StartDefaultTask）中调用。注意更改STM32CubeMX中的初始线程大小，避免栈溢出。

---

## 可选参数

| 参数       | 说明                        |
| ---------- | --------------------------- |
| `-d`       | 指定 STM32 工程根目录       |
| `-t`       | 设置终端外设（如 `usart1`） |
| `--xrobot` | 生成 `XR_REGISTER` 注册与 `XROBOT_MAIN();`，见 [与XRobot集成](../xrobot_inter.md) |
| `--commit` | 显式指定 LibXR 子模块 commit |
| `--git-source` | 选择 LibXR 的 Git 源或 base URL |
| `--git-mirrors` | 为自动选源提供额外镜像 URL |

---

## 工具链切换

如需切换 GCC/Clang 或切换 Clang 标准库，可以使用：

```bash
xr_stm32_toolchain_switch gcc
xr_stm32_toolchain_switch clang -g
xr_stm32_toolchain_switch clang --newlib
xr_stm32_toolchain_switch clang --picolibc
```

执行命令会自动修改 CMakePresets.json 和 cmake/starm-clang.cmake，重启 VSCode 即可生效。

---

## 项目要求

- 必须为 STM32CubeMX 导出的 CMake 工程；
- 必须存在 `.ioc` 文件；
- FreeRTOS 必须开启互斥锁（`configUSE_MUTEXES`）

---

## 编译优化

默认生成的 CMake 配置在 Debug 模式下会为 LibXR、HAL 库和 FreeRTOS 等库添加 `-O2` 优化选项，而对 User 目录下的代码以及 XRobot 的模块则使用 `-Og` 优化选项，以此减少 FLASH 占用。

---

## 相关命令

| 工具名                      | 功能说明                          |
| --------------------------- | --------------------------------- |
| `xr_cubemx_generate`        | 仅执行 STM32CubeMX 脚本模式生成   |
| `xr_parse_ioc`              | 解析 `.ioc`，生成 `.config.yaml`  |
| `xr_gen_code_stm32`         | 根据 YAML 配置生成 `app_main.cpp` |
| `xr_stm32_flash`            | 生成 STM32 Flash 布局表           |
| `xr_stm32_cmake`            | 修改 CMake 构建文件，集成 LibXR   |
| `xr_stm32_toolchain_switch` | 切换工具链和标准库                |

## 参考

* [LibXR STM32 代码生成工具测试项目 (GitHub Action)](https://github.com/Jiu-xiao/libxr_stm32_test)
* [LibXR 命令行工具以及文档](https://pypi.org/project/libxr/)
