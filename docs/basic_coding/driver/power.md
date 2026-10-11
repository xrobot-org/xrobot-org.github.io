---
id: power
title: 电源管理
sidebar_position: 10
---

# Power（电源管理）

`LibXR::PowerManager` 提供统一的电源管理接口，适用于实现系统复位、关机或进入低功耗模式等功能，供平台或电源控制驱动实现。

## 接口定义

```cpp
class PowerManager {
public:
  PowerManager() = default;
  virtual ~PowerManager() = default;

  // 系统复位操作（由子类实现具体逻辑）
  virtual void Reset() = 0;

  // 系统关机操作（由子类实现具体逻辑）
  virtual void Shutdown() = 0;

  // 跳转到启动加载器（默认退化为 Reset）
  virtual void JumpToBootloader() { Reset(); }

  // 在 RamFS 根目录注册 power 命令
  void RegisterCommand(RamFS& ramfs);

  // 读一次引脚，电平等于 level 时进入启动加载器
  void CheckBootloaderPin(GPIO& pin, bool level);
};
```

## 使用说明

- `Reset()` 可用于软复位控制器、重新启动系统等；
- `Shutdown()` 用于关机、掉电、进入睡眠等低功耗控制；
- `JumpToBootloader()` 默认会退化为 `Reset()`，平台实现可按需改为真正的 Bootloader 跳转；
- `RegisterCommand(ramfs)` 在 RamFS 根目录注册 `power` 命令（见[内存文件系统](../middleware/ramfs.md)）：终端中 `power reset`、`power shutdown`、`power bootloader` 分别调用上述三个方法，不带参数或参数不认识时打印用法并返回 -1。命令文件在第一次注册时分配，之后不释放，同一个对象只注册一次；
- `CheckBootloaderPin(pin, level)` 读一次引脚，电平等于 `level` 时调用 `JumpToBootloader()`，否则直接返回；在初始化早期调用一次，按住该引脚对应的按键再复位即可进入启动加载器，运行中该引脚仍归程序使用。引脚的输入方向和上下拉由工程配置决定，本函数不修改；悬空的引脚可能误触发；
- 可用于平台的电源按钮、远程命令、低电量策略等情境；
- 由具体平台实现其底层行为，接口保持一致，便于移植与抽象封装。

## 平台实现

MSPM0 的 `MSPM0PowerManager` 中，`Reset()` 触发 boot 配置流程，复位绝大部分核内逻辑并给 SRAM 重新上电，效果等同整机重新从 Flash 启动；`Shutdown()` 进入 SHUTDOWN 模式，由 NRST、SWD 活动或配置了唤醒功能的 IO 唤醒，退出 SHUTDOWN 触发 BOR，唤醒后等同一次复位重启；`JumpToBootloader()` 复位进入 ROM BSL，复位前按 SDK 示例清零 SRAM 的数据与 ECC 码，规避 `BSL_ERR_01`。MSPM0 的 ROM BSL 走串口，因此 `power bootloader` 之后可以用串口烧录固件。

HPM 的 `HPMPowerManager` 中，`Reset()` 使能 PPOR 软件复位源后触发复位；`Shutdown()` 在带 PDGO 的 SoC 上设置关断计数后等待断电，由 RESETN 引脚唤醒，没有 PDGO 的 SoC 退化为关中断后执行 WFI；`JumpToBootloader()` 关中断后调用 ROM API 进入 ROM ISP，外设由 ROM 自动探测，调用正常不返回，返回时复位整机。经 USB 的 ROM ISP 在 HPM5301 和 HPM5361 上未能枚举。

## 说明

- `PowerManager` 提供 `Reset()`、`Shutdown()`、`JumpToBootloader()` 三个平台接口，以及 `RegisterCommand()`、`CheckBootloaderPin()` 两个由基类实现的通用接口。
- 状态查询、事件回调、低功耗级别等由具体平台实现或上层代码提供。
