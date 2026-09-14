## 本任务要做什么
1. 写出并跑起来第一个 `LibXR::Thread` 示例，让一个工作线程周期性地闪烁 LED 并/或打印日志。
2. 感受「主线程 + 工作线程」同时运行，为后面的 Mutex 练习做准备。
3. 初步认识你自己的 OS 环境里的线程概念（主线程 / 工作线程、栈大小、优先级）。

## 适用环境
1. 工程运行在已集成 LibXR 的环境（例如带 RTOS 的 MCU 或 Linux / 类 Unix 系统）。
2. 环境应当至少满足：
   - 可以控制一个可见的指示器（例如板载 LED）。
   - 可以输出文本（例如串口打印 / 终端 `LibXR::STDIO::Printf`）。
3. 裸机（没有 RTOS 的 MCU）暂时不适用：后面会有专门的调度方式。

## 预备条件
1. 工程已经能正常编译、下载并运行。
2. 工程中已经集成 LibXR 系统层：
   - 能包含到 `thread.hpp`（或等价路径）并成功编译。
   - 能看到 `LibXR::Thread` 类，以及 `Create` / `Sleep` / `SleepUntil` / `Yield` 等接口。

## 示例代码
```cpp
#include <thread.hpp>

void Worker(int* counter)
{
    auto last = LibXR::Timebase::GetMilliseconds();
    while (true)
    {
        (*counter)++;                      // 修改计数器，后面 Mutex 会用到
        // 这里做一件容易观察的事情：例如打印日志并切换 LED 状态
        // 例如：LibXR::STDIO::Printf("worker: %d", *counter); ToggleLED();
        LibXR::Thread::SleepUntil(last, 500);  // 每 500 ms 执行一次
    }
}

static int counter = 0;
LibXR::Thread worker;

int main()
{
    worker.Create(&counter,        // 传给线程函数的参数（类型为 int*）
                  Worker,          // 线程函数，签名必须是 void(int*)
                  "worker",        // 线程名称，便于调试
                  2048,            // 线程栈大小（字节），先用 2048 这种安全值
                  LibXR::Thread::Priority::MEDIUM);  // 普通优先级

    while (true)
    {
        // 主线程自己的工作，例如每 1000 ms 打印一次日志并闪烁另一颗 LED
        // 例如：LibXR::STDIO::Printf("main loop"); ToggleOtherLED();
        LibXR::Thread::Sleep(1000);   // 1000 ms = 1 s
    }
}
```

## 逐行解释
### 核心思路
1. Worker 线程：每 500 ms 醒一次，更新计数器并进行一次可见动作（打印日志 / 闪灯）。
2. 主线程：每 1000 ms 执行一次自己的逻辑，用来对比两个不同的节奏。

### 关键语句说明
1. `auto last = LibXR::Timebase::GetMilliseconds();`
   - 从 LibXR 的时间基准模块中读取当前系统的毫秒计数，后面配合 `SleepUntil` 做固定周期循环。时间单位是毫秒。
2. `LibXR::Thread::SleepUntil(last, 500);`
   - 以毫秒为单位的周期睡眠：每次都会睡到 `last + 500`，并在函数内部更新 `last`，形成稳定的 500 ms 周期循环。
3. `worker.Create(&counter, Worker, "worker", 2048, LibXR::Thread::Priority::MEDIUM);`
   - 创建并启动一个新线程：传入参数指针 `&counter`、线程函数 `Worker`、线程名 `"worker"`、栈大小 `2048` 字节、普通优先级。
4. `LibXR::Thread::Sleep(1000);`
   - 让当前线程休眠 `1000 ms`（1 秒），形成与工作线程不同的节奏。

## 编译与运行
### 编译
- 确认工程已经链接了对应平台的 `thread.cpp` 实现，然后按平时的方法编译（`make` / `ninja` / IDE 按钮均可）。

### 运行与观察
1. 烧录 / 运行程序后，你应该能看到：
   - 一个线程以大约 500 ms 的节奏更新计数器，并做一次可见动作（打印 / 闪灯）。
   - 主线程以大约 1000 ms 的节奏做自己的可见动作。
2. 如果只看到一个节奏在动：
   - 检查 `worker.Create` 是否真的被执行。
   - 可以尝试把栈大小调大一点（例如 `4096`），或者把线程优先级调高。

## 名词小抄
- **线程（Thread）**：操作系统调度的基本执行单元，可以把不同功能拆成多个线程并发运行。
- **主线程**：`main()` 所在的线程，程序一开始就在这里跑。
- **工作线程**：由 `LibXR::Thread::Create` 创建出来，专门负责某一类工作（如闪灯、采样、通信）。
- **栈大小（stack）**：给线程分配的函数调用栈空间，单位通常是字节，需要留出足够余量防止栈溢出。

## 为后续任务做准备
- 保留好这份工程，后面的 Mutex 练习会在这个示例上直接加入互斥锁来保护 `counter`。

## 相关文档
- [Thread（线程）文档](https://xrobot.work/docs/basic_coding/system/thread)
