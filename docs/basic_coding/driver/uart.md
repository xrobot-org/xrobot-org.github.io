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
  uint8_t data_bits;  // 数据位长度
  uint8_t stop_bits;  // 停止位长度
};
```

### 构造与配置

```cpp
template <typename ReadPortType = ReadPort, typename WritePortType = WritePort>
UART(ReadPortType* read_port, WritePortType* write_port);

virtual ErrorCode SetConfig(Configuration config) = 0;
```

构造时传入读写端口指针（允许传入 `ReadPort/WritePort` 的派生类型）。对象内部会保存：

- `ReadPort* read_port_`
- `WritePort* write_port_`

### 数据收发接口

```cpp
template <typename OperationType>
ErrorCode Write(ConstRawData data, OperationType&& op, bool in_isr = false);

template <typename OperationType>
ErrorCode Read(RawData data, OperationType&& op, bool in_isr = false);
```

`Write` 与 `Read` 接口基于统一的 `Port + Operation` 抽象，支持阻塞、回调、轮询等模式，便于在主循环或异步环境中使用。

- `OperationType` 需要是 `WriteOperation` / `ReadOperation`（或其派生/等价类型）。
- `in_isr` 指示是否在中断上下文中调用（会透传到端口的 `operator()`）。

## 说明

- `UART::Parity` 当前只有 `NO_PARITY / EVEN / ODD` 三种取值；源码里仍保留 `Mark / Space` 的 TODO 注释，因此文档不应把这些模式写成已存在的通用接口能力。
- `stop_bits` 当前只是一个原始 `uint8_t` 配置字段；基类接口本身没有再定义 `0.5 / 1.5` 这类统一枚举或跨平台保证。
- `UART` 基类当前只是保存 `read_port_` / `write_port_` 指针并把 `Read()` / `Write()` 转发过去，不负责创建、拥有或释放这些端口对象；端口生命周期仍由调用方或具体平台实现管理。

## 特性总结

- 支持波特率、数据位、停止位、校验方式的完整配置；
- 读写接口统一封装，支持多种 I/O 操作模型；
- 平台无关，便于跨平台适配与封装；
- 通常结合底层硬件驱动实现接收发送逻辑，用户无需关心派生细节。
