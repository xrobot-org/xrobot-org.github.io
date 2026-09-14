---
id: core-rw
title: IO 读写抽象
sidebar_position: 8
---

# IO 读写抽象

本模块定义了通用的 `ReadPort` 与 `WritePort` 接口类，用于跨平台封装异步、阻塞、轮询等多种 I/O 行为，并通过 `Operation` 模型绑定完成反馈机制。适配不同底层驱动时，只需实现对应的读写函数并赋值给端口对象，即可获得完整的异步 I/O 能力。

`ReadPort`、`WritePort` 和 `WritePort::Stream` 的当前主线实现主要由原子状态机与 `SPSCQueue` 这类无锁数据结构组织其**软件侧排队与完成交接**。但它们只是 I/O 抽象层本身的实现方式，不应被扩大表述成“整个读写路径绝不会发生系统调用”这样的跨后端保证；真正的系统调用、DMA 启动或硬件访问仍取决于具体驱动的接收生产路径和 `WriteFun` 后端。

> 注意：`ReadPort` / `WritePort` 的默认构造会在内部创建无锁队列与缓存（构造期一次性分配/初始化），用于承载数据与写入元信息。

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
ReadPort(size_t buffer_size = 128);
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
- 请求超过端口容量返回 `SIZE_ERR`，当前请求处理权被占用时返回 `BUSY`。

接收缓冲区和回调/轮询对象要保持有效直到完成。`BLOCK` 的缓冲区至少保持到函数返回。

### 状态检查

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Readable() const;
```

`Size()` 返回当前排队字节数，`EmptySize()` 返回空闲字节数，`Capacity()` 返回总容量。未绑定队列时三者都返回 0。`Readable()` 表示端口有接收队列，不表示此刻一定已经有数据。

### 驱动向接收队列写数据

`ReadPort` 不再绑定旧版 `ReadFun`。底层驱动在拿到 UART DMA、FIFO 或其他来源的数据后，通过：

```cpp
auto queue = read_port.GetReadQueue(in_isr);
queue.PushBatch(data, size);
queue.Publish();
```

把字节写入端口。`Publish()` 负责推进挂起读请求，并可能在当前上下文中触发完成回调。一次生产过程最后都要调用 `Publish()`；析构本身不会替代这一步。

驱动需要串行化同一端口的生产入口。`Pipe` 的读端借用写端队列，不使用这套普通驱动生产接口。

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

`queue_size` 是可排队的写请求数量，`buffer_size` 是字节缓存容量。普通驱动使用正的请求槽数；`Pipe` 使用 `queue_size == 0` 的入队完成模式。

### 设置写入推进函数

```cpp
WritePort &operator=(WriteFun fun);
```

`WriteFun` 的签名是：

```cpp
using WriteFun = void (*)(WritePort& port, bool in_isr);
```

它只是通知底层“现在有已提交数据可以继续处理”，不通过返回值报告请求完成。普通驱动使用 `GetWriteQueue()` 消费已经发布的队头。

### 发起写入请求

```cpp
ErrorCode operator()(ConstRawData data, WriteOperation &op, bool in_isr = false);
```

端口在接纳请求时把整段源数据复制进内部字节队列，所以函数返回后源缓冲区即可复用。

- 非 `BLOCK` 返回 `OK` 表示接纳成功；
- 请求槽或字节空间不足返回 `FULL`；
- 生产者状态冲突返回 `BUSY`；
- 没有写能力返回 `NOT_SUPPORT`；
- 单次请求不会部分接纳；
- `data.size_ == 0` 在能力检查后直接成功，不触发后端通知。

写完成的边界是“后端已经接收整个请求”，不是“物理线路已经发送完”。例如 UART 驱动可以在数据已经复制进 active/pending DMA 缓冲后完成 `WriteOperation`，而 DMA 与 UART 线路仍在继续发送。

### 状态检查

```cpp
size_t Size() const;
size_t EmptySize() const;
size_t Capacity() const;
bool Writable() const;
```

`Writable()` 表示存在字节队列且已经绑定 `WriteFun`，不预留请求槽或字节空间，因此不保证下一笔写一定能被接纳。

### 驱动消费已提交请求

普通后端使用：

```cpp
auto queue = write_port.GetWriteQueue(in_isr);
```

取得当前已发布队头的剩余数据，再通过 `PopAll()`、`PopWithWriter()` 或 `FailFront()` 推进这一笔请求。`WriteQueue` 析构时结算本次消费，只有整个请求被取走后才触发对应完成通知。

同一个后端的 `GetWriteQueue()`、出队、析构结算和完成回调必须串行。驱动不能保留指向端口队列的裸指针给 DMA 稍后读取；在出队接口返回前，应把接受的数据放进自己能够持续持有的缓冲。

## STDIO 接口

LibXR 提供了一个全局 `STDIO` 接口，可绑定 `ReadPort` / `WritePort` 实例并使用 `Printf(...)` 接口输出调试信息。

```cpp
LibXR::STDIO::write_ = &uart.write_port_;
LibXR::STDIO::Printf<"Hello, %d">(123);
```

当前实现里，`Printf` 通过共享的 STDIO 写会话和内部互斥来完成格式化与串行化输出，并根据是否配置 `STDIO::write_stream_` 决定走普通写入或流式批量写入路径。

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

`WritePort::Stream` 提供了类似 C++ 标准流的链式批量写入能力，适合高吞吐、大包或连续多块数据写入场景。其目标是 **一次性锁定端口资源、批量写入数据、降低队列压力和碎片化**。

### 主要特性

- **流式链式写入**：支持多次 `<<` 操作，将多段数据批量追加到写缓存中。
- **自动批量提交**：析构时会自动提交未提交的数据，也可随时调用 `Commit()` 手动提交。

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
    ErrorCode Commit();
};
```

语义要点：

- `Stream(WritePort*, WriteOperation)`：构造时尝试获取写锁，并检查写入元信息队列是否至少还剩 1 个空位；若未获取到锁或队列空间不足，则该 Stream 处于未锁定状态。
- `operator<<`：若处于未锁定状态，会再次尝试获取写锁；未成功则本次 `<<` 不会写入数据。若已锁定且剩余容量允许（`size_ + data.size_ <= cap_`），则把数据追加进写缓存；超出容量时不会进行部分写入（直接忽略该段追加）。
- `Commit()`：把当前累积的数据作为一条写入提交，并释放这一批次的生产者所有权；后续继续写入时需要重新获取。提交后 `size_` 清零。
- `~Stream()`：析构时若有未提交数据会自动提交，随后释放写锁。

---

`ReadPort` 与 `WritePort` 是 LibXR IO 抽象层的核心接口，提供统一的数据缓冲与完成反馈机制，适用于串口、网络、文件系统等多种数据流场景。

## 当前实现边界

- `ReadPort(buffer_size)` 只有在 `buffer_size > 0` 时才分配接收队列；未绑定时 `Size()` / `EmptySize()` / `Capacity()` 返回 0，`Readable()` 返回 `false`。
- `WritePort(queue_size, buffer_size)` 的字节队列和请求元信息是两种独立容量；`Pipe` 使用 `queue_size == 0` 的特殊模式，不建立请求元信息队列。
- `BLOCK` 只能在线程上下文使用。同一端口的 `BLOCK` 与尚未完成的非 `BLOCK` 操作不能重叠。
- 读 timeout 会安全结束尚未完成的软件读；写 timeout 不撤回已经排队的字节，底层仍可能继续发送。详细交接见 [BLOCK 超时与完成交接](../../adv_coding/driver/block_timeout_semantics.md)。
- 端口只管理软件侧排队与请求完成。DMA 停机、UART 线路排空、设备断开等硬件状态由具体驱动定义。
