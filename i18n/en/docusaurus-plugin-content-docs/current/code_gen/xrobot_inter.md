---
id: code-gen-xrobot-inter
title: Integrate with XRobot
sidebar_position: 5
---

# Integrate with XRobot

With `--xrobot`, the code generator writes one `XR_REGISTER(name, Type)` line per generated peripheral object into `app_main.cpp` and calls `XROBOT_MAIN();` after the User Code 3 region. With `--no-xrobot`, no XRobot code is generated; with neither, `libxr gen` and `libxr stm32 setup` keep the choice of the existing `app_main.cpp`, and a new project gets no XRobot code. Configurations refer to hardware by these names; see [Project Management (XRobot)](../proj_man/README.md).

When an existing project switches to `--xrobot` and User Code 3 still holds the default loop generated without `--xrobot`, regeneration empties the loop, so that the `XROBOT_MAIN()` after it runs; any other content of User Code 3 is kept.

## Example

```bash
libxr stm32 setup -d . --xrobot
# or regenerate only app_main.cpp:
libxr parse -d . -o .config.yaml
libxr gen -i .config.yaml -o User/app_main.cpp --xrobot --libxr-config User/libxr_config.yaml
```

`app_main.cpp` generated for an STM32F407 project (excerpt; omitted lines are marked `// ...`):

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

The registered name is the generated C++ object name. The table gives the registered name and type of each kind of object, in the order the generated code registers them:

| Object | Registered name | Type |
| --- | --- | --- |
| Power manager | `power_manager` | `LibXR::PowerManager` |
| GPIO pin | The CubeMX pin label, or the pin name without a label, such as `USER_KEY` or `PA8` | `LibXR::GPIO` |
| ADC channel | `<ADC instance>_<channel>`, such as `adc3_adc_channel_8`; when a channel is configured in several Ranks, the later names carry a `_rank<N>` suffix | `LibXR::ADC` |
| DAC output | `<DAC instance>_<output>`, such as `dac1_out2`; `dac_out2` when the instance is named `DAC` | `LibXR::DAC` |
| PWM channel | `pwm_<timer>_ch<channel>`, such as `pwm_tim1_ch1`; `pwm_tim1_ch1n` for a complementary output | `LibXR::PWM` |
| SPI | The lower-case instance name, such as `spi1` | `LibXR::SPI` |
| Hardware UART (USART, UART, LPUART) | The lower-case instance name, such as `usart1` or `uart7` | `LibXR::UART` |
| USB CDC | `<USB instance>_cdc`, `<USB instance>_cdc2` and so on, such as `usb_otg_fs_cdc` | `LibXR::UART` |
| I2C | The lower-case instance name, such as `i2c1` | `LibXR::I2C` |
| CAN | The lower-case instance name, such as `can1`; each FDCAN instance also gets a reference `canN` (`LibXR::CAN& canN = fdcanN;`) | `LibXR::CAN` |
| FDCAN | The lower-case instance name, such as `fdcan1` | `LibXR::FDCAN` |
| Independent watchdog | The lower-case instance name, such as `iwdg` or `iwdg1` | `LibXR::Watchdog` |
| RamFS | `ramfs`, generated when `terminal_source` names a generated serial port | `LibXR::RamFS` |
| Terminal | `terminal`, generated together with `ramfs` | `LibXR::Terminal<...>`, whose template arguments are the first four `Terminal` settings, such as `LibXR::Terminal<32, 32, 5, 5>` |
| Database | `database`, generated when `database.enable` is `true`; see [Flash Database](./stm32/flash.md) | `LibXR::Database` |

- One name registers one type, and generation fails when generated names collide, for example `canN` on a chip with both CAN and FDCAN.
- To register more objects (for example an extra serial port created in User Code 3), write `XR_REGISTER` in User Code 3; that code is kept on regeneration.
- `XROBOT_MAIN();` is owned by the generator. Older versions placed it in User Code 3; if a User Code region still calls it, the generator reports the line and stops without writing anything. Delete that line and regenerate.

`libxr stm32 cmake` and `libxr stm32 setup` add or remove `set(XROBOT_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/Modules")` in the “Project settings” block at the top of `cmake/LibXR.CMake` according to whether `User/app_main.cpp` was generated with `--xrobot`; an added line goes after `set(LIBXR_DRIVER st)`. `libxr gen` on its own does not change this file.

## Generator Version

`generator:` at the top level of `User/libxr_config.yaml` pins the code generator (a release version or a 40-hex commit); BSP CI installs that version. When the generator creates this file, its first line holds the installed version, e.g. `generator: 6.0.0`; regeneration keeps the key and the file's comments. When an existing file has no such key, `libxr gen` warns and generates as usual:

```text
[WARNING] libxr_config.yaml does not pin the generator; add `generator: 6.0.0` (the BSP CI installs the pinned version)
```

## After Generation

`libxr stm32 setup -d . --xrobot` writes the registrations and `XROBOT_MAIN();` into the entry source and sets the Modules directory in `cmake/LibXR.CMake`; the files under `Modules/` and `User/xrobot.yaml` are created by XRobot. When the BSP root has no `Modules/modules.yaml` yet, XRobot is set up in the following order. The example adds the BlinkLED Module for an LED on the pin labeled `LED_B`:

```bash
xrobot init                                     # create Modules/modules.yaml, Modules/sources.yaml and User/xrobot.yaml
xrobot module add xrobot-org/BlinkLED@dev       # add the Module
xrobot setup                                    # fetch Modules, check configs, generate User/xrobot_main.hpp
xrobot instance add xrobot-org/BlinkLED         # add the instance blinkled_0
xrobot instance set blinkled_0 args.led LED_B   # fill the dependency with a registered name
xrobot gen                                      # regenerate User/xrobot_main.hpp
```

The output of each command is shown in [Quick Start](../quick_start.md#creating-a-new-bsp). A Module dependency of type `LibXR::RamFS&` needs `terminal_source` set in `User/libxr_config.yaml` (or `-t` passed to `libxr stm32 setup`), and one of type `LibXR::Database&` needs `database.enable: true`. After the change, running `libxr stm32 setup -d .` again generates and registers `ramfs` or `database`. Without these settings `xrobot instance add` finds no object to fill in for such dependencies.

`User/xrobot_main.hpp` is generated by XRobot; see [Main Function Generation](../proj_man/gen_main.md).
