---
id: code-gen-stm32
title: STM32 Code Generation
sidebar_position: 1
---

# STM32 Code Generation

LibXR provides the `libxr stm32 setup` command to automatically generate C++ initialization code from an STM32CubeMX project. This command wraps several tools including configuration parsing, code generation, and CMake integration.

---

## Quick Start

In the root directory of your STM32CubeMX project, run:

```bash
libxr stm32 setup -d .
```

This command will perform the following steps automatically:

1. Initialize or update the `libxr` submodule  
2. Locate the `.ioc` file and convert it into `.config.yaml`  
3. Generate `app_main.cpp` with initialization code  
4. Modify `CMakeLists.txt` to integrate LibXR

---

## Example Output

```text
[INFO] Default LibXR commit: 4e9670164541b6af6b600a6d544115a9b3e49d98
[INFO] [OK] git -C . submodule sync -- Middlewares/Third_Party/LibXR
[INFO] Keeping the LibXR checkout 4e9670164541.
[INFO] Found .ioc file: .\STM32F103RC.ioc
[INFO] Parsing .ioc file...
[INFO] Processing STM32F103RC.ioc...
[INFO] [USBParser] Detected USB peripherals: ['USB']
[INFO] [USBParser] Parsing configuration for: USB
[INFO] Configuration exported to: .\.config.yaml
[INFO] Generating C++ code...
[INFO] Detected FreeRTOS configuration
[INFO] FlashLayout is generated and injected, MCU: STM32F103RCT6
[INFO] Flash layout map written to: .\User\flash_map.hpp
[INFO] Successfully generated: .\User
[INFO] Generated header file: app_main.h
[INFO] LibXR.CMake already up to date, no changes needed.
[INFO] LibXR.CMake already included in CMakeLists.txt.
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

Select `CMSIS_V2` as the FreeRTOS interface. Firmware packages such as STM32Cube FW_H7 V1.13.0 have removed the CMSIS-RTOS V1 wrapper; when a project with the `CMSIS_V1` interface moves to such a package, STM32CubeMX removes FreeRTOS entirely, without a message. Open such a project with Continue to keep its firmware package, switch the interface to `CMSIS_V2`, then migrate.

With `CMSIS_V2`, STM32CubeMX always enables FreeRTOS software timers (`configUSE_TIMERS`), which adds a timer task. LibXR runs its timed tasks (`LibXR::Timer`) in its own thread, whose priority and stack depth `PlatformInit()` sets; when `configUSE_TIMERS` is on, LibXR warns at compile time. Overriding the following definitions in the `USER CODE BEGIN Defines` section of `Core/Inc/FreeRTOSConfig.h` turns off the software timers, together with the CMSIS-RTOS2 `osTimer` API and event flags set from interrupts, which depend on them; `INCLUDE_xTimerPendFunctionCall` stays off. That section is kept when code is regenerated.

```c
/* USER CODE BEGIN Defines */
#undef configUSE_TIMERS
#define configUSE_TIMERS 0
#undef configUSE_OS2_TIMER
#define configUSE_OS2_TIMER 0
#undef configUSE_OS2_EVENTFLAGS_FROM_ISR
#define configUSE_OS2_EVENTFLAGS_FROM_ISR 0
/* USER CODE END Defines */
```

---

## Optional Arguments

| Argument   | Description                             |
| ---------- | --------------------------------------- |
| `-d`       | Specify STM32 project root directory (default: current directory) |
| `-t`       | Set terminal peripheral (e.g. `usart1`) |
| `--xrobot` / `--no-xrobot` | Emit `XR_REGISTER` registrations and `XROBOT_MAIN();`, or not, see [Integrate with XRobot](../xrobot_inter.md); without either the project keeps its choice |
| `--commit` | Pin the LibXR submodule to a specific commit |
| `--git-source` | The Git source or base URL that LibXR is cloned from when needed; `.gitmodules` always records the GitHub URL |
| `--git-mirrors` | Provide additional mirror URLs for auto source selection |

---

## Toolchain Switch

If you need to switch between GCC/Clang compilers or change the Clang standard library, use the following commands:

```bash
libxr stm32 toolchain gcc
libxr stm32 toolchain clang -g
libxr stm32 toolchain clang --newlib
libxr stm32 toolchain clang --picolibc
```

The command edits `CMakePresets.json` and `cmake/starm-clang.cmake`. Switching between gcc and clang removes the `build/` and `cmake-build*` directories: CMake does not change the compiler of an existing build directory, so the next build configures a new one. `clang` without a standard library option keeps the current one.

---

## Project Requirements

- Must be a CMake project exported from STM32CubeMX  
- Must contain a valid `.ioc` file  
- Must enable Mutex when using FreeRTOS(`configUSE_MUTEXES`)

---

## Build Optimization

By default, the generated CMake configuration applies the `-O2` optimization option to libraries such as LibXR, HAL and FreeRTOS in Debug mode, while using the `-Og` optimization option for code in the User directory and XRobot modules. This approach helps reduce FLASH usage.

---

## Subcommands (Internally used by `libxr stm32 setup`, can also be run separately)

| Command                  | Description                                    |
| ------------------------ | ---------------------------------------------- |
| `libxr stm32 cubemx-gen` | Run STM32CubeMX script-mode generation only    |
| `libxr parse`            | Parses `.ioc` and generates `.config.yaml`     |
| `libxr gen`              | Generates `app_main.cpp` from the YAML config  |
| `libxr stm32 flash-info` | Prints the STM32 flash layout table            |
| `libxr stm32 cmake`      | Integrates LibXR into the project build system |
| `libxr stm32 toolchain`  | Switch toolchain and standard library          |

The `xr_*` commands of libxr before 6.0.0 (such as `xr_cubemx_cfg`) still work: they name their new command when they run and are removed in 7.0.0. The [CodeGenerator README](https://github.com/xrobot-org/LibXR_CppCodeGenerator#旧命令--old-commands) lists them.

---

## References

[LibXR STM32 Code Generation Tool Test Project (Github Action)](https://github.com/Jiu-xiao/libxr_stm32_test)

[LibXR CLI tool and documentation (PyPI)](https://pypi.org/project/libxr/)
