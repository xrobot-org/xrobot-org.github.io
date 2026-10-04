## 本任务要做什么
1. 在前面“线程 + 互斥锁”基础上，引入 `LibXR::Semaphore`，用信号量来做“事件通知”。
2. 按照 `LibXR::Thread` 的正式接口写出正确的线程函数和 `Create()` 参数。
3. 按照 `LibXR::Callback` 的正式接口写出一个带 `bool in_isr` 的回调，用它在 ISR / 线程中安全地 `PostFromCallback()` 信号量。
4. 理解信号量和互斥锁在用途上的区别：一个偏“事件/计数”，一个偏“互斥访问”。

## 预备知识回顾
### 1. Thread::Create 的正确形态
- 接口：
  - `template <typename Arg> void Create(Arg arg, void (*func)(Arg), const char* name, size_t stack, Priority prio);`
- 关键点：
  1. 线程函数的参数类型 **必须和 `arg` 的类型完全一致**，如：
     - `void Worker(LibXR::Semaphore* sem);`
     - `t.Create(&g_sem, Worker, "sem_worker", 2048, Priority::MEDIUM);`
  2. `stack` 和 `prio` 的单位/解释由各个平台自己的适配层处理，上层只负责给“一个合理的栈大小”和“一个大概的优先级”。

### 2. Callback 的正确形态
- 核心声明：
  - 回调函数原型：`void(bool in_isr, BoundArgType ctx, Args... args)`。
  - 创建：`auto cb = LibXR::Callback<Args...>::Create(fun, bound_arg);`
  - 调用：`cb.Run(in_isr, arg1, arg2, ...);`
- 本任务里我们只绑定一个 `LibXR::Semaphore*`，不需要额外参数：
  - 回调函数：`void OnButtonEvent(bool in_isr, LibXR::Semaphore* sem)`。
  - 类型：`LibXR::Callback<>`（没有额外 Args）。
  - 创建：`LibXR::Callback<> g_button_cb = LibXR::Callback<>::Create(OnButtonEvent, &g_sem);`
  - 调用：`g_button_cb.Run(true);`（在 ISR）、`g_button_cb.Run(false);`（在普通线程）。

## 名词小抄
- **信号量（Semaphore）**：线程之间用来“计数 + 通知”的同步原语，常用来表示“有多少个事件/资源可用”。
- **回调（Callback）**：把函数和一部分参数先“封装/绑定”起来，等事件发生时再统一调用。
- **ISR（中断服务程序）**：被硬件中断触发的函数，执行时间应尽量短，不能做会长时间阻塞的操作（例如 `Wait()`）。

## 示例代码：线程 + 信号量 + 回调
```cpp
#include <thread.hpp>
#include <semaphore.hpp>
#include <callback.hpp>   // 实际工程按你的路径调整

// 1. 全局信号量：初始计数为 0，表示一开始没有事件
LibXR::Semaphore g_sem(0);

// 2. 回调函数：签名必须符合 void(bool, BoundArgType, Args...)
void OnButtonEvent(bool in_isr, LibXR::Semaphore* sem)
{
    // 在 ISR 或普通上下文中安全释放信号量
    sem->PostFromCallback(in_isr);
}

// 3. 回调对象：绑定第一个参数为 &g_sem
LibXR::Callback<> g_button_cb = LibXR::Callback<>::Create(OnButtonEvent, &g_sem);

// 4. 线程函数：参数类型 = Create 传入的 Arg 类型（这里是 LibXR::Semaphore*）
void Worker(LibXR::Semaphore* sem)
{
    while (true)
    {
        // 等待一次事件，最多等 1000 ms
        auto ec = sem->Wait(1000);
        if (ec == ErrorCode::OK)
        {
            // 收到一次“事件”，做一件明显的事情
            // 例如：LibXR::STDIO::Printf("sem: got event\n");
            //       ToggleLED();
        }
        else if (ec == ErrorCode::TIMEOUT)
        {
            // 超时没等到事件，也可以顺便做点别的（可选）
            // 例如：LibXR::STDIO::Printf("sem: timeout\n");
        }
    }
}

int main()
{
    LibXR::Thread t;

    // 5. 按照接口正确调用 Create：
    //    Arg           = LibXR::Semaphore*
    //    func          = void(LibXR::Semaphore*)
    //    name/stack/prio 按平台习惯给值
    t.Create(&g_sem,                           // arg：传给线程函数的参数
             Worker,                           // func：线程入口函数
             "sem_worker",                    // name：线程名（调试用）
             2048,                             // stack：栈大小（字节）
             LibXR::Thread::Priority::MEDIUM); // prio：优先级

    while (true)
    {
        // 用主线程来“模拟”每 2 s 触发一次外部事件
        LibXR::Thread::Sleep(2000);

        // 在线程上下文中触发回调：in_isr = false
        g_button_cb.Run(false);

        // 在真实项目里，你会在按键/定时器/ DMA ISR 中写：
        // g_button_cb.Run(true);
    }
}
```

## 注意事项
1. `Worker` 的函数签名必须是 `void(LibXR::Semaphore* sem)`，因为你在 `Create` 里传的是 `&g_sem`（类型为 `LibXR::Semaphore*`）。
2. 回调函数 `OnButtonEvent` 的签名必须是 `void(bool in_isr, LibXR::Semaphore* sem)`，第一个参数永远是 `bool in_isr`，第二个是你通过 `Callback::Create` 绑定的 `BoundArgType`（这里是 `LibXR::Semaphore*`）。
3. `Wait()` 只能在线程上下文调用，不能在 ISR 里调用；在 ISR 中只调用 `PostFromCallback(true)`，交给信号量去唤醒等待线程。
4. 如果你的平台暂时没有真实中断，可以像示例那样在主线程里用 `Sleep + g_button_cb.Run(false)` 模拟事件，以后直接把 `Run(true)` 挪到真实 ISR 里即可。

## 完成标准
### 功能完成
1. 工程能正常编译、下载并运行，没有因函数签名不匹配导致的链接/运行错误。
2. 线程通过 `LibXR::Semaphore::Wait()` 等待事件，回调通过 `PostFromCallback()` 触发事件，行为可通过打印或 LED 清晰观测到。
3. 调整事件触发频率（例如把 `Sleep(2000)` 改成 `Sleep(500)`），能够明显看到线程响应节奏的变化。

### 理解到位
1. 你能说清楚：`Thread::Create` 的每个参数分别是什么意思，线程函数的参数类型为什么必须和 `arg` 一致。
2. 你能写出一个最小的 Callback 示例：`void(bool, ContextType, ...)` + `Callback<...>::Create(...)` + `Run(in_isr, ...)`。
3. 你能用自己的话解释：为什么在 ISR 里只能 `PostFromCallback(true)`，不能 `Wait()`；以及信号量和互斥锁的用途差异。

## 相关文档
- [Semaphore（信号量）文档](https://xrobot.work/docs/basic_coding/system/semaphore)
- [Callback（通用回调）文档](https://xrobot.work/docs/basic_coding/core/core-callback)
- [Thread（线程）文档](https://xrobot.work/docs/basic_coding/system/thread)
