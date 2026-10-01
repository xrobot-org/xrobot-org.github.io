---
id: stm32-code-gen-timer
title: 软件定时器
sidebar_position: 3
---

# 软件定时器

LibXR实现了一个轻量级的软件定时器，即使在裸机环境下也可以使用。

对于非裸机环境，软定时器需要指定线程优先级和堆栈深度。

## 示例

裸机环境下会生成以下代码，不需要传入任何参数：

```cpp
PlatformInit();
```

对于RTOS环境，需要传入线程优先级和堆栈深度:

```cpp
PlatformInit(2, 1024);
```

第一个参数为线程优先级，第二个参数为堆栈深度。

对于线程优先级有如下定义：

```cpp
  enum class Priority : uint8_t
  {
    IDLE = 0,      ///< 空闲优先级 Idle priority
    LOW = 1,       ///< 低优先级 Low priority
    MEDIUM = 2,    ///< 中等优先级 Medium priority
    HIGH = 3,      ///< 高优先级 High priority
    REALTIME = 4,  ///< 实时优先级 Realtime priority
    NUMBER = 5     ///< 优先级数量 Number of priority levels
  };
```

## 配置文件

对于非裸机环境，会在`User/libxr_config.yaml`中生成如下配置:

```yaml
software_timer:
  priority: 2
  stack_depth: 1024
```

可直接修改该文件。如需应用更新配置，请执行以下任一命令以重新生成代码：  
`libxr stm32 setup -d .`  
或  
`libxr gen -i ./.config.yaml -o ./User/app_main.cpp`
