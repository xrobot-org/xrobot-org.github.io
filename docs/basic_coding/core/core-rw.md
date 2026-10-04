---
id: core-rw
title: IO 读写抽象
sidebar_position: 10
---

# IO 读写抽象

`libxr_rw.hpp` 定义通用的 `ReadPort` 与 `WritePort`，以统一接口封装异步、阻塞、轮询等 I/O 行为，完成反馈由 `Operation` 指定。本页介绍调用端口的接口，驱动后端一侧的接口见下文的[驱动后端接口](#驱动后端接口)。

> 注意：`ReadPort` / `WritePort` 在构造时一次性分配内部队列，析构时不释放。

## 核心类型

### ReadPort / WritePort

`ReadPort` 和 `WritePort` 封装了读写操作的调用流程、缓存管理与同步机制。每次调用都会携带一个 `Operation` 实例，明确指定完成后的反馈方式（回调、阻塞、轮询或忽略）。

### ReadOperation / WriteOperation

```cpp
typedef Operation<ErrorCode> ReadOperation;
typedef Operation<ErrorCode> WriteOperation;
```

用于表示带有完成响应行为的异步 I/O 操作。可通过构造函数传入回调、信号量或轮询状态变量，详见 core-op 页面。

## ReadPort 接口

### 初始化

```cpp
explicit ReadPort(size_t buffer_size = 128);
```

构造函数创建接收字节队列，默认容量为 128 字节。容量为 0 时不分配队列，端口不具备读能力。

### 发起读取请求

```cpp
ErrorCode operator()(RawData data, ReadOperation &op, bool in_isr = false);
```

请求读取 `data.size_` 字节，根据 `op` 选择回调、阻塞、轮询或不通知。

- 正长度读取只有在完整长度都可用时才一次性复制到 `data`；
- `data.size_ == 0` 时表示等待“队列中至少有一个字节”，成功后不消费数据；
- 非 `BLOCK` 返回 `OK` 表示请求已接纳，完成可能就在本次调用内，也可能稍后由接收数据推进；
- `BLOCK` 返回 `OK` 时数据已经完成交接；
- 请求超过端口容量返回 `SIZE_ERR`，当前请求处理权被占用时返回 `BUSY`，未绑定队列返回 `NOT_SUPPORT`，`BLOCK` 超时返回 `TIMEOUT`；
- `BLOCK` 只能在线程中调用；在它返回前，同一端口不能再发起读请求或调用 `ClearQueuedData()`，也不能与未完成的非 `BLOCK` 读重叠。

接收缓冲区和回调/轮询对象要保持有效直到完成。`BLOCK` 的缓冲区至少保持到函数返回。

### 状态检查

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Readable() const;
```

`Size()` 返回当前排队字节数，`EmptySize()` 返回空闲字节数，`Capacity()` 返回总容量。未绑定队列时三者都返回 0。`Readable()` 表示端口有接收队列，不表示此刻一定已经有数据。

### 清空已排队数据

```cpp
ErrorCode ClearQueuedData(bool in_isr = false);
```

该接口只丢弃已经排队的接收字节，不取消挂起读请求。存在活动请求或出队处理时返回 `BUSY`。成功后会通知接收侧“空间已经可用”，让使用背压的驱动尝试恢复接收。

## WritePort 接口

### 初始化

```cpp
WritePort(size_t queue_size = 3, size_t buffer_size = 128);
```

`queue_size` 是可排队的写请求数量，`buffer_size` 是字节缓存容量。`queue_size` 为 0 的端口由 [Pipe](./core-pipe.md) 使用。

### 发起写入请求

```cpp
ErrorCode operator()(ConstRawData data, WriteOperation &op, bool in_isr = false);
```

端口在接纳请求时把整段源数据复制进内部字节队列，所以函数返回后源缓冲区即可复用。

- 非 `BLOCK` 返回 `OK` 表示接纳成功；`BLOCK` 返回完成结果，超时返回 `TIMEOUT`，已入队的数据仍会发送（见 [BLOCK 超时与完成交接](../../adv_coding/driver/block_timeout_semantics.md)）；
- 请求槽或字节空间不足返回 `FULL`；
- 生产者状态冲突返回 `BUSY`；
- 没有写能力返回 `NOT_SUPPORT`；
- 单次请求不会部分接纳；
- `data.size_ == 0` 在能力检查后直接成功，不触发后端通知；
- `BLOCK` 只能在线程中调用，同一端口的 `BLOCK` 与非 `BLOCK` 写入不得重叠。

写完成的边界是“后端已经接收整个请求”，不是“物理线路已经发送完”。例如 UART 驱动可以在数据已经复制进 active/pending DMA 缓冲后完成 `WriteOperation`，而 DMA 与 UART 线路仍在继续发送。

### 状态检查

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Writable() const;
```

`Size()`、`EmptySize()`、`Capacity()` 返回字节队列中已有的字节数（含 Stream 已追加未提交的字节）、空闲字节数和总容量。`Writable()` 表示存在字节队列且驱动已经绑定写入推进函数 `WriteFun`，不预留请求槽或字节空间，因此不保证下一笔写一定能被接纳。

## 驱动后端接口

驱动用 `ReadPort::GetReadQueue()` 写入收到的字节并调用 `Publish()`，为 `WritePort` 绑定 `WriteFun`，并在 `WriteFun` 或发送完成中断中用 `WritePort::GetWriteQueue()` 取出待发送的数据。这些接口的调用顺序、并发要求和 STM32 串口的示例见 [IO 完成语义与 Port 状态机](../../adv_coding/core/rw_semantics.md) 的 3.1 节和 4.2 节，串口驱动的整体结构见[串口驱动设计](../../adv_coding/driver/uart_driver.md)。

## STDIO 接口

LibXR 提供全局 `STDIO`，绑定 `ReadPort` / `WritePort` 后可用 `Printf` 或 `Print` 输出调试信息。

```cpp
LibXR::STDIO::write_ = uart.write_port_;
LibXR::STDIO::Printf<"Hello, %d">(123);
LibXR::STDIO::Print<"Hello, {}">(123);
```

`Printf` / `Print` 在内部互斥锁保护下格式化并写入 `STDIO::write_`，只能在线程中调用。返回值为实际提交的字节数，输出超过写端口当前空闲空间时截断；`write_` 未设置或不可写、格式化或提交失败时返回 -1。设置了 `STDIO::write_stream_` 时写入该流，否则每次调用使用一个临时的 `WritePort::Stream`。

## 用例示例

对于数据大小为 0 的情况，Write 会直接返回成功，Read 会等待有任何数据可读再完成。

```cpp
// 阻塞写入串口，超时为 100ms （默认永远等待）
WriteOperation op_block(sem, 100);
uart.Write("Hello", op_block);

// 异步读取并回调处理
ReadOperation op_cb(callback);
uart.Read(buffer, op_cb);
```

---

## WritePort::Stream 批量写入接口

`WritePort::Stream` 把多段数据合并成一次写入请求提交，适合连续写入多块数据。

### 主要特性

- 多次 `<<` 或 `Write()` 把数据追加到同一批次。
- `Commit()` 提交当前批次；析构时自动提交。

### 示例用法

```cpp
WriteOperation op;
// 典型的流式批量写入
{
    WritePort::Stream s(&uart_port, op);
    s << data1 << data2 << data3;
    // s.Commit(); // 可选，析构时自动提交
}
```

### 接口说明

```cpp
class WritePort::Stream {
public:
    Stream(WritePort* port, WriteOperation op);
    ~Stream();
    Stream& operator<<(const ConstRawData& data);
    [[nodiscard]] ErrorCode Write(ConstRawData data);
    [[nodiscard]] ErrorCode Write(std::string_view text);
    [[nodiscard]] ErrorCode Commit();
    [[nodiscard]] ErrorCode Acquire();
    [[nodiscard]] size_t EmptySize() const;
};
```

语义要点：

- 构造时尝试取得端口写入权，失败不报告；可调用 `Acquire()` 检查或重试。`Acquire()` 成功或已持有时返回 `OK`，端口为空返回 `PTR_NULL`，不支持写入返回 `NOT_SUPPORT`，端口被占用返回 `BUSY`，请求队列无空位返回 `FULL`。
- `Write()` 追加数据并返回结果，空间不足时返回 `FULL`，本次不部分追加，已追加的数据保留。`<<` 与 `Write()` 相同，但不报告失败。
- `Commit()` 提交当前批次并释放写入权；之后的 `<<` / `Write()` 重新取得写入权，开始新批次。空批次只完成非 BLOCK 通知。
- 析构时若持有写入权，行为同 `Commit()`，但结果被丢弃。
- 只在线程中使用，完成通知的 `in_isr` 为 false。

---

`ReadPort` 与 `WritePort` 是 LibXR IO 抽象层的核心接口，提供统一的数据缓冲与完成反馈机制，适用于串口、网络、文件系统等多种数据流场景。
