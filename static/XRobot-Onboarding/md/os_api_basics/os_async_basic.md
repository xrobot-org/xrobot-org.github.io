## 本任务要做什么
1. 认识 `LibXR::ASync`：它提供一层统一的异步任务接口，用来把「比较耗时」的操作从当前上下文移开。
2. 写出并跑起来第一个异步任务：在主循环 / ISR 里提交 Job；在线程可用的环境里由后台工作上下文执行，主线程只轮询状态。
3. 学会区分：什么时候该用 `ASync`，什么时候直接写线程 / Timer / 普通回调就够了。

---

## 适用场景
- 适合：
  - 传感器中断里，只想“快点退 ISR”，把后续的 FFT / CRC / 过滤放到后台线程算。
  - 主循环里，有一个会占用几十毫秒的检查/校验，把它拆出去不阻塞主循环。
  - 想用“一个异步 worker + 提交 Job”的方式跑一些计算，但又不想自己把线程和状态管理从头写一遍。
- 不适合：
  - 完全不允许抖动、对时序极端敏感的硬实时控制（例如高速电机控制环）；
  - 会一直阻塞、死循环的任务（会把这个 ASync 实例完全堵死）。

每个 `ASync` 实例同一时间只执行一个 Job；新的 Job 在前一个没跑完时提交会返回 `ErrorCode::BUSY`。

---

## 名词小抄
- **ASync 实例**：`LibXR::ASync` 的一个对象，负责管理一个异步执行上下文。
- **Job**：`using Job = LibXR::Callback<ASync*>;`，本质是一个带 `ASync*` 参数的回调。
  - 回调函数签名：`void(bool in_isr, BoundArgType ctx, LibXR::ASync* self)`。
  - 通过 `LibXR::ASync::Job::Create(fun, bound_arg)` 创建。
- **Status**：`GetStatus()` 返回：
  - `READY`：当前没有 Job 在执行；
  - `BUSY`：工作线程正在执行一个 Job；
  - `DONE`：上一个 Job 已经执行完成，本次读取会看到 `DONE`，并自动复位为 `READY`。
- **设计说明**：
  - 在 LibXR 的设计理念里，“普通 Callback”默认是 **短平快、不阻塞** 的；
  - 这里虽然复用了 `Callback` 的实现，但给它起了一个新名字 **Job**，明确告诉你：
    - Job 是拿来承接“比普通 Callback 更重一些”的工作（如 FFT / 解压 / 校验）的；
    - 但依然不建议在里面写无限阻塞或超长耗时逻辑，否则整个 ASync 会被这个 Job 拖住。

---

## 前置条件
1. 工程已经能正常使用：
   - `LibXR::Thread`（线程）
   - `LibXR::Semaphore`（信号量）
2. 当前系统实现允许使用 `ASync`：
   - 在线程可用的环境里，Job 会在独立的工作上下文里执行；
   - 在线程不可用的实现里，`ASync` 会退化为同步执行，也就是提交时直接运行 Job。

---

## Job 函数签名与创建方式
### 1. 回调函数签名
按照 `Callback` 的定义，Job 的本质是：

- 类型别名：`using Job = LibXR::Callback<ASync*>;`
- 函数原型：`void(bool in_isr, BoundArgType ctx, LibXR::ASync* self);`

例如，我们要做一个“模拟耗时计算”的 Job：

```cpp
void HeavyCalc(bool in_isr, int* ctx, LibXR::ASync* self)
{
    (void)in_isr; // 这里不需要用到可先忽略

    // 模拟一个 5~10ms 的耗时操作（真实工程中换成 DoFFT / 校验等）
    // 注意：这里 Sleep 只是演示，现实中通常是计算本身耗时
    LibXR::Thread::Sleep(5);

    // 例如根据 *ctx 写入某个结果缓冲区
    // DoFFT(*ctx);
}
```

### 2. 创建 Job 对象
```cpp
static int g_arg = 0;  // 被 Job 使用的上下文参数，生命周期要足够长

LibXR::ASync::Job g_async_job = LibXR::ASync::Job::Create(HeavyCalc, &g_arg);
// 这里：
// - BoundArgType = int*
// - Job 类型 = Callback<LibXR::ASync*>，所以 Args... = LibXR::ASync*
// HeavyCalc 实际签名为：void(bool, int*, LibXR::ASync*)
```

---

## 示例：中断提交 Job，主循环轮询状态
目标：
- 模拟“传感器采样完成中断”里提交一个耗时计算 Job；
- 主循环里定期查 `GetStatus()`，在 Job 完成后取结果并做后续处理。

```cpp
#include <thread.hpp>
#include <semaphore.hpp>
#include <async.hpp>
#include <callback.hpp>

// 1. 创建一个异步工作器
LibXR::ASync g_async_worker(2048, LibXR::Thread::Priority::NORMAL);

// 2. Job 对应的上下文数据（示例中用一个 int 占位，真实工程可换成缓冲区等）
static int g_arg = 0;

// 3. Job 回调函数：签名必须是 void(bool, BoundArgType, LibXR::ASync*)
void HeavyCalc(bool in_isr, int* ctx, LibXR::ASync* self)
{
    (void)self;

    // 中断环境标志：如果你需要区分“是从 ISR 提交的任务”可以用 in_isr 做分支
    // 这里仅示意，不特别区分

    // 模拟耗时计算
    LibXR::Thread::Sleep(5);

    // 根据 *ctx 计算并写入某个全局结果（此处略）
    // DoFFT(*ctx);
}

// 4. 全局 Job 对象：可以在任务和 ISR 中反复提交
LibXR::ASync::Job g_async_job = LibXR::ASync::Job::Create(HeavyCalc, &g_arg);

// 5. 模拟传感器中断服务程序：在 ISR 中提交 Job
void SensorISR()
{
    // 本例由主循环模拟调用，in_isr 传 false；在真实的中断服务程序中传 true
    g_async_worker.AssignJobFromCallback(g_async_job, false);
}

int main()
{
    while (true)
    {
        // 在实际工程中，SensorISR 会被硬件中断触发
        // 这里我们简单地每 100ms 调用一次 ISR 进行模拟
        LibXR::Thread::Sleep(100);
        SensorISR();

        // 主循环中轮询 ASync 的状态
        auto st = g_async_worker.GetStatus();
        if (st == LibXR::ASync::Status::DONE)
        {
            // 表示上一次提交的 Job 已经执行完毕
            // 在这里读取处理结果 / 上报 / 刷 UI 等
            // 例如：PublishResult();
        }

        // 如果需要在任务上下文提交，也可以：
        // if (g_async_worker.AssignJob(g_async_job) == ErrorCode::BUSY) {
        //     // 当前有任务在跑，可以选择丢弃、排队、或者下次再试
        // }
    }
}
```

---

## 注意事项
1. **一个 ASync 实例一次只跑一个 Job**  
   - 如果在 Job 正在执行时再次调用 `AssignJob()`：
     - 会返回 `ErrorCode::BUSY`，说明当前 worker 忙；
     - 你需要自己决定：丢弃、稍后重试、还是忽略这次事件。

2. **Job 中可以稍微耗时，但不要“作死”**  
   - Job 适合承接 FFT、压缩、校验等会消耗几毫秒到几十毫秒的工作；
   - 但不建议：
     - 在 Job 里无限循环；
     - 长时间阻塞等待别的任务（尤其是再去等同一个 ASync 的状态），容易形成死锁或把 worker 完全堵死。

3. **回调/Job 的“阻塞规则”差异**  
   - 普通 `Callback` 在 LibXR 设计理念里是“**不可阻塞、不可长时间延时**”的轻量回调；
   - `ASync::Job` 虽然底层用的是同一套 Callback 模板，但语义不同：
     - 它就是拿来跑“相对重一点的活”的，因此命名为 Job；
     - 仍需自我节制，尽量避免无意义的 `Sleep` 或过长的 IO 阻塞。

4. **`GetStatus()` 的语义**  
   - `READY`：可以提交新 Job；
   - `BUSY`：当前 Job 在执行中；
   - `DONE`：上一 Job 刚执行完，本次读到后会自动复位为 `READY`（适合在主循环里简单 if 判断）。

5. **裸机场景**  
   - 如果当前系统实现不提供线程，ASync 可以退化为“同步执行”：`AssignJob()` 直接执行 `job.Run()`；
   - 在这种模式下，`ASync` 仍然提供统一接口，只是失去了“真正后台执行”的能力。

---

## 完成标准
### 功能完成
1. 至少创建一个 `LibXR::ASync` 实例，并正确构造一个 `Job`：`LibXR::ASync::Job::Create(HeavyCalc, &ctx)`。
2. 能从任务上下文或模拟 ISR 中成功提交 Job：
   - `AssignJob()` 在 READY 状态下返回 `ErrorCode::OK`；
   - `AssignJobFromCallback()` 需要传入真实调用上下文；普通回调/函数中传 `false`，真实 ISR 中传 `true`。
3. 主循环中能通过 `GetStatus()` 观察到从 `BUSY` -> `DONE` -> `READY` 的状态变化。

### 理解到位
1. 能说清楚：
   - ASync 和 Timer / Thread / 普通 Callback 各自适合做什么；
   - 为什么 ASync 的 Job 被设计成 `Callback<ASync*>`；
   - 为什么这里刻意把“Callback”这个名字换成“Job”，避免和“不可阻塞的轻量回调”的概念混淆。
2. 能根据业务需求大致判断：
   - 某个耗时操作是不是适合丢给 ASync；
   - 怎样处理 `AssignJob()` 返回 `ErrorCode::BUSY` 的情况（丢弃 / 重试 / 合并）。

## 相关文档
- [ASync（异步任务）文档](https://xrobot.work/docs/basic_coding/system/async)
- [Callback（通用回调）文档](https://xrobot.work/docs/basic_coding/core/core-callback)
- [Semaphore（信号量）文档](https://xrobot.work/docs/basic_coding/system/semaphore)
- [Thread（线程）文档](https://xrobot.work/docs/basic_coding/system/thread)
