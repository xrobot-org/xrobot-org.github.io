---
id: message-packet-server
title: Packet Packing and Parsing
sidebar_position: 2
---

# Packet Packing and Parsing

The current `Message` module exposes two transport-facing pieces:

- `Topic::PackData()` / `Topic::PackRaw()` to build a packet using the current topic contract;
- `Topic::Server` to parse incoming bytes into packets and deliver them back into registered topics.

This path now cares about only:

- the topic-name CRC32 key;
- the fixed payload size;
- the payload alignment requirement;
- packet header and tail CRC checks.

It **does not depend on topic cache anymore**, and it does not restore the older `DumpData()`-style latest-value behavior.

## Packing One Typed Message

```cpp
LibXR::Topic::Domain domain("msg");
auto topic = LibXR::Topic::CreateTopic<double>("temperature", &domain);

LibXR::Topic::PackedData<double> packet;
topic.PackData(36.5, packet, LibXR::MicrosecondTimestamp(123456));
```

If you do not pass a timestamp, `Topic::NowTimestamp()` is used implicitly:

```cpp
topic.PackData(36.5, packet);
```

`PackData()` packs the payload you pass directly. It does not require a prior `Publish()`.

## Packing Raw Payload Bytes

If you already hold payload bytes arranged according to the current topic contract, use `PackRaw()`:

```cpp
double value = 72.72;
uint8_t raw_packet[LibXR::Topic::PACK_BASE_SIZE + sizeof(double)] = {};

topic.PackRaw(LibXR::ConstRawData(value),
              LibXR::RawData(raw_packet, sizeof(raw_packet)),
              LibXR::MicrosecondTimestamp(6006));
```

Current `PackRaw()` boundaries:

- `data.size_` must equal the topic's `PayloadSize()`;
- the output buffer must hold at least `PACK_BASE_SIZE + payload_size`;
- null pointers return `ErrorCode::PTR_NULL`;
- mismatched payload size returns `ErrorCode::SIZE_ERR`;
- an undersized output buffer returns `ErrorCode::NO_BUFF`.

## Current Packet Layout

The current header is fixed at `16` bytes, followed by a trailing packet `CRC8`:

| Field | Bytes | Meaning |
|------|-------|---------|
| `prefix` | 1 | fixed packet prefix, currently `0x5A` |
| `data_len_raw` | 3 | little-endian 24-bit payload length |
| `topic_name_crc32` | 4 | topic-name CRC32 key |
| `timestamp_us_raw` | 6 | little-endian 48-bit microsecond timestamp |
| `version` | 1 | current packet version, `0x01` in mainline |
| `pack_header_crc8` | 1 | header CRC8 |
| `payload` | N | payload bytes |
| trailing `crc8` | 1 | packet tail CRC8 |

So the total size is:

```cpp
LibXR::Topic::PACK_BASE_SIZE + payload_size
```

and the current `PACK_BASE_SIZE` is `17`.

## Parsing a Byte Stream

`Topic::Server` is the state-machine parser. Typical usage:

```cpp
LibXR::Topic::Server server(512);
server.Register(topic);

size_t delivered = server.ParseData(LibXR::ConstRawData(packet));
```

For callback or ISR paths, use:

```cpp
server.ParseDataFromCallback(LibXR::ConstRawData(packet), true);
```

Current responsibilities of `Server`:

- synchronize the input stream to the next packet start;
- validate header and tail CRC;
- look up the registered topic by `topic_name_crc32`;
- publish the payload according to that topic's runtime contract.

## Registering Topics

```cpp
server.Register(topic);
```

Registration checks two things in current mainline:

- `payload_size + PACK_BASE_SIZE` must fit in the server's staging buffer;
- `payload_alignment <= CACHE_LINE_SIZE`.

So the `buffer_length` passed to `Server(buffer_length)` is meaningful. It determines the largest packet that this parser instance can safely stage.

## Compatibility Rule During Parsing

Current `Server` still has one compatibility boundary between incoming packets and typed topic delivery:

- if the packet payload is **shorter** than the topic's fixed payload size, only the prefix part is guaranteed valid and the remaining tail stays unspecified;
- if the packet payload is **longer** than the topic's fixed payload size, only the prefix matching the topic size is kept and the rest is truncated.

That rule exists for compatibility with imperfect upstream payload lengths. It is not a recommendation to mix incompatible payload contracts freely.

## What This Path No Longer Does

This path does **not** do the following anymore:

- export a latest payload from the topic;
- require topic cache to be enabled;
- provide the old `DumpData()` family of APIs;
- reinterpret packets as a weakly typed topic cache.

If old code still looks like this:

```cpp
topic.DumpData(pkt);
topic.DumpData(val);
```

then it is using old semantics and should be migrated to:

- `PackData(value, packet)` when you already have the business object;
- `PackRaw()` when you already have the raw payload bytes;
- an explicit module-owned cache when you truly need latest-value behavior.

## Minimal End-to-End Example

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

The result is that `Server` parses the packet, republishes the payload into the topic, and the callback subscriber receives it.

## Interface Summary

| Interface | Purpose |
|------|------|
| `PackedData<T>` | strong-typed byte layout of a full packet |
| `PackData()` | pack a typed payload using the current topic contract |
| `PackRaw()` | pack a raw payload using the current topic contract |
| `Server::Register()` | register a topic that may receive parsed packets |
| `Server::ParseData()` | parse input bytes in normal context |
| `Server::ParseDataFromCallback()` | parse input bytes in callback / ISR context |

If your problem is direct in-process publish-subscribe behavior, go back to the [`Topic` page](./topic.md). If your problem is Linux cross-process sharing of large payloads, go to [`LinuxSharedTopic`](./linux-shared-topic.md).
