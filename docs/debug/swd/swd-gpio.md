---
id: swd-gpio
title: SWD GPIO实现
sidebar_position: 2
---

# SWD GPIO实现

`LibXR::Debug::SwdGeneralGPIO<SwclkGpioType, SwdioGpioType, IO_DRIVE_MODE, TimebaseType>` 是基于 GPIO 轮询（bit-bang）的 SWD 探针实现，继承自 `LibXR::Debug::Swd`，提供 SWD 链路层能力，供 CMSIS-DAP 等上层调用。

## 1. 硬件连接与引脚能力

`SwdGeneralGPIO` 使用两根 GPIO 实现 SWD：

- SWCLK：由 `SwclkGpioType` 驱动输出时钟；
- SWDIO：由 `SwdioGpioType` 承担双向数据，运行时在输出驱动与输入采样之间切换。

推荐外围电路：

- SWCLK 与 SWDIO 各串联 33 Ω 限流电阻（抑制振铃）；
- SWDIO 端接 10 kΩ 上拉电阻。

类定义：

```cpp
template <typename SwclkGpioType, typename SwdioGpioType,
          SwdIoDriveMode IO_DRIVE_MODE = SwdIoDriveMode::PUSH_PULL,
          typename TimebaseType = Timebase>
class SwdGeneralGPIO final : public Swd;
```

`TimebaseType` 须继承自 `LibXR::Timebase` 并提供静态函数 `BusyLoop()`；默认 `Timebase` 使用通用循环，平台时基类可提供专属实现。`SwclkGpioType` 与 `SwdioGpioType` 需支持 `SetConfig({Direction, Pull})`、`Write(bool)` 和 `Read() -> bool`：

- 输入采样使用 `Direction::INPUT` 与 `Pull::UP`；
- 输出驱动由 `IO_DRIVE_MODE` 决定：`SwdIoDriveMode::PUSH_PULL` 对应 `OUTPUT_PUSH_PULL`，`SwdIoDriveMode::OPEN_DRAIN` 对应 `OUTPUT_OPEN_DRAIN`。

板上已有外部上拉时可选开漏输出，无外部上拉时使用推挽输出。在部分 MCU 上，SWDIO 切换为输出方向后需要若干个 CPU 周期才写入外设寄存器并生效，高速 bit-bang 下 `GpioType::SetConfig` 须计入这一延迟。

## 2. 构造与使用

```cpp
explicit SwdGeneralGPIO(SwclkGpioType& swclk, SwdioGpioType& swdio, uint32_t cpu_hz,
                        const SwdGpioTiming& timing,
                        uint32_t default_hz = DEFAULT_CLOCK_HZ);
```

构造时把 SWCLK 配为推挽输出高电平，SWDIO 配为驱动高电平，并调用 `SetClockHz(default_hz)`（默认 500 kHz）。使用步骤如下：

1. 用当前 CPU 主频 `cpu_hz` 和标定好的 `SwdGpioTiming` 构造探针实例；
2. 对目标执行 `EnterSwd()`；
3. 通过 `Swd` 基类的带重试事务接口（如 `DpReadTxn`、`ApReadTxn`）进行传输。

```cpp
using Probe = LibXR::Debug::SwdGeneralGPIO<
    MyGpio, MyGpio, LibXR::Debug::SwdIoDriveMode::PUSH_PULL, MyTimebase>;

constexpr LibXR::Debug::SwdGpioTiming TIMING{16.9f, 9.0f, 11.4f};
MyGpio swclk, swdio;

Probe probe(swclk, swdio, /*cpu_hz=*/144'000'000, TIMING, /*default_hz=*/500'000);
probe.EnterSwd();

uint32_t idcode = 0;
LibXR::Debug::SwdProtocol::Ack ack;
probe.ReadIdCode(idcode, ack);
```

## 3. 时钟控制与 `SwdGpioTiming`

`SetClockHz(hz)` 设置目标 SWCLK 频率：

- 非零 `hz` 钳制到 50 kHz～100 MHz（`MIN_HZ`～`MAX_HZ`）；
- `hz == 0` 或 `cpu_hz == 0` 时，半周期延时循环次数 `half_period_loops_` 为 0，直接进入无延时路径，实际 SWCLK 频率由平台 GPIO 翻转速率决定。

`SwdGpioTiming` 以 CPU 周期数为单位描述时序模型，与 CPU 主频无关：

- 带延时路径（每次半周期执行 `N >= 1` 次 `TimebaseType::BusyLoop()`）：一个 SWCLK 周期耗时 `a + b·N` 个 CPU 周期；
- 无延时路径（`N = 0`）：一个 SWCLK 周期耗时 `c` 个 CPU 周期。

```cpp
constexpr SwdGpioTiming();  // 保守默认：b = 2, a = 0, c = 1

template <std::floating_point Step, std::floating_point Intercept,
          std::floating_point Fast>
consteval SwdGpioTiming(Step step_cycles, Intercept intercept_cycles, Fast fast_cycles);
```

构造函数在编译期把参数（可带小数，范围 0～100000 周期）按十分之一周期量化为整数保存，运行时全部使用整数运算。`DelayLoops(cpu_hz, hz)` 的选档规则如下：

- 当请求频率满足 `f >= f_cpu / c` 时返回 `0`（无延时路径不超速）；
- 否则在 `N >= 1` 中选取每周期耗时 `a + b·N` 最接近 `f_cpu / f` 的档位；两档距离相等时取较慢的一档。

由于只传入一组系数，`SwdGpioTiming` 仅对标定时所用的那个 `TimebaseType`、编译器及优化选项有效；默认构造函数 `SwdGpioTiming{}` 取保守值（`b = 2, a = 0, c = 1`），未标定平台上实际频率通常明显低于设定值。

## 4. 标定方法

标定须在与目标固件相同的编译器版本、优化等级（如 `-O2`/`-Os`/`-O3`、LTO 开关）和 `TimebaseType` 下进行，因为 `BusyLoop()` 每次迭代的周期数与这些条件直接相关。

1. 固定若干组延时循环次数（例如 `N = 0, 1, 2, 4, 8, 16`），用示波器或逻辑分析仪分别测出读数据相、写数据相和请求字节下的 SWCLK 频率，结合 `cpu_hz` 换算为每 SWCLK 周期的 CPU 周期数；
2. 对 `N >= 1` 的测得值做线性拟合 `a + b·N`，得到典型斜率 `step_cycles`（`b`）与截距 `intercept_cycles`（`a`）；
3. 取 `N = 0` 时各路径的典型值作为 `fast_cycles`（`c`）；
4. 构造 `constexpr SwdGpioTiming{step_cycles, intercept_cycles, fast_cycles}` 传入 `SwdGeneralGPIO`。

## 5. 频率选择与故障排查

初期联调可从 100 kHz～500 kHz 起步，链路稳定后再按 1 MHz、2 MHz、4 MHz 逐档上调；更高频率需确认走线长度、33 Ω 串阻、SWDIO 上拉和目标板驱动能力。

若频繁出现 `WAIT`/`FAULT`/`NO_ACK`、读回奇偶校验错误或随线长随机失败，按以下顺序排查：

1. 降低 `SetClockHz()` 频率；
2. 检查 33 Ω 串阻、SWDIO 10 kΩ 上拉与接地质量；
3. 用示波器观察 SWCLK/SWDIO 边沿振铃与回落时间；
4. 若切换过编译选项或 `TimebaseType`，重新标定 `SwdGpioTiming`。

## 6. 关闭与安全态

调用 `Close()` 会将内部 SELECT 缓存置为无效，并把探针引脚恢复到安全状态：

- SWCLK 输出高电平；
- SWDIO 切换为上拉输入（停止驱动）。
