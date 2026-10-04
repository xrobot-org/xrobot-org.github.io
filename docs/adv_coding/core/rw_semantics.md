---
id: adv-coding-core-rw-semantics
title: IO 完成语义与 Port 状态机
sidebar_position: 1
---

# IO 完成语义与 Port 状态机

基础 API 见 [IO 读写抽象](/docs/basic_coding/core/core-rw) 和 [Operation 操作模型](/docs/basic_coding/core/core-op)。本文说明 `ReadPort` 与 `WritePort` 的状态机、驱动后端与端口之间的接口，以及读写请求的完成时机。

## 1. 三层分工

一次读写由三部分配合完成：

- `Operation` 描述完成后怎样通知调用者：执行回调、释放信号量、写入轮询状态或不通知。
- `ReadPort` / `WritePort` 持有字节队列和请求状态，负责接纳请求、判定完成，并在超时与完成之间交接。
- 驱动后端（下文简称后端）通过端口提供的短期接口生产和消费字节：接收时用 `ReadQueue` 写入，发送时用 `WriteQueue` 取出。

`WritePort` 通过 `WriteFun`（`void(WritePort& port, bool in_isr)`）通知后端有新数据可取。该函数没有返回值，只通知进展；请求的结果由端口在后端取走数据时结算。读方向由后端在收到数据时主动写入队列。

## 2. `Operation` 与 `BLOCK`

`Operation` 只保存通知方式和对应的借用指针（回调、信号量及超时值、轮询状态）。写请求的 `Operation` 与请求长度一起存放在 SPSC 队列中，因此 `operation.hpp` 用 `static_assert` 要求它可平凡复制、可平凡析构。请求的生命周期、等待者归属和超时交接都由端口的状态字管理。

`BLOCK` 模式下，`UpdateStatus()` 只释放信号量，不传递结果。端口在释放信号量之前把结果写入自身的 `block_result_`，等待者被唤醒后读取。构造 `Operation(sem, timeout)` 时传入的 timeout 是相对时长，原样传给 `Semaphore::Wait`，默认值为 `UINT32_MAX`。

一个信号量同时只服务一个尚未返回的 `BLOCK` 调用。端口把 `Wait` 成功返回视为请求已完成并读取 `block_result_`，因此 `BLOCK` 使用的信号量初值应为 0（`Semaphore` 构造函数的默认值），且不与其他调用共用：信号量中多出的计数会使 `Wait` 立即返回，端口会把它当作本次完成处理。

## 3. `ReadPort`

### 3.1 后端接口

`ReadPort(buffer_size = 128)` 分配一个 SPSC 字节队列，后端是它唯一的生产者；DMA 中断、UART 中断、I/O 线程等多个接收入口之间由后端自行串行化。`buffer_size` 为 0 时端口不分配队列，由 `Pipe` 在构造时绑定共享队列。

后端每次接收按以下顺序操作：

1. 调用 `GetReadQueue(in_isr)` 取得 `ReadQueue`。它是短期对象，不可复制或移动。
2. 用 `PushBatch(data, size)` 或 `PushWithWriter(limit, writer)` 写入字节，同一个 `ReadQueue` 只使用其中一种。`PushBatch` 在空间足够时全部写入并返回 `OK`，空间不足时返回 `FULL`，不写入部分数据。`PushWithWriter` 把最多两段按顺序排列的空闲空间交给回调，回调返回实际写入的字节数。`EmptySize()` 和 `Capacity()` 可用于事先确定写入量。
3. 调用一次 `Publish()`。没有写入数据时同样需要调用；`ReadQueue` 析构时不会自动发布，开发期断言会检查遗漏。

写入过数据的 `Publish()` 用获取接口时传入的 `in_isr` 推进挂起的读请求。读请求可能在 `Publish()` 内完成，非 `BLOCK` 请求的完成回调也在其中同步执行。

以下节选自 `driver/st/stm32_uart.cpp` 的 `STM32UART::HandleRxData`。接收 DMA 以循环模式持续运行，后端根据 DMA 写入位置与上次位置之差得到新到的字节，按队列空闲空间写入，超出部分丢弃：

```cpp
auto queue = _read_port.GetReadQueue(in_isr);
size_t accepted = std::min(first_size + second_size, queue.EmptySize());

if (accepted != 0U)
{
  const size_t first_accepted = std::min(first_size, accepted);
  if (first_accepted != 0U)
  {
    [[maybe_unused]] const auto push_batch_result =
        queue.PushBatch(rx_buf + last_pos, first_accepted);
    DEV_ASSERT_FROM_CALLBACK(push_batch_result == ErrorCode::OK, in_isr);
    accepted -= first_accepted;
  }
  // ...（DMA 缓冲区回绕后的第二段同样用 PushBatch 写入）
}

last_rx_pos_ = curr_pos == dma_size ? 0U : curr_pos;
queue.Publish();
```

接收队列腾出空间时，端口调用虚函数 `OnReadQueueSpaceAvailable(bool in_isr)`：正长度的读请求从队列取走数据之后、发出完成通知之前调用一次；`ClearQueuedData` 成功后也调用一次，队列原本为空时同样如此。默认实现为空。接收会因队列已满而暂停的后端在派生类中重写它，在这里恢复接收，或记下通知交给当前生产者重新检查，并与其他接收入口串行化。例如 `CDCUart` 在接收暂停时于此处重新准备 OUT 端点；`STM32UART` 的循环 DMA 持续运行，没有重写该函数。

### 3.2 读请求

`ReadPort` 最多保存一个挂起的读请求。提交时端口依次检查：未绑定队列返回 `NOT_SUPPORT`；请求处理状态被占用（已有挂起请求，或其他上下文正在处理）返回 `BUSY`；正长度请求超过队列容量返回 `SIZE_ERR`。

正长度请求只在队列中的数据足够时一次性复制；数据不足时整个请求挂起，等待后续的 `Publish()`。零长度请求在队列非空时完成，不消费数据，地址可以为空。

提交时数据已经足够的请求在本次调用内完成：非 `BLOCK` 请求立即发出完成通知；`BLOCK` 请求直接返回 `OK`，不释放信号量。数据不足时，非 `BLOCK` 请求返回 `OK` 表示已接纳，之后在后端的 `Publish()` 中完成；`BLOCK` 请求在调用中等待完成或超时。

非 `BLOCK` 的完成回调在端口退出处理阶段之后执行，回调中可以提交下一次非 `BLOCK` 读。`BLOCK` 读只能在线程中调用；返回前同一端口不能再提交读请求或调用 `ClearQueuedData`，也不能与尚未结束的非 `BLOCK` 读重叠。

### 3.3 状态

`ReadPort` 的状态是一个 32 位原子量，低位为请求处理阶段，最高位为 `EVENT_BIT`。

| 阶段 | 含义 |
| --- | --- |
| `IDLE` | 可接纳读请求或 `ClearQueuedData` |
| `CLAIMED` | 一方独占请求处理或出队：提交方在检查和复制数据，`Publish()` 在检查挂起请求，或 `ClearQueuedData` 在清空队列 |
| `PENDING` | 读请求已挂起，等待数据 |
| `CLAIMED_WITH_WAITER` | 处理方持有 `CLAIMED` 时 `BLOCK` 等待超时，超时方等待处理方交接 |
| `BLOCK_CLAIMED` | 完成方已认领 `BLOCK` 完成；等待者读取结果后改回 `IDLE` |

`EVENT_BIT` 可与任一阶段共存，表示上次观察之后有新数据发布。每次写入过数据的 `Publish()` 都会置位；该位不记录字节数，多次发布合并为一次；从 `IDLE` 或 `PENDING` 进入 `CLAIMED` 时清除。提交方在挂起请求前看到该位时重新检查队列；`Publish()` 把数据不足的请求放回 `PENDING` 时看到该位，则再处理一轮。端口处于 `CLAIMED` 期间发布的数据因此会被后续检查看到。

### 3.4 `BLOCK` 超时

`BLOCK` 读等待超时后，端口按当时的阶段处理：

- 阶段为 `PENDING`：撤回请求，阶段改回 `IDLE`，返回 `TIMEOUT`。队列中的数据保留，供下一次读取。
- 阶段为 `CLAIMED`：处理方（例如后端的 `Publish()`）正在检查该请求。超时方把阶段改为 `CLAIMED_WITH_WAITER` 后继续等待。处理方发现数据足够时完成请求，调用返回 `OK`；数据仍不足时撤回请求并唤醒超时方，调用返回 `TIMEOUT`。
- 阶段为 `BLOCK_CLAIMED`：完成方已认领，调用等待信号量交接，返回完成结果。

后两种情况下，调用要等处理方停止访问接收缓冲区才返回，耗时可能超过 timeout。三种情况下，调用返回时读请求都已结束。

### 3.5 清空接收队列

`ClearQueuedData(in_isr)` 丢弃队列中已有的字节，成功后调用 `OnReadQueueSpaceAvailable`。它先要从 `IDLE` 进入 `CLAIMED`，因此存在挂起请求或其他上下文正在出队时返回 `BUSY`；未绑定队列返回 `NOT_SUPPORT`。清空只移动消费者位置，可以与后端写入同时进行，同时到达的数据可能保留，也可能被丢弃。

## 4. `WritePort`

### 4.1 写入流程

`WritePort(queue_size = 3, buffer_size = 128)` 分配两个队列：容量为 `queue_size` 的请求队列，每项记录一个请求的长度和 `Operation`；容量为 `buffer_size` 字节的数据队列。`queue_size` 为 0 时不分配请求队列，端口采用 `Pipe` 使用的入队即完成模式：数据写入队列并通知读端后立即完成，`BLOCK` 写不等待。端口绑定 `WriteFun` 后才可写入（`Writable()`）。

一次写入的过程如下：

1. 端口不可写时返回 `NOT_SUPPORT`。长度为 0 时立即返回 `OK`，不通知后端，非 `BLOCK` 请求同步完成。
2. 用 CAS 把阶段从 `IDLE` 改为 `LOCKED`，失败时返回 `BUSY`（例外见 4.4）。
3. 数据队列空间或请求槽不足时改回 `IDLE`，返回 `FULL`，不接纳部分数据。`BLOCK` 写同样返回 `FULL`，不等待队列空间。
4. 把数据复制进数据队列，把请求写入请求队列，再用一次 CAS 退出 `LOCKED` 并把已发布请求数加一：非 `BLOCK` 请求的阶段回到 `IDLE`，`BLOCK` 请求进入 `BLOCK_WAITING`。
5. 在调用者的上下文中调用 `WriteFun(port, in_isr)`。非 `BLOCK` 请求随后返回 `OK`，表示已接纳；`BLOCK` 请求等待完成并返回结果。

调用返回后，调用者的源缓冲区即可复用。

`LOCKED` 只保护复制和发布这两步。非 `BLOCK` 写在第 4 步已把阶段交还为 `IDLE`，下一个写入者可以在前一个仍在 `WriteFun` 中时进入，所以 `WriteFun` 可能被多个线程、或线程与 ISR 同时调用；后端自身的发送完成中断也会推进发送。这些入口由后端串行化。`STM32UART` 用 [`SerializedService`](../../basic_coding/utils/serialized_service.md) 类型的成员 `tx_service_` 处理：`WriteFun` 和各个 UART 中断都通过 `tx_service_.Invoke(...)` 提交事件，取得执行权的一方依次处理所有事件，其他调用只登记事件后返回，登记的事件由执行方在交出执行权之前处理。

```cpp
void STM32UART::WriteFun(WritePort& port, bool in_isr)
{
  auto* uart = LibXR::ContainerOf(&port, &STM32UART::_write_port);

  uart->tx_service_.Invoke(TX_EVENT_WRITE, in_isr,
                           [uart](uint32_t events, bool owner_in_isr)
                           { uart->HandleTxService(events, owner_in_isr); });
}
```

### 4.2 后端接口

后端调用 `GetWriteQueue(in_isr)` 取得队头请求的 `WriteQueue`；没有已发布请求时得到空接口（`Empty()` 为 true）。`AvailableSize()` 是队头请求的剩余字节数，不含后续请求。每个 `WriteQueue` 最多调用一次下列方法之一：

- `PopAll(dst)`：把队头剩余数据全部复制到 `dst`。
- `PopWithWriter(limit, writer)`：把最多 `limit` 字节（最多两段）交给回调，回调返回实际接收的字节数，可以只接收一部分；返回 0 表示本次没有进展。
- `FailFront(reason)`：丢弃队头剩余数据，以错误码 `reason` 结束该请求，用于部分发送后出现无法恢复的错误。

只有已经复制到后端可持续持有的存储（DMA 缓冲区、硬件 FIFO 等）的字节才能计为接收。`WriteQueue` 析构时结算进度：队头请求的全部字节都被取走后，端口才把它移出请求队列并发出完成通知；只取走一部分时请求保留，后端之后重新获取接口继续处理。完成通知可能在析构中同步执行用户回调，回调里提交的新写入会再次调用 `WriteFun`，后端需要记下这次通知并重新检查队列，`SerializedService` 的事件登记满足这一要求。

写请求在后端接收数据时完成，接收位置由后端约定。以下节选自 `STM32UART::FillTx`：DMA 空闲时，后端把队头请求复制进 DMA 双缓冲的 active 区，`queue` 在花括号结束处析构，请求随之完成；DMA 忙时，另一段结构相同的代码把请求复制进 pending 区。因此 `BLOCK` 写返回时，数据可能仍在发送缓冲区中。

```cpp
size_t size = 0U;
{
  auto queue = _write_port.GetWriteQueue(in_isr);
  if (queue.Empty())
  {
    return;
  }
  size = queue.AvailableSize();
  DEV_ASSERT_FROM_CALLBACK(size <= dma_buff_tx_.Size(), in_isr);
  queue.PopAll(dma_buff_tx_.ActiveBuffer());
  dma_buff_tx_.SetActiveLength(size);
}
```

`STM32UART` 构造 `WritePort` 时把数据队列容量设为 DMA 发送缓冲区的一半，单个请求总能放进一个半区。

端口完成、DMA 完成和线路完成因此是三个不同的时刻：端口完成表示后端已接收整笔请求，DMA 完成表示一个 DMA 块已经搬运完毕，线路完成表示最后一个停止位已离开发送器。RS485 方向切换这类依赖线路发送完毕的动作，使用硬件的发送完成事件，不以 `WriteOperation` 的完成为准。

### 4.3 状态

`WritePort` 的状态也是一个 32 位原子量：低 3 位为阶段，其余位为已发布请求数，即后端可以消费的请求个数。因此生产者持有 `LOCKED` 准备新请求时，后端仍可以继续消费此前已发布的请求。

| 阶段 | 含义 |
| --- | --- |
| `IDLE` | 可接纳新的写入；请求队列中可能仍有等待后端处理的非 `BLOCK` 请求 |
| `LOCKED` | 一个生产者正在复制数据、准备请求；`WritePort::Stream` 持有写入权期间也处于该阶段 |
| `BLOCK_WAITING` | `BLOCK` 请求已发布，调用者在等待完成 |
| `BLOCK_CLAIMED` | 后端已认领该 `BLOCK` 请求的完成，随后写入结果并释放信号量；调用者读取结果后改回 `IDLE` |
| `BLOCK_DETACHED` | `BLOCK` 调用已超时返回，请求仍在队列中 |
| `BLOCK_RETIRE_WAITING` | 后续的 `BLOCK` 写在等待已超时的旧请求退出队列 |

阶段不为 `IDLE` 时，新的写入返回 `BUSY`（4.4 所述的 `BLOCK` 写除外）。`BLOCK` 请求从提交到退出队列期间因此独占端口的写入权。

### 4.4 `BLOCK` 超时

`BLOCK` 写等待超时后：

- 阶段为 `BLOCK_WAITING`：改为 `BLOCK_DETACHED`，返回 `TIMEOUT`。数据仍在队列中，后端照常发送；旧请求完成时，端口直接把阶段改回 `IDLE`，不访问原调用者的信号量。
- 阶段为 `BLOCK_CLAIMED`：后端已认领完成，调用等待信号量交接，返回实际结果，耗时可能超过 timeout。

`BLOCK_DETACHED` 期间，其他写入返回 `BUSY`。长度不超过 `Capacity()` 的 `BLOCK` 写可以先等待旧请求退出：阶段改为 `BLOCK_RETIRE_WAITING`，旧请求完成时端口把 `LOCKED` 直接交给这个写入者并唤醒它，之后从 4.1 的第 3 步起继续提交，并等待本次完成。两段等待各自使用该请求的 timeout；第一段等待超时则返回 `TIMEOUT`，本次数据不提交。

写超时返回时，已接纳的数据仍会发出。超时后重发一条非幂等命令时，不能假定第一次没有发出，需要由协议层用序号、确认或去重来处理。

### 4.5 批量写入

`WritePort::Stream` 把多次追加合并为一个请求：构造时或调用 `Acquire()` 时取得 `LOCKED`，每次 `Write()` 直接把数据追加到数据队列，`Commit()` 或析构时作为一个请求提交，提交后的完成与超时规则同上。`Acquire()` 在 `BLOCK_DETACHED` 期间直接返回 `BUSY`，不等待旧请求退出。`Stream` 只在线程中使用。

## 5. 迟到完成与信号量计数

端口中的信号量只负责唤醒，完成归属由阶段决定：完成方先用 CAS 把阶段改为 `BLOCK_CLAIMED`，成功后才写入结果并释放信号量。

迟到完成出现在请求比等待持续更久的场合。读端在调用返回时请求已经结束（见 3.4），不产生迟到完成。写端和 `AsyncBlockWait` 中，请求在超时后继续存在：写请求仍在队列中，或驱动的硬件事务仍在执行，完成随后才到达。此时若完成方仍向原来的信号量释放一次，信号量就会留下多余的计数，同一信号量的下一次 `BLOCK` 调用会把它当作自己的完成。`WritePort` 的 `BLOCK_DETACHED` 和 `AsyncBlockWait` 的 `DETACHED` 使迟到的完成只清理状态，不再释放信号量。第 2 节要求信号量初值为 0、不与其他调用共用，也是为了排除来自端口之外的多余计数。

## 6. `AsyncBlockWait`

不经过 `ReadPort` / `WritePort` 的驱动内部同步事务，例如部分 SPI、I2C 驱动的 `BLOCK` 传输，用 `operation.hpp` 中的 `AsyncBlockWait` 完成同样的等待交接。其状态、调用顺序和常见错误见 [BLOCK 超时与完成交接](../driver/block_timeout_semantics.md)。

## 7. 源码位置

- `src/core/rw/operation.hpp`：`Operation`、`AsyncBlockWait`、`WriteFun`
- `src/core/rw/read_port.hpp`、`src/core/rw/read_port.cpp`：`ReadPort`、`ReadQueue`
- `src/core/rw/write_port.hpp`、`src/core/rw/write_port.cpp`：`WritePort`、`WriteQueue`
- `src/core/rw/write_stream.cpp`：`WritePort::Stream`
- `src/utils/serialized_service.hpp`：`SerializedService`
- `driver/st/stm32_uart.cpp`：本文引用的后端示例
