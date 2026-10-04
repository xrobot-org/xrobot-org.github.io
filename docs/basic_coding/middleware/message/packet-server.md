---
id: message-packet-server
title: 数据打包与解析
sidebar_position: 2
---

# 数据打包与解析

当前 `Message` 模块提供两条和链路相关的能力：

- `Topic::PackData()` / `Topic::PackRaw()`：把一条消息按当前 topic 的运行时契约打成 packet；
- `Topic::Server`：把收到的字节流解析成 packet，再投递回已注册的 topic。

这条路径现在只关心：

- topic 名称 CRC32；
- payload 固定长度；
- payload 对齐要求；
- packet 头尾 CRC 校验。

它**不再依赖 topic 缓存**，也不会恢复旧版本里 `DumpData()` 那种 latest-value 语义。

## 打包一条强类型消息

```cpp
LibXR::Topic::Domain domain("msg");
auto topic = LibXR::Topic::CreateTopic<double>("temperature", &domain);

LibXR::Topic::PackedData<double> packet;
topic.PackData(36.5, packet, LibXR::MicrosecondTimestamp(123456));
```

如果不传时间戳，会自动使用 `Topic::NowTimestamp()`：

```cpp
topic.PackData(36.5, packet);
```

`PackData()` 直接拿你传入的 payload 打包，不要求先 `Publish()`。

## 用 raw payload 打包

有时你手里已经是按当前 topic 契约组织好的字节块，这时可以用 `PackRaw()`：

```cpp
double value = 72.72;
uint8_t raw_packet[LibXR::Topic::PACK_BASE_SIZE + sizeof(double)] = {};

topic.PackRaw(LibXR::ConstRawData(value),
              LibXR::RawData(raw_packet, sizeof(raw_packet)),
              LibXR::MicrosecondTimestamp(6006));
```

当前 `PackRaw()` 的边界：

- `data.size_` 必须等于该 topic 的 `PayloadSize()`；
- 输出缓冲区至少要容纳 `PACK_BASE_SIZE + payload_size`；
- 空指针返回 `ErrorCode::PTR_NULL`；
- 尺寸不对返回 `ErrorCode::SIZE_ERR`；
- 输出缓冲区不够返回 `ErrorCode::NO_BUFF`。

## 当前 packet 格式

当前头部固定为 `16` 字节，完整 packet 额外再跟一个尾部 `CRC8`：

| 字段 | 字节数 | 说明 |
|------|--------|------|
| `prefix` | 1 | 固定前缀，当前为 `0x5A` |
| `data_len_raw` | 3 | 小端 24 位 payload 长度 |
| `topic_name_crc32` | 4 | topic 名称 CRC32 键 |
| `timestamp_us_raw` | 6 | 小端 48 位微秒时间戳 |
| `version` | 1 | 当前协议版本，主线为 `0x01` |
| `pack_header_crc8` | 1 | 头部 CRC8 |
| `payload` | N | 负载字节 |
| trailing `crc8` | 1 | 整包尾 CRC8 |

也就是说，完整大小是：

```cpp
LibXR::Topic::PACK_BASE_SIZE + payload_size
```

其中当前 `PACK_BASE_SIZE = 17`。

## 解析字节流

`Topic::Server` 是一个状态机解析器。典型用法：

```cpp
LibXR::Topic::Server server(512);
server.Register(topic);

size_t delivered = server.ParseData(LibXR::ConstRawData(packet));
```

如果在回调或 ISR 路径喂数据，使用：

```cpp
server.ParseDataFromCallback(LibXR::ConstRawData(packet), true);
```

当前 `Server` 的职责是：

- 在输入流中同步到下一条 packet 起点；
- 校验头部和尾部 CRC；
- 根据 `topic_name_crc32` 找到已注册的 topic；
- 按 topic 的类型契约把 payload 发布给订阅者。

## 注册 topic 的要求

```cpp
server.Register(topic);
```

注册时主线会检查两件事：

- `payload_size + PACK_BASE_SIZE` 必须装得进 `Server` 的内部暂存缓冲区；
- `payload_alignment <= CACHE_LINE_SIZE`。

所以 `Server(buffer_length)` 里的 `buffer_length` 不是随便写的，它决定了这台解析器最多能接住多大的 packet。

## 解析时的兼容规则

当前 `Server` 的 packet 到 topic 发布之间还有一条兼容边界：

- 如果收到的 payload **短于** topic 固定大小，只保证前缀部分有效，后半段未定义；
- 如果收到的 payload **长于** topic 固定大小，只保留前缀部分，多余字节直接截断。

这条规则是为了兼容长度有偏差的上游，不是为了鼓励随意混用不同 payload 契约。

## 当前不会做的事

这条链路现在**不会**做下面这些事：

- 不从 topic 里导出 latest payload；
- 不要求 `Topic` 开启缓存；
- 不提供旧版 `DumpData()` 系列接口；
- 不自动把 packet 解释成“弱类型 topic”。

如果你看到旧代码写的是：

```cpp
topic.DumpData(pkt);
topic.DumpData(val);
```

那就是旧语义，需要改成：

- 手里已经有业务对象时，直接 `PackData(value, packet)`；
- 手里已经是 raw payload 时，使用 `PackRaw()`；
- 需要 latest cache 时，在上层模块自己维护一份状态。

## 最小链路示例

```cpp
LibXR::Topic::Domain domain("msg");
auto topic = LibXR::Topic::CreateTopic<double>("temperature", &domain);

double rx_value = 0.0;
auto cb = LibXR::Topic::Callback::Create(
    [](bool, double* target, LibXR::MicrosecondTimestamp, double& data)
    {
        *target = data;
    },
    &rx_value);
topic.RegisterCallback(cb);

LibXR::Topic::PackedData<double> packet;
topic.PackData(48.48, packet, LibXR::MicrosecondTimestamp(4004));

LibXR::Topic::Server server(512);
server.Register(topic);
server.ParseData(LibXR::ConstRawData(packet));
```

这条链路的结果是：`Server` 解析 packet 后，会把 payload 重新发布到该 topic，然后由回调订阅者接收。

## 接口速览

| 接口 | 作用 |
|------|------|
| `PackedData<T>` | 一条完整 packet 的强类型字节布局 |
| `PackData()` | 用当前 topic 契约打包强类型 payload |
| `PackRaw()` | 用当前 topic 契约打包 raw payload |
| `Server::Register()` | 注册可接收 packet 的 topic |
| `Server::ParseData()` | 普通上下文解析输入字节流 |
| `Server::ParseDataFromCallback()` | 回调 / ISR 路径解析输入字节流 |

如果你的场景是“进程内直接发订阅”，优先看 [`Topic` 页面](./topic.md)。如果你的场景是“Linux 进程间共享大 payload”，优先看 [`LinuxSharedTopic`](./linux-shared-topic.md)。
