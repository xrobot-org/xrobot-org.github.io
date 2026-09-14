---
id: serialized-service
title: SerializedService 串行服务
sidebar_position: 5
---

# SerializedService 串行服务

`SerializedService` 用一个原子状态字合并事件，并保证同一时刻只有一个调用者执行 handler。它适合“多个入口都可能要求驱动继续推进”的场景，例如发送请求、DMA 完成和设备事件共同驱动一套状态机。

## Invoke

```cpp
#include "serialized_service.hpp"

LibXR::SerializedService service;
constexpr uint32_t RX_EVENT = 1U << 0;
constexpr uint32_t TX_EVENT = 1U << 1;

service.Invoke(RX_EVENT | TX_EVENT, false,
    [](uint32_t events, bool in_isr) noexcept
    {
      if (events & RX_EVENT)
      {
        // 推进接收状态
      }
      if (events & TX_EVENT)
      {
        // 推进发送状态
      }
      (void)in_isr;
    });
```

`Invoke(events, in_isr, handler)` 先发布低 31 位事件，再尝试取得执行权。返回 `true` 表示当前调用执行了 handler；返回 `false` 表示已有执行者，事件已交给该执行者处理。

handler 执行期间新到达的事件会进入下一轮处理，直到没有待处理事件后才释放执行权。

## Publish

```cpp
service.Publish(TX_EVENT);
```

`Publish()` 只记录事件，不主动运行 handler。使用它时，需要已有执行者，或明确保证后续会调用 `Invoke()`。

## 事件语义

事件位表示“这类状态需要重新检查”。同一位在处理前出现多次会合并，因此 handler 应读取实际队列、寄存器或驱动状态来决定需要处理多少工作。

最高位由 `SerializedService` 内部保存执行权，用户事件使用低 31 位。

同一个 service 的所有入口应使用同一套处理逻辑；竞争失败的 `Invoke()` 不会保存它传入的 handler 供以后调用。
