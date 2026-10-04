---
id: swd-gpio
title: SWD GPIO实现
sidebar_position: 2
---

# SWD GPIO实现

`LibXR::Debug::SwdGeneralGPIO<SwclkGpioType, SwdioGpioType, SwdIoDriveMode>` 是一个基于 GPIO 轮询（bit-bang）的 SWD 探针实现。它继承自 `LibXR::Debug::Swd`，提供 SWD 链路层能力，通常由上层（如 CMSIS-DAP 处理器或调试器）调用。

重点放在使用方式和延时参数 `loops_per_us` 的选取/标定，不展开实现细节。

---

## 1. 总览

`SwdGeneralGPIO` 使用两根 GPIO 完成 SWD：

- SWCLK：由 `SwclkGpioType` 驱动输出时钟。
- SWDIO：由 `SwdioGpioType` 承担双向数据，运行时在“输出驱动”和“输入采样”之间切换。

时序由软件生成：通过目标时钟 `hz` 和延时标定系数 `loops_per_us` 计算“半周期应空转的循环次数”，从而逼近指定 SWCLK。

推荐外围电路：
- SWCLK/SWDIO 串联 33Ω（限流/抑制振铃）
- SWDIO 端接 10k 上拉

---

## 2. 模板参数与 GPIO 依赖能力

类定义：

```cpp
template <typename SwclkGpioType, typename SwdioGpioType,
          SwdIoDriveMode IO_DRIVE_MODE = SwdIoDriveMode::PUSH_PULL>
class SwdGeneralGPIO final : public Swd;
```

期望 GPIO 类型提供的最小能力（抽象描述）：
- `SetConfig({Direction, Pull}) -> ErrorCode`
- `Write(bool)`
- `Read() -> bool`

其中 SWDIO 需要支持：
- 输入采样：`Direction::INPUT` + `Pull::UP`
- 输出驱动由 `IO_DRIVE_MODE` 决定
  - `SwdIoDriveMode::PUSH_PULL` -> `OUTPUT_PUSH_PULL`
  - `SwdIoDriveMode::OPEN_DRAIN` -> `OUTPUT_OPEN_DRAIN`

输出模式的一般选择：

- 板上已有明确的外部上拉时，优先考虑开漏输出；
- 没有外部上拉时，优先考虑推挽输出。

SWDIO / SWCLK 的实际电气行为还受 GPIO 驱动能力、布线长度、阻尼电阻、探头负载和目标板输入结构影响。

---

## 3. 快速开始

构造函数：

```cpp
explicit SwdGeneralGPIO(SwclkGpioType& swclk,
                        SwdioGpioType& swdio,
                        uint32_t loops_per_us,
                        uint32_t default_hz = DEFAULT_CLOCK_HZ);
```

典型使用流程：
1) 初始化 GPIO 对象与探针实例（先给一个“保守”的频率与已标定的 `loops_per_us`）。
2) 对目标执行 `EnterSwd()`（不确定目标当前处于何种调试模式时建议调用）。
3) 上层用 `Swd` 基类的“带重试”接口进行传输（处理 WAIT、插入 idle clocks 等）。

示例：

```cpp
using Probe = LibXR::Debug::SwdGeneralGPIO<
    MyGpio, MyGpio, LibXR::Debug::SwdIoDriveMode::PUSH_PULL>;

MyGpio swclk, swdio;

// loops_per_us 建议先标定；default_hz 从保守值起步（如 100k~500k）
Probe probe(swclk, swdio, /*loops_per_us=*/calibrated, /*default_hz=*/500000);

probe.EnterSwd();

// 读取 DP IDCODE（ReadIdCode 不重试；带重试的事务接口见 Swd 基类的 DpReadTxn 等）
uint32_t idcode = 0;
LibXR::Debug::SwdProtocol::Ack ack;
probe.ReadIdCode(idcode, ack);
```

---

## 4. 时钟与延时参数（重点）

### 4.1 `hz` 的含义与行为

`SetClockHz(hz)` 用于设置“期望的 SWCLK 频率”。

- 非零的 `hz` 钳制到 50 kHz～100 MHz（`MIN_HZ`/`MAX_HZ`）；构造时默认 500 kHz（`DEFAULT_CLOCK_HZ`）。
- 频率是否“真的等于设定值”，取决于 `loops_per_us` 是否合理、GPIO 翻转速度、CPU 负载等。
- `hz == 0` 会使内部进入“无延时路径”（不主动插入 BusyLoop 延时），此时 SWCLK 实际频率由 CPU 与 GPIO 翻转速度决定，通常是“尽可能快”。

### 4.2 `loops_per_us` 是什么

`loops_per_us` 是一个“延时标定系数”：表示 BusyLoop 大约每 1 微秒需要的循环迭代次数。

它不是通用常量，通常会随以下因素显著变化：
- CPU 主频
- 编译优化等级（`-O0/-O2/-Os` 等）
- 是否开启 LTO、不同编译器版本
- 指令/总线等待状态（某些 MCU 在不同电源/时钟域下也可能变化）

只要上述条件变化，就应重新标定 `loops_per_us`。

### 4.3 何时会进入“无延时路径”

实际工作时有两种情况会进入“无延时路径”：
- `loops_per_us` 为 0；或
- 在某个较高的 `hz` 下，计算出来“半周期需要的循环次数 < 1”，内部会把半周期循环数置 0，从而自动走无延时路径。

无延时路径的意义：
- 优点：开销更低，吞吐更高。
- 代价：SWCLK 频率不再受 `hz` 精准约束，而是“尽可能快/尽可能稳定”，以平台极限为准。

工程建议：
- 需要“可控且可复现”的 SWCLK：让 `half_period_loops_` 明确大于 0（即 `loops_per_us` 标定合理，且 `hz` 不要设得过高）。
- 只追求“能跑、尽量快”：可以把 `loops_per_us=0`，或把 `hz` 调到足够高让系统自然进入无延时。

---

## 5. `loops_per_us` 的选择与标定方法

下面给出两种常用标定方法。标定应在与最终固件相同的编译选项和主频下进行。

### 方法 A：用硬件计时器/周期计数器标定

思路：执行一次已知循环次数的 BusyLoop，测出耗时，再反推 `loops_per_us`。

操作要点：
1) 选择足够大的循环次数 N（例如 1e6 级别），保证测量时间明显大于计时器分辨率。
2) 记录开始时间 t0，执行 BusyLoop(N)，记录结束时间 t1。
3) 计算耗时 `dt_us`（微秒）。
4) `loops_per_us ≈ N / dt_us`（取整即可）。

优点：不依赖 SWD 外设、也不依赖目标板状态；标定完成后频率可预期。

### 方法 B：用逻辑分析仪/示波器对 SWCLK 实测回归

思路：先给一个粗略的 `loops_per_us`，设置一个低到中等的 `hz`（例如 100 kHz 或 500 kHz），测 SWCLK 实际频率，再调整 `loops_per_us` 使之贴合。

操作要点：
1) 先用“可确保进入有延时路径”的配置（例如较低 `hz`）。
2) 测量 SWCLK 频率 `f_meas`。
3) 按比例调整：`loops_per_us_new ≈ loops_per_us_old * (f_meas / f_target)`，反复迭代 1~2 次即可收敛。

优点：不需要访问计时器资源；同时把 GPIO 翻转开销一并纳入拟合。  
已进入无延时路径（频率很高）时，调整 `loops_per_us` 不一定能回到有延时路径，此方法不适用。

---

## 6. 频率选择建议（实践导向）

建议从保守到激进逐步上调，避免一上来就把链路推到边界：

- 初始 bring-up：100 kHz ~ 500 kHz（更容易排查连线/电气问题）
- 稳定后提速：1 MHz、2 MHz、4 MHz 分档尝试
- 如果需要更高：优先确认走线长度、阻尼电阻、地参考与目标板 SWD 引脚驱动能力；然后再上调

当出现以下症状，通常意味着频率过高或信号完整性不足：
- ACK 频繁出现 WAIT/FAULT/NO_ACK
- 读回数据 parity 失败
- 只在某些线长/某些板子上不稳定

处理顺序建议：
1) 先降频；
2) 确认 33Ω 串阻与 SWDIO 上拉；
3) 缩短线缆/改善接地；
4) 再考虑重新标定 `loops_per_us`（尤其在改了优化选项之后）。

较高 SWCLK 频率下，边沿速度、振铃、过冲/下冲和回落时间都会影响 ACK 与采样稳定性。出现低频正常、高频随机失败时，用示波器检查 SWCLK / SWDIO 边沿。

---

## 7. 关闭与安全态

调用 `Close()` 会把探针引脚恢复到更安全的状态（用于退出调试或切换复用功能时）：
- SWCLK 置高
- SWDIO 切到输入上拉

---
