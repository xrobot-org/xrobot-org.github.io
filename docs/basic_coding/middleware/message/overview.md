---
id: message-overview
title: 消息系统
slug: /basic_coding/middleware/message
sidebar_position: 0
---

# Message 消息系统
## 目录

- [Topic 基础、订阅与分发语义](./topic.md)
- [数据打包与解析](./packet-server.md)
- [共享内存 Topic（Linux）](./linux-shared-topic.md)

## 范围

这一组页面覆盖三条公开路径：

- `Topic`：进程内、强类型消息发布与订阅
- `Topic::Server` / `Packet`：面向串口、总线或网络字节流的数据打包与解析
- `LinuxSharedTopic`：Linux 主机侧、基于共享内存的跨进程 Topic

其中 `Topic` 当前主线的核心契约是“强类型分发”，而不是旧版本常见的“Topic 自带 latest cache”模型。
