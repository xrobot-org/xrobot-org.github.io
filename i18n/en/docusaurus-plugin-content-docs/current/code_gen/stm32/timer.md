---
id: stm32-code-gen-timer
title: Software Timer
sidebar_position: 3
---

# Software Timer

LibXR provides a lightweight software timer that can even be used in bare-metal environments.

For non-bare-metal environments (e.g., with an RTOS), the software timer requires specifying thread priority and stack depth.

## Example

For bare-metal systems, the following code will be generated without any parameters:

```cpp
PlatformInit();
```

In RTOS projects, the thread priority and stack depth are passed:

```cpp
PlatformInit(2, 1024);
```

The first parameter is the thread priority, and the second is the stack depth.

Thread priorities are defined as follows:

```cpp
  enum class Priority : uint8_t
  {
    IDLE = 0,      ///< Idle priority
    LOW = 1,       ///< Low priority
    MEDIUM = 2,    ///< Medium priority
    HIGH = 3,      ///< High priority
    REALTIME = 4,  ///< Realtime priority
    NUMBER = 5     ///< Number of priority levels
  };
```

## Configuration File

`software_timer` in `User/libxr_config.yaml` sets these two arguments; bare-metal projects do not use it:

```yaml
software_timer:
  priority: 2
  stack_depth: 1024
```

The file can be edited directly. To apply the settings, regenerate the code with either command:  
`libxr stm32 setup -d .`  
or  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
