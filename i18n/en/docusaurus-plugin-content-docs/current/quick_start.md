---
id: quick_start
title: Quick Start
sidebar_position: 2
---

# Quick Start

This page goes from installing the tools to building a first program. There are three starting points: an existing BSP, an STM32CubeMX project and a new BSP; read the section that matches the project.

## Installation

Installing the tools is described in [Environment Setup](./env_setup/README.md#installation), and the compilers on the page of each platform, for example [STM32 Environment Setup](./env_setup/stm32.md) and [Linux Environment Setup](./env_setup/linux.md). After installation, check the versions:

```text
$ xrobot --version
xrobot 1.0.1
$ libxr --version
libxr 6.0.1
```

The xrobot version a BSP uses is recorded in the `xrobot:` field of `Modules/modules.yaml`, and STM32 projects that use the CodeGenerator also record the libxr version in the `generator:` field of `User/libxr_config.yaml`; the installed versions should match.

## Starting from an Existing BSP

Take the STM32F103RC BSP [bsp_stm32f103](https://github.com/xrobot-org/bsp_stm32f103). The clone includes the LibXR submodule, `xrobot setup` fetches the Modules locked in `xrobot.lock`, and the BSP's own CMake presets build it:

```bash
git clone --recursive https://github.com/xrobot-org/bsp_stm32f103.git
cd bsp_stm32f103
xrobot setup
cmake --preset debug
cmake --build --preset debug
```

`xrobot setup` checks every configuration and generates `User/xrobot_main.hpp` for the selected one:

```text
$ xrobot setup
Resolved 1 Module commit
Checked 1 config; generated User/xrobot_main.hpp for User/xrobot.yaml
```

The build uses `starm-clang`; the firmware is `build/debug/BluePill.elf`, with `BluePill.hex` and `BluePill.bin` in the same directory. The board, the configurations and flashing are described in the README of the BSP.

## Starting from an STM32CubeMX Project

After configuring the peripherals in STM32CubeMX and exporting a CMake project (the requirements are listed in [STM32 Code Generation](./code_gen/stm32/README.md#project-requirements)), run in the project root:

```bash
libxr stm32 setup -d .
```

This command adds LibXR as a submodule, generates the entry source `app_main.cpp` and the related files under `User/`, and adds LibXR to the project's CMake build. While no source file calls `app_main()` yet, the end of the output names the place for the call and the build command (excerpt):

```text
[INFO] Generated User: wrote app_main.cpp, app_main.h, flash_map.hpp, libxr_config.yaml
[INFO] Generated LibXR.CMake at: cmake/LibXR.CMake
[INFO] LibXR.CMake included in CMakeLists.txt.
[INFO] [Pass] All tasks completed.
[INFO] Next: #include "app_main.h" and call app_main() in the default task StartDefaultTask (Core/Src/main.c), inside USER CODE sections, which CubeMX keeps when it regenerates the code.
[INFO] Build: cmake --preset debug && cmake --build --preset debug
```

Call `app_main()` in the default task in `Core/Src/main.c` as the output says. The code goes inside the `USER CODE` regions, which STM32CubeMX keeps when it regenerates:

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

Then run the build command on the last line of the output. It is taken from the first preset in the project's `CMakePresets.json`; here it is:

```bash
cmake --preset debug && cmake --build --preset debug
```

A bare-metal project calls `app_main()` in `main()` after the peripherals are initialized; see [How to Use](./code_gen/stm32/README.md#how-to-use). The generated peripheral objects and the settings are described in [Code Generation](./code_gen/README.md).

## Creating a New BSP

Take a minimal BSP on Linux: an LED on line 17 of `/dev/gpiochip0`, blinked by the BlinkLED Module. The packages the host needs are listed in [Linux Environment Setup](./env_setup/linux.md).

### Creating the BSP

Create a directory, add the LibXR submodule, and create the BSP files with `xrobot init`:

```bash
mkdir blink && cd blink
git init
git submodule add https://github.com/xrobot-org/libxr.git libxr
xrobot init
```

`xrobot init` creates `Modules/modules.yaml`, `Modules/sources.yaml` and the configuration `User/xrobot.yaml`, and adds the generated files to `.gitignore`. The files are described in [BSP Layout](./proj_man/README.md#bsp-layout).

### CMake and the Entry Source

`CMakeLists.txt` sets `XROBOT_MODULES_DIR` before adding LibXR, so that LibXR adds the Modules and checks the generated header (see [CMake Integration](./proj_man/setup.md#cmake-integration)):

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

The entry source `User/main.cpp` constructs the BSP objects, registers the ones that configurations may use with `XR_REGISTER`, and enters the main function:

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

### Adding the Module and an Instance

```text
$ xrobot module add xrobot-org/BlinkLED@dev
Added xrobot-org/BlinkLED@dev; run `xrobot setup` to fetch it
$ xrobot setup
Resolved 1 Module commit
Checked 1 config; generated User/xrobot_main.hpp for User/xrobot.yaml
$ xrobot instance add xrobot-org/BlinkLED
Added blinkled_0 to User/xrobot.yaml; fill the null values (dependencies) before generating
  led (LibXR::GPIO&): LED_R
```

`xrobot setup` fetches the Module and locks it to a commit, recorded in `xrobot.lock`. `instance add` writes every constructor parameter with its source default; a dependency without a default is left empty (`null`, "not filled in"), and the registered objects it can take are listed. Fill the dependency `led` with the name of a registered BSP object:

```text
$ xrobot instance set blinkled_0 args.led LED_R
Set args.led of blinkled_0 in User/xrobot.yaml
```

`User/xrobot.yaml` then reads:

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

### Generating and Building

Generate `User/xrobot_main.hpp` from the configuration, build with the native tools, and run:

```bash
xrobot gen
cmake -S . -B build
cmake --build build
./build/blink
```

At run time the LED toggles every 250 ms. The configuration format, writing Modules and the other commands are described in [Project Management](./proj_man/README.md); in STM32 BSPs the entry source `User/app_main.cpp` is written by the code generator, see [Integrate with XRobot](./code_gen/xrobot_inter.md).
