---
id: uart
title: 串口
sidebar_position: 2
---

# UART（通用异步收发）

`LibXR::UART` 提供通用异步串口通信接口的抽象基类，支持配置波特率、数据位、停止位和校验位等参数，并封装统一的读写接口，便于跨平台适配。

## 接口概览

### 枚举类型

```cpp
enum class Parity : uint8_t {
  NO_PARITY = 0,  // 无校验
  EVEN = 1,       // 偶校验
  ODD = 2         // 奇校验
};
```

### 配置结构体

```cpp
struct Configuration {
  uint32_t baudrate;  // 波特率
  Parity parity;      // 校验模式
  uint8_t data_bits;  // 有效数据位数；按字节接收时只有低 data_bits 位有效
  uint8_t stop_bits;  // 停止位长度
};
```

### 构造与配置

```cpp
template <typename ReadPortType = ReadPort, typename WritePortType = WritePort>
UART(ReadPortType* read_port, WritePortType* write_port);

virtual ErrorCode SetConfig(Configuration config, bool in_isr = false) = 0;
```

构造时传入读写端口指针（允许传入 `ReadPort/WritePort` 的派生类型）。对象内部会保存：

- `ReadPort* read_port_`
- `WritePort* write_port_`

`SetConfig()` 的生效时机和允许的调用上下文由具体后端规定。

### 数据收发接口

```cpp
template <typename OperationType>
ErrorCode Write(ConstRawData data, OperationType&& op, bool in_isr = false);

template <typename OperationType>
ErrorCode Read(RawData data, OperationType&& op, bool in_isr = false);
```

`Write` 与 `Read` 接口基于统一的 `Port + Operation` 抽象，支持阻塞、回调、轮询等模式，便于在主循环或异步环境中使用。

- `op` 为具名的 `WriteOperation` / `ReadOperation` 对象（或其派生类型），传临时对象无法编译。端口复制 `op`，它引用的回调、轮询状态或信号量须保持有效到操作完成（BLOCK 方式到调用返回）。
- `in_isr` 指示是否在中断上下文中调用（会透传到端口的 `operator()`）。

完成方式与返回值见 [IO 读写抽象](../core/core-rw.md)、[Operation 操作模型](../core/core-op.md) 和 [BLOCK 超时与完成交接](../../adv_coding/driver/block_timeout_semantics.md)，后端实现见[串口驱动设计](../../adv_coding/driver/uart_driver.md)。

## 说明

- `UART::Parity` 支持 `NO_PARITY`、`EVEN`、`ODD`。
- `stop_bits` 是 `uint8_t` 类型的停止位个数，可接受的取值由各后端规定。
- `UART` 基类保存 `read_port_` / `write_port_` 指针并转发 `Read()` / `Write()`；端口对象由调用方或平台实现创建和管理。

## 特性总结

- 支持波特率、数据位、停止位、校验方式的完整配置；
- 读写接口统一封装，支持多种 I/O 操作模型；
- 平台无关，便于跨平台适配与封装；
- 通常结合底层硬件驱动实现接收发送逻辑，用户无需关心派生细节。
