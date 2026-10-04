---
id: stm32-code-gen-timer
title: 软件定时器
sidebar_position: 3
---

# 软件定时器

LibXR实现了一个轻量级的软件定时器，即使在裸机环境下也可以使用。

在 FreeRTOS 和 ThreadX 中，软件定时器运行在独立线程中，需要指定线程优先级和栈深度。

## 示例

裸机环境下会生成以下代码，不需要传入任何参数：

```cpp
PlatformInit();
```

FreeRTOS 和 ThreadX 工程中传入线程优先级和栈深度：

```cpp
PlatformInit(static_cast<uint32_t>(Thread::Priority::MEDIUM), 1024);
```

## 线程优先级

生成的代码用 `LibXR::Thread::Priority` 的等级表示线程优先级，从低到高依次为 `IDLE`、`LOW`、`MEDIUM`、`HIGH` 和 `REALTIME`。软件定时器、终端线程和看门狗线程都使用这种写法。

LibXR 按 RTOS 的优先级数把等级换算为 RTOS 优先级。FreeRTOS 中步长为 `(configMAX_PRIORITIES - 1) / 5`，`IDLE` 为 0，`LOW` 到 `REALTIME` 依次为步长的 1 到 4 倍。例如 `configMAX_PRIORITIES` 为 7 时 `MEDIUM` 是 2，为 56（CubeMX 中 CMSIS_V2 的默认值）时 `MEDIUM` 是 22。ThreadX 中数值越小优先级越高，`REALTIME` 为 1，`HIGH` 到 `IDLE` 依次为步长的 1 到 4 倍，步长为 `(TX_MAX_PRIORITIES - 1) / 5`。

## 配置文件

`User/libxr_config.yaml` 中的 `software_timer` 设置这两个参数，裸机环境下不使用：

```yaml
software_timer:
  priority: 2
  stack_depth: 1024
```

`priority` 写 0 到 4 或等级名（大小写不限），0 到 4 依次对应 `IDLE`、`LOW`、`MEDIUM`、`HIGH` 和 `REALTIME`，默认为 2（`MEDIUM`）。其他值使生成失败。终端和看门狗的 `thread_priority` 写法相同。

修改该文件后重新生成代码，命令见[重新生成代码](./README.md#重新生成代码)。
