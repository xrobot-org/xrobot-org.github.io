---
id: stm32-code-gen-watchdog
title: 看门狗
sidebar_position: 13
---

# 看门狗

生成器为 CubeMX 中启用的独立看门狗（IWDG）生成 `STM32Watchdog` 对象和自动喂狗代码。喂狗可以由软件定时器任务完成，也可以由独立线程完成。

## 看门狗代码示例

以下代码来自 STM32F407 工程。生成的代码在终端和数据库之后的 `// Watchdog` 一节中创建看门狗对象：

```cpp
  static STM32Watchdog iwdg(&hiwdg, 1000, 250);
```

构造函数的参数是 HAL 句柄、溢出时间和喂狗间隔（毫秒）。构造函数按 LSI 时钟计算分频和重载值，在 IWDG 带窗口功能的系列上关闭窗口，然后调用 `HAL_IWDG_Init()` 写入配置并启动看门狗。

随后是首次喂狗和定时器任务，默认每 250 ms 喂狗一次：

```cpp
  iwdg.Feed();
  static auto iwdg_task =
      Timer::CreateTask(iwdg.TaskFun, reinterpret_cast<LibXR::Watchdog*>(&iwdg), 250);
  Timer::Add(iwdg_task);
  Timer::Start(iwdg_task);
```

`Watchdog.run_as_thread` 为 `true` 时，喂狗改由独立线程完成：

```cpp
  iwdg.Feed();
  static Thread iwdg_thread;
  iwdg_thread.Create(reinterpret_cast<LibXR::Watchdog*>(&iwdg), iwdg.ThreadFun,
                     "iwdg_wdg", 1024, Thread::Priority::HIGH);
```

## 配置文件说明

以下片段来自同一工程的 `User/libxr_config.yaml`：

```yaml
IWDG:
  iwdg:
    timeout_ms: 1000
    feed_interval_ms: 250
Watchdog:
  run_as_thread: false
  feed_interval_ms: 250
```

`IWDG` 下每个实例的 `timeout_ms` 和 `feed_interval_ms` 是构造函数的溢出时间和喂狗间隔，默认 1000 ms 和 250 ms，喂狗间隔不能大于溢出时间。

`Watchdog` 下的设置对所有 IWDG 实例生效：

- `run_as_thread`：为 `true` 时用独立线程喂狗，线程按实例的 `feed_interval_ms` 循环喂狗，另外写入 `thread_stack_depth`（默认 1024）和 `thread_priority`（默认 3，即 `HIGH`，见[软件定时器](./timer.md)）；
- `feed_interval_ms`：定时器任务的喂狗周期，默认 250 ms。

修改该文件后重新生成代码，命令见[重新生成代码](./README.md#重新生成代码)。

## 注意事项

STM32CubeMX 生成的 `MX_IWDG_Init()` 保持生成和调用。它在 `main()` 中按 CubeMX 设置的分频和重载值调用 `HAL_IWDG_Init()`，IWDG 从此开始计数。IWDG 启动后只能由复位停止；`STM32Watchdog::Stop()` 只停止自动喂狗，返回 `ErrorCode::NOT_SUPPORT`。

`STM32Watchdog` 的构造函数再次调用 `HAL_IWDG_Init()`，用 `timeout_ms` 对应的分频和重载值替换 CubeMX 的设置，并重载计数器。F0、F3、F7、G0、G4、H7、L0 等系列的 IWDG 带窗口功能（HAL 定义了 `IWDG_WINDOW_DISABLE`），构造函数同时关闭窗口，任何时刻喂狗都有效；F1、F4 的 IWDG 没有窗口。

构造函数执行之前没有代码喂狗。CubeMX 中设置的溢出时间需长于从 `MX_IWDG_Init()` 到构造函数之间的启动过程，包括数据库首次初始化时擦除 Flash 扇区的时间。
