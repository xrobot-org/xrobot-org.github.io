---
id: stm32-code-gen-timer
title: Software Timer
sidebar_position: 3
---

# Software Timer

LibXR provides a lightweight software timer that can even be used in bare-metal environments.

With FreeRTOS and ThreadX, the software timer runs in a thread of its own, which needs a thread priority and a stack depth.

## Example

For bare-metal systems, the following code will be generated without any parameters:

```cpp
PlatformInit();
```

In FreeRTOS and ThreadX projects, the thread priority and stack depth are passed:

```cpp
PlatformInit(static_cast<uint32_t>(LibXR::Thread::Priority::MEDIUM), 1024);
```

## Thread Priority

The generated code expresses thread priorities as levels of `LibXR::Thread::Priority`, from low to high `IDLE`, `LOW`, `MEDIUM`, `HIGH` and `REALTIME`. The software timer, the terminal thread and the watchdog thread all use this form.

LibXR converts the levels to RTOS priorities by the RTOS priority count. On FreeRTOS the step is `(configMAX_PRIORITIES - 1) / 5`; `IDLE` is 0 and `LOW` to `REALTIME` are 1 to 4 steps. With a `configMAX_PRIORITIES` of 7, for example, `MEDIUM` is 2, and with 56 (the CubeMX default for CMSIS_V2) it is 22. On ThreadX lower numbers are higher priorities: `REALTIME` is 1 and `HIGH` to `IDLE` are 1 to 4 steps, the step being `(TX_MAX_PRIORITIES - 1) / 5`.

## Configuration File

`software_timer` in `User/libxr_config.yaml` sets these two arguments; bare-metal projects do not use it:

```yaml
software_timer:
  priority: 2
  stack_depth: 1024
```

`priority` takes 0 to 4 or a level name in any case; 0 to 4 stand for `IDLE`, `LOW`, `MEDIUM`, `HIGH` and `REALTIME`, and the default is 2 (`MEDIUM`). Any other value stops generation. The `thread_priority` of the terminal and the watchdog takes the same values.

The file can be edited directly. To apply the settings, regenerate the code with either command:  
`libxr stm32 setup -d .`  
or  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
