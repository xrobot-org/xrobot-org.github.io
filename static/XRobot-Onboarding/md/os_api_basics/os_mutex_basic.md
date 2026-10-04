## 本任务要做什么
1. 在上一任务的基础上，引入 `LibXR::Mutex`，让主线程和工作线程安全地共享同一个计数器。
2. 体验「不加锁 vs 加锁」的差异，理解什么是临界区。
3. 熟悉 `LibXR::Mutex` 和 `LibXR::Mutex::LockGuard` 的基本用法。

## 预备条件
1. 已完成「线程入门」任务，工程中有一个主线程 + 一个工作线程，并共享整型变量（例如 `counter`）。
2. 已能正常编译、下载并运行该工程。

## 实现步骤
1. **声明互斥锁和共享变量**（全局或合适的作用域）：
```cpp
#include <mutex.hpp>

LibXR::Mutex g_counter_mutex;
int g_counter = 0;
```

2. **在工作线程中加锁访问 `g_counter`**：
```cpp
void Worker()
{
    while (true)
    {
        {
            LibXR::Mutex::LockGuard lock(g_counter_mutex); // 构造时加锁
            g_counter++;                                   // 临界区：修改共享数据
            // 这里可以打印一下当前计数值
            // 例如：LibXR::STDIO::Printf("worker: %d\n", g_counter);
        } // 作用域结束，LockGuard 析构自动解锁

        LibXR::Thread::Sleep(500); // 保持原来的节奏
    }
}
```

3. **在主线程中同样使用互斥锁访问 `g_counter`**：
```cpp
int main()
{
    // 创建工作线程（可复用上一任务的代码）
    // ... worker.Create(...);

    while (true)
    {
        {
            LibXR::Mutex::LockGuard lock(g_counter_mutex);
            // 在主线程中读取 / 打印 g_counter
            // 例如：LibXR::STDIO::Printf("main: %d\n", g_counter);
        }

        LibXR::Thread::Sleep(1000);
    }
}
```

4. **（可选）尝试去掉互斥锁对比效果**：
   - 暂时注释掉 `LockGuard`，只保留对 `g_counter` 的读写。
   - 视平台和优化情况，你可能会观察到：打印顺序异常、重复、跳号等现象，或者表面上看不出问题，但这并不代表没有竞争条件，只是没被触发出来。

## 名词小抄
- **临界区（Critical Section）**：多线程可能同时访问/修改的共享数据区域，例如同一个全局计数器、同一块缓冲区。
- **互斥锁（Mutex）**：用来保证某一时刻只有一个线程可以进入临界区的锁，避免数据竞争。
- **RAII**：一种 C++ 习惯用法，利用对象构造/析构自动管理资源（这里指“自动加锁/解锁”）。

## 注意事项
- 互斥锁只能在「线程上下文」使用，不能在中断服务程序（ISR）里加锁 / 解锁；如果需要在 ISR 中保护数据，后续会用专门的临界区 / 原子操作方式。
- 尽量使用 `LockGuard` 这种 RAII 封装，避免「加锁后早退却没解锁」之类的错误。

## 完成标准
### 功能完成
1. 工程能够正常编译、下载并运行。
2. 主线程和工作线程都在访问同一个 `g_counter`，且访问时都通过 `LibXR::Mutex::LockGuard` 保护。
3. 打印 / LED 行为看起来正常，程序不出现明显异常（卡死、频繁报错）。

### 理解到位
1. 能用自己的话解释：什么是临界区，为什么对 `g_counter++` 这种操作也需要互斥保护。
2. 能说出：`Mutex` 的三个核心操作（`Lock` / `TryLock` / `Unlock`）分别在什么场景下使用。
3. 能说明：为什么推荐用 `LockGuard` 来管理锁的生命周期，而不是手动成对调用 `Lock` / `Unlock`。

## 相关文档
- [Mutex（互斥锁）文档](https://xrobot.work/docs/basic_coding/system/mutex)
- [Thread（线程）文档](https://xrobot.work/docs/basic_coding/system/thread)
