---
id: stm32-code-gen-watchdog
title: 看门狗
sidebar_position: 12
---

# 看门狗

生成器为 CubeMX 中启用的独立看门狗（IWDG）生成 `STM32Watchdog` 对象和自动喂狗代码。喂狗可以由软件定时器任务完成，也可以由独立线程完成。

## 看门狗代码示例

以下代码来自 STM32F746 工程。外设对象部分生成看门狗对象：

```cpp
static STM32Watchdog iwdg(&hiwdg, 1000, 250);
```

构造函数的参数是 HAL 句柄、溢出时间和喂狗间隔（毫秒）。构造函数按 LSI 时钟计算分频和重载值，然后启动看门狗。

终端配置之后生成首次喂狗和定时器任务，默认每 250 ms 喂狗一次：

```cpp
iwdg.Feed();
static auto iwdg_task = Timer::CreateTask(iwdg.TaskFun, reinterpret_cast<LibXR::Watchdog *>(&iwdg), 250);
Timer::Add(iwdg_task);
Timer::Start(iwdg_task);
```

`Watchdog.run_as_thread` 为 `true` 时，喂狗改由独立线程完成：

```cpp
iwdg.Feed();
static LibXR::Thread iwdg_thread;
iwdg_thread.Create(reinterpret_cast<LibXR::Watchdog *>(&iwdg), iwdg.ThreadFun, "iwdg_wdg", 1024,
                    static_cast<LibXR::Thread::Priority>(3));
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

- `run_as_thread`：为 `true` 时用独立线程喂狗，线程按实例的 `feed_interval_ms` 循环喂狗，另外写入 `thread_stack_depth`（默认 1024）和 `thread_priority`（默认 3）；
- `feed_interval_ms`：定时器任务的喂狗周期，默认 250 ms。

## 生成代码命令

修改 `libxr_config.yaml` 后，重新生成代码：

```bash
libxr gen -i ./.config.yaml -o ./User/app_main.cpp
```

## 注意事项

STM32CubeMX 生成的 `MX_IWDG_Init()` 会直接使能看门狗，之后除复位外无法关闭和重新配置。可以在 CubeMX 的 Project Manager → Advanced Settings 中取消该函数的生成和调用，由 `STM32Watchdog` 的构造函数完成初始化。
