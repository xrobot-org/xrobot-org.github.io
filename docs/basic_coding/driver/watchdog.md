---
id: watchdog
title: 看门狗
sidebar_position: 12
---

# Watchdog（看门狗）

`LibXR::Watchdog` 提供通用看门狗（Watchdog）抽象接口，支持配置溢出时间、自动喂狗周期等参数，并提供启动、停止和手动喂狗等控制接口，适配多线程和定时任务等不同运行环境。

现有后端（`STM32Watchdog`、`ESP32Watchdog`）中，`SetConfig()` 设置溢出时间，并把 `feed_ms` 记为自动喂狗间隔 `auto_feed_interval_ms`（要求 `0 < feed_ms <= timeout_ms`，否则返回 `ARG_ERR`）；`Start()` 启动看门狗并置位 `auto_feed_`，`Stop()` 清除 `auto_feed_`。两个后端的构造函数已调用 `SetConfig()` 和 `Start()`。

## 接口概览

### 配置结构体

```cpp
struct Configuration {
  uint32_t timeout_ms;  // 看门狗溢出时间（毫秒）
  uint32_t feed_ms;     // 自动喂狗周期（毫秒）
};
```

### 构造与配置

```cpp
Watchdog();
virtual ~Watchdog();

virtual ErrorCode SetConfig(const Configuration& config) = 0;
```

### 控制接口

```cpp
virtual ErrorCode Start() = 0;
virtual ErrorCode Stop() = 0;
virtual ErrorCode Feed() = 0;
```

### 自动喂狗辅助函数

```cpp
static void ThreadFun(Watchdog* wdg);
static void TaskFun(Watchdog* wdg);
```

- `ThreadFun`：用于线程环境中的自动喂狗循环；
- `TaskFun`：适用于定时轮询任务系统中的自动喂狗函数。

辅助函数的行为：

- `ThreadFun()` 会循环调用 `LibXR::Thread::Sleep(auto_feed_interval_ms)`，并在 `auto_feed_ == true` 时执行 `Feed()`；
- `TaskFun()` 不做循环，只在本次被调度时检查一次 `auto_feed_` 并决定是否 `Feed()`。

自动喂狗由运行 `ThreadFun()` 的线程，或由 `Timer` 周期调用的 `TaskFun()` 执行。STM32 IWDG 启动后不能关闭，`STM32Watchdog::Stop()` 返回 `NOT_SUPPORT` 并停止自动喂狗。

## 特性总结

- 支持设置溢出时间与自动喂狗周期；
- 提供手动 `Feed` 接口与自动喂狗辅助函数；
- 适用于多种嵌入式运行模型（如 RTOS 线程、定时任务）；
- 平台无关，便于在不同硬件平台上统一使用；
- 可扩展，派生类实现具体底层驱动逻辑。
