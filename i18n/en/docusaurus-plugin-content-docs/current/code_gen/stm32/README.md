---
id: code-gen-stm32
title: STM32 Code Generation
sidebar_position: 1
---

# STM32 Code Generation

LibXR provides the `xr_cubemx_cfg` command to automatically generate C++ initialization code from an STM32CubeMX project. This command wraps several tools including configuration parsing, code generation, and CMake integration.

---

## Quick Start

In the root directory of your STM32CubeMX project, run:

```bash
xr_cubemx_cfg -d .
```

This command will perform the following steps automatically:

1. Initialize or update the `libxr` submodule  
2. Locate the `.ioc` file and convert it into `.config.yaml`  
3. Generate `app_main.cpp` with initialization code  
4. Modify `CMakeLists.txt` to integrate LibXR

---

## Example Output

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

## Output Structure

After execution, your project directory will contain the following generated or modified files:

```txt
.
├── .config.yaml                      # Parsed configuration from .ioc
├── User/
│   ├── app_main.cpp                  # Main initialization code
│   ├── app_main.h                    # Header for app_main
│   ├── libxr_config.yaml             # LibXR runtime configuration
│   └── flash_map.hpp                 # Flash address mapping table
├── cmake/LibXR.CMake                 # CMake build config for LibXR
├── CMakeLists.txt                    # Modified to include LibXR
└── Middlewares/Third_Party/LibXR     # LibXR as a Git submodule
```

---

## app_main.cpp

The `app_main.cpp` file contains the LibXR initialization function `app_main()`.

You can safely insert your own code between the `User Code Begin xxx` and `User Code End xxx` sections; these parts will not be overwritten when the code is regenerated.

> **Note:**  
> This function should **never return**. If it does, all peripheral objects (such as `usart1`) will be destructed and resources released, which will cause a crash if you try to access them afterwards.

It is recommended to pass base class pointers of peripheral objects to your threads or tasks and operate on them there.  
A better way to implement this will be introduced in the section **"Integrate with XRobot"** later in this chapter.

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

## How to Use

<!-- 将 `app_main()` 放入主线程入口（StartDefaultTask）中调用。 -->
Call `app_main()` in the entry function (`StartDefaultTask`) of the main thread.

### Bare-metal Project

```cpp
#include "app_main.h"

int main() {
    HAL_Init();
    SystemClock_Config();
    ...
    app_main();  // Initialize peripherals and start application
    while (1) {
        ...
    }
}
```

### FreeRTOS Project

Call `app_main()` in the main thread entry function (such as `StartDefaultTask`).  
Make sure to adjust the initial thread stack size in STM32CubeMX to avoid stack overflow.

---

## Optional Arguments

| Argument   | Description                             |
| ---------- | --------------------------------------- |
| `-d`       | Specify STM32 project root directory    |
| `-t`       | Set terminal peripheral (e.g. `usart1`) |
| `--xrobot` | Emit `XR_REGISTER` registrations and `XROBOT_MAIN();`, see [Integrate with XRobot](../xrobot_inter.md) |
| `--commit` | Pin the LibXR submodule to a specific commit |
| `--git-source` | Select the preferred Git source or base URL for LibXR |
| `--git-mirrors` | Provide additional mirror URLs for auto source selection |

---

## Toolchain Switch

If you need to switch between GCC/Clang compilers or change the Clang standard library, use the following commands:

```bash
xr_stm32_toolchain_switch gcc
xr_stm32_toolchain_switch clang -g
xr_stm32_toolchain_switch clang --newlib
xr_stm32_toolchain_switch clang --picolibc
```

Command execution will automatically modify CMakePresets.json and cmake/starm-clang.cmake, restart VSCode to take effect.

---

## Project Requirements

- Must be a CMake project exported from STM32CubeMX  
- Must contain a valid `.ioc` file  
- Must enable Mutex when using FreeRTOS(`configUSE_MUTEXES`)

---

## Build Optimization

By default, the generated CMake configuration applies the `-O2` optimization option to libraries such as LibXR, HAL and FreeRTOS in Debug mode, while using the `-Og` optimization option for code in the User directory and XRobot modules. This approach helps reduce FLASH usage.

---

## Subcommands (Internally used by `xr_cubemx_cfg`, can also be run separately)

| Tool                        | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `xr_cubemx_generate`        | Run STM32CubeMX script-mode generation only    |
| `xr_parse_ioc`              | Parses `.ioc` and generates `.config.yaml`     |
| `xr_gen_code_stm32`         | Generates `app_main.cpp` from the YAML config  |
| `xr_stm32_flash`            | Generates the STM32 flash layout table         |
| `xr_stm32_cmake`            | Integrates LibXR into the project build system |
| `xr_stm32_toolchain_switch` | Switch toolchain and standard library          |

---

## References

[LibXR STM32 Code Generation Tool Test Project (Github Action)](https://github.com/Jiu-xiao/libxr_stm32_test)

[LibXR CLI tool and documentation (PyPI)](https://pypi.org/project/libxr/)
