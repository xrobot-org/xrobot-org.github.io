## 本任务要做什么
1. 在前面「线程 + 互斥锁 + 信号量」基础上，引入 `LibXR::Timer`，用“定时任务”来替代手写 `while (true) + Sleep` 循环。
2. 写出并跑起来一个最简单的定时任务：每 1000 ms 打印一行日志 / 闪烁 LED。
3. 学会在运行时修改任务周期（`SetCycle`），以及启动 / 停止定时任务（`Start` / `Stop`）。
4. 理解：`LibXR::Timer` 适用于 **对实时性要求不高** 的周期性任务，所有任务共享同一个调度机制，不需要为每个任务单独开线程栈，比较节省资源。

## 适用场景
- 适合做：
  - 周期打印状态、喂狗、上报心跳、轮询某个状态等“软实时”任务；
  - 对抖动不敏感，只要“差不多按周期执行”就可以的逻辑。
- 不适合做：
  - 对时序特别严格的控制环（硬实时控制），比如电机 FOC 里的高速环；这种更适合：
    - 专门的高优先级线程 + `Thread::SleepUntil`；
    - 或硬件定时器 + RTOS 原生 timer / 中断。

## 适用环境
1. 工程运行在已集成 LibXR 的环境（例如带 RTOS 的 MCU 或 Linux / 类 Unix 系统），并且：
   - 已完成 Timebase 配置，可以正常调用 `LibXR::Timebase::GetMilliseconds()`。
   - 建议已经做过 `Thread` / `Mutex` / `Semaphore` 练习（不强制，但会更好理解）。
2. 裸机环境同样可以使用 `LibXR::Timer`，只要 Timebase 正常工作即可。

## 名词小抄
- **Timebase（时间基准）**：提供系统启动以来的毫秒计数，例如 `LibXR::Timebase::GetMilliseconds()`；所有定时逻辑都以它为参考。
- **Timer（定时器）**：LibXR 内部的“软件定时器调度器”，你只需要注册回调和周期，不用自己管遍历和计时。
- **TimerHandle（定时任务句柄）**：`LibXR::Timer::CreateTask` 返回的句柄，用来后续 `Start` / `Stop` / `SetCycle` / `Add`。
- **Timer 管理线程**（RTOS / 多线程环境）：LibXR 内部起的一个线程，周期性调用 `Timer::Refresh()`，统一调度所有定时任务。
- **裸机空闲刷新**：在没有真正线程的裸机环境，LibXR 会在 `Thread` 延时、Mutex、信号量等待时调用 `RefreshTimerInIdle()`，顺带把定时任务刷一遍。

## 示例一：最简单的周期打印任务
目标：每 1000 ms 执行一次任务（打印日志 / 闪烁 LED），主线程不用自己写 `while(true) + Sleep` 调度逻辑。

```cpp
#include <thread.hpp>
#include <timer.hpp>

// 要周期执行的任务函数：参数类型要和 CreateTask 的 arg 类型一致（这里是 int*）
void PrintHello(int* value)
{
    // 这里可以替换成串口打印 / 板载 LED 闪烁等
    // 例如：LibXR::STDIO::Printf("Hello, value = %d\n", *value);
    ToggleLED();
}

int main()
{
    static int arg = 123;  // 参数要在整个任务生命周期内有效（static / 全局更安全）

    // 1. 创建定时任务：每 1000 ms 调用一次 PrintHello
    auto handle = LibXR::Timer::CreateTask(PrintHello, &arg, 1000);

    // 2. 把任务加入 LibXR 的定时调度列表（同一个 handle 只需要 Add 一次）
    LibXR::Timer::Add(handle);

    // 3. 启动任务
    LibXR::Timer::Start(handle);

    // 4. 主线程可以什么都不做，或者做别的事
    while (true)
    {
        // RTOS / 多线程：Timer 内部有单独管理线程负责调度本任务，不需要你手动 Refresh
        // 裸机：在 LibXR 的 Thread 延时 / Mutex / 信号量等待中会自动调用 RefreshTimerInIdle
        LibXR::Thread::Sleep(UINT32_MAX);  // 这里简单地“睡很久”
    }
}
```

### 代码要点说明
1. `void PrintHello(int* value)`  
   - 函数参数类型是 `int*`，所以在 `CreateTask` 时传入的 `arg` 必须也是 `int*`（这里是 `&arg`）。
2. `LibXR::Timer::CreateTask(PrintHello, &arg, 1000);`  
   - 创建一个周期为 1000 ms 的定时任务，返回 `TimerHandle`。
   - 内部为这个任务分配控制块，但 **不会** 为它单独开一个线程栈；多个定时任务共用同一个调度机制（一个管理线程，或裸机空闲刷新）。
3. `LibXR::Timer::Add(handle);`  
   - 把任务加入内部任务列表：
     - **RTOS / 多线程环境**：第一次 `Add` 时会创建定时器管理线程（`RefreshThreadFunction`），这个线程用 `Thread::SleepUntil` 以 1ms 精度轮询并调度所有任务。
     - **裸机环境**：不会创建线程，只是初始化列表，之后靠 `RefreshTimerInIdle()` 刷新。
4. `LibXR::Timer::Start(handle);`  
   - 启用这个定时任务；之后，由 Timer 管理逻辑按周期调用任务函数。
5. `LibXR::Thread::Sleep(UINT32_MAX);`  
   - 示例里主线程什么都不干，只是防止退出。真实工程中，你可以在这里放自己的业务循环。

## 示例二：运行中修改周期（SetCycle）
在上面的基础上，再加几行代码：

```cpp
// 在 main 里创建好任务、Add/Start 之后：
LibXR::Thread::Sleep(5000);           // 先等 5 秒
LibXR::Timer::SetCycle(handle, 200);  // 把周期改成 200 ms
```

观察现象：
- 前 5 秒任务大约每 1 秒执行一次；
- 之后任务执行频率明显变快，大约 0.2 秒一次。

## 示例三：暂停与恢复定时任务
```cpp
// 同样在 main 中：
LibXR::Thread::Sleep(10000);  // 运行 10 秒
LibXR::Timer::Stop(handle);   // 暂停任务 3 秒
LibXR::Thread::Sleep(3000);
LibXR::Timer::Start(handle);  // 再次启动
```

## 注意事项
1. **参数生命周期要足够长**  
   - `CreateTask` 内部保存的是指向 `arg` 的指针，不会拷贝整个对象；
   - 所以 `arg` 必须在整个定时任务的生命周期内保持有效（建议使用 `static` / 全局变量，或者比定时任务活得更久的对象）。

2. **Add 只能调用一次**  
   - 每个 `TimerHandle` 只能 `Add` 一次；重复添加会触发断言 `ASSERT(!handle->next_)`。

3. **周期单位是毫秒，且不是硬实时**  
   - 所有 `cycle` / `SetCycle` 参数单位都是毫秒：`1` 表示 1 ms，`1000` 表示 1 s；
   - LibXR 内部通过 `Thread::SleepUntil` + 软件计数实现调度，精度可以达到 ms 级，但仍然受线程调度和中断影响，**不是绝对硬实时**。

4. **RTOS / 多线程环境的实现**  
   - Timer 会通过 `RefreshThreadFunction` 启动一个真正的管理线程（`LibXR::Timer::thread_handle_`），在这个线程里：
     - 用 `Thread::GetTime()` / `Thread::SleepUntil` 做 1 ms tick；
     - 周期性调用 `Timer::Refresh()` 遍历任务列表并触发任务。
   - 每个定时任务本身不会再起独立线程，大家共享这一个管理线程的栈和调度逻辑，因此对 RAM 更友好。

5. **裸机场景的实现**  
   - 裸机下没有真正的 OS 线程，LibXR 不会创建管理线程；
   - 而是通过 `RefreshTimerInIdle()` 在以下情况被自动调用：
     - `Thread` 延时；
     - Mutex / 信号量等待等“空闲”时机；
   - 这样利用“原本就要空转的时间”顺带刷新定时器，同样达成周期任务效果。

## 完成标准
### 功能完成
1. 至少创建一个定时任务，通过 `LibXR::Timer::CreateTask` + `Add` + `Start` 正常运行。
2. 能从日志或 LED 行为中明显观察到“每隔一段时间执行一次”的现象（软实时即可，无需精确到每个 tick）。
3. 能在运行时通过 `SetCycle` 明显改变任务执行频率（例如从 1000 ms 改成 200 ms）。
4. 能通过 `Stop` / `Start` 暂停并恢复任务执行。

### 理解到位
1. 能解释：
   - Timer 和“给每个任务单独开线程 + while(true) + SleepUntil”相比的优点（更节省栈、更统一的调度）；
   - Timer 是一个“软实时软件定时器”，不适合做硬实时控制环。
2. 能说清楚：
   - `CreateTask` 返回的 `TimerHandle` 用来做什么；
   - 为什么回调参数类型必须和 `CreateTask` 的 `arg` 类型一致；
   - 为什么 `arg` 不能是一个随手写在函数里的局部变量。
3. 能区分：
   - **RTOS / 多线程环境**：Timer 由一个真正的管理线程驱动；
   - **裸机环境**：Timer 依赖空闲时的 `RefreshTimerInIdle()` 刷新。

## 相关文档
- [Timer（定时器）文档](https://xrobot.work/docs/basic_coding/system/timer)
- [Timebase（时间基准）配置示例 · STM32](https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-timebase)
- [Thread（线程）文档](https://xrobot.work/docs/basic_coding/system/thread)
