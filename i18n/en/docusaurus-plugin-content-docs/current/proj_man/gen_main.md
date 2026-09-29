---
id: proj-man-gen-main
title: Entry and Generation
sidebar_position: 3
---

# Entry and Generation

`xrobot gen` reads the selected application configuration, the registrations in the entry source and the locked Module headers, and writes `User/xrobot_main.hpp`. The result is ordinary C++: one `XRobotMain` function that constructs static instances in configuration order and then runs the monitor loop. There is no runtime hardware container, name lookup or application manager.

---

## Entry Source

Exactly one source file under `User/` calls `XROBOT_MAIN()`. It includes the generated header, constructs the BSP objects, registers the objects configurations may use with `XR_REGISTER(name, Type)`, and finally calls `XROBOT_MAIN()`:

```cpp
#include "xrobot_main.hpp"

extern "C" void app_main()
{
  // ... platform init, construct BSP objects ...
  XR_REGISTER(LED_R, LibXR::GPIO);
  XR_REGISTER(spi1, LibXR::SPI);
  XR_REGISTER(can1, LibXR::CAN);
  XROBOT_MAIN();
}
```

Rules:

- One name registers one type. To offer the same object as another type, declare a reference and register it separately:

  ```cpp
  LibXR::CAN& can1 = fdcan1;
  XR_REGISTER(fdcan1, LibXR::FDCAN);
  XR_REGISTER(can1, LibXR::CAN);
  ```

- Register object types, not reference types. Names must be unique and cannot be C++ keywords or macro names.
- `XR_REGISTER` cannot appear inside `#if` / `#ifdef` blocks; the generator does not evaluate build options.
- Registered objects must be visible where `XROBOT_MAIN()` is called and must live as long as the application.
- Only the registrations the selected product uses are passed to `XRobotMain`; the others are still type-checked and cause no unused-variable warnings.

In STM32 BSPs these lines are written by `xr_gen_code_stm32 --xrobot`; see [Integrate with XRobot](../code_gen/xrobot_inter.md).

---

## The Generated Header

```bash
xrobot gen                                # the selected product
xrobot gen -c User/RobotConfig/hero.yaml  # select another product
```

For BlinkLED, the main parts of the generated file:

```cpp
#pragma once
// xrobot: config "xrobot.yaml"
// xrobot: depends "../xrobot.lock"
// xrobot: depends "main.cpp"
// xrobot: depends "../Modules/xrobot-org/BlinkLED/BlinkLED.hpp"

#include "libxr.hpp"
#include "BlinkLED.hpp"

[[noreturn]] static inline void XRobotMain(
    LibXR::GPIO& LED_R)
{
  // modules[0]: status_led
  static BlinkLED status_led(
      LED_R
      , xrobot_generated::Implicit<uint32_t>(250)
  );
  for (;;)
  {
    LibXR::Thread::Sleep(1000);
  }
}

#define XR_REGISTER(name, ...) static_cast<void>(name)
#define XROBOT_MAIN() ::XRobotMain(LED_R)
```

(`#line` directives and helper definitions are omitted.)

- The leading `// xrobot:` lines record the configuration and every input generation read (lock, entry source, Module headers).
- Instances are function-local `static` objects, constructed in configuration order when `XRobotMain` runs. Constructors do all initialization; there is no extra `Init()`/`Start()` phase.
- The loop calls each instance's public `void OnMonitor()` (where one exists) in configuration order, then sleeps `settings.monitor_sleep_ms` milliseconds. `XROBOT_MAIN()` does not return and runs in the calling thread.
- An unchanged result is not rewritten. Do not edit or commit the file.

---

## Build Check

When the BSP sets `XROBOT_MODULES_DIR`, LibXR's CMake:

- fails configuration when `User/xrobot_main.hpp` is missing, suggesting `xrobot setup` or `xrobot gen -c <config>`;
- prints `XRobot product: <config>` during configuration;
- compares timestamps on every build and fails if any input is newer than the header or no longer exists, naming the `xrobot gen -c <config>` command to run.

CMake only checks; it never regenerates. Run `xrobot gen` after changing a configuration, the entry source or a Module; run `xrobot setup` after changing `modules.yaml`.

---

## IDE

The generated file keeps the path the build uses. Point the language server at the `compile_commands.json` produced by the BSP's actual build.
