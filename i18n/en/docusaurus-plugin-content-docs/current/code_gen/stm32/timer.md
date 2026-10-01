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

For RTOS environments, you need to provide thread priority and stack depth:

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

For non-bare-metal systems, the following configuration will be generated in `User/libxr_config.yaml`:

```yaml
software_timer:
  priority: 2
  stack_depth: 1024
```

You can modify this file directly. To apply updated settings, run `libxr stm32 setup -d .` or  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp` to regenerate the code.
