---
id: core-pipe
title: Pipe 单向管道
sidebar_position: 12
---

# Pipe 单向管道

`Pipe` 把一个 `WritePort` 和一个 `ReadPort` 通过同一条 SPSC 字节队列连接成单向数据通道：写端把数据复制进队列，读端从同一队列复制到接收缓冲区，两端之间不经过额外的中间缓冲。适用于线程、任务或 ISR 与任务之间的数据转发和环回测试。

---

## 特性概览

- 写端拥有一条 `buffer_size` 字节的队列，读端直接读取这条队列。
- 写入在数据入队并通知读端后完成，不等待读端读取；挂起的读请求在写入时被满足，可能在写入调用内同步完成。
- 两端的完成方式与 `ReadPort` / `WritePort` 相同，由 `Operation` 指定。

---

## 公共接口

```cpp
class Pipe {
public:
  // 使用给定共享数据队列容量（字节）构造
  explicit Pipe(size_t buffer_size);

  // 非拷贝/非赋值
  Pipe(const Pipe&) = delete;
  Pipe& operator=(const Pipe&) = delete;
  ~Pipe();

  // 端口访问
  ReadPort&  GetReadPort();
  WritePort& GetWritePort();
};
```

- `buffer_size`：共享队列容量（字节），必须大于 0，创建后不可更改。
- `Pipe` 不直接提供 `Size()` 等方法，通过 `GetReadPort()` / `GetWritePort()` 使用端口接口。
- 析构不取消请求，也不释放队列存储。

---

## 使用方式

`Pipe` 相当于自带回环驱动的内存管道：写入数据后通知读端，满足挂起的读请求。

```cpp
LibXR::Pipe pipe(256);

auto& r = pipe.GetReadPort();
auto& w = pipe.GetWritePort();

std::atomic<LibXR::ReadOperation::OperationPollingStatus> rs{
    LibXR::ReadOperation::OperationPollingStatus::READY};
std::atomic<LibXR::WriteOperation::OperationPollingStatus> ws{
    LibXR::WriteOperation::OperationPollingStatus::READY};
LibXR::ReadOperation rop(rs);
LibXR::WriteOperation wop(ws);

uint8_t buf[16];
const uint8_t data[16] = {};

r({buf, sizeof(buf)}, rop);    // 队列中数据不足，读请求挂起，rs 为 RUNNING
w({data, sizeof(data)}, wop);  // 写入后读请求完成，rs、ws 均为 DONE
```

> `Pipe` 的写完成表示字节已经进入共享队列，不等待读端消费；队列空间不足时，写入返回 `FULL`。
