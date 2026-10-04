---
id: middleware-coding
title: 中间件
sidebar_position: 3
---

# 中间件

本节汇总 LibXR 中用于系统服务、通信和终端交互的中间件。

中间件包括日志、事件、消息（进程内 Topic、数据打包与解析、Linux 共享内存 Topic）、Flash 键值数据库、内存文件系统和命令行终端。Topic 支持同步、异步、队列和回调四种订阅方式，数据库适配不同的 Flash 最小写入单元。

## 目录

- [Logger 日志系统](./logger.md)
- [Event 事件系统](./event.md)
- [消息系统](/docs/basic_coding/middleware/message)
- [Database 键值数据库](./database.md)
- [RamFS 内存文件系统](./ramfs.md)
- [Terminal 命令终端](./terminal.md)

说明：

- 当前主线中的消息系统已经不再适合用一页概括全部行为；`Topic`、`Packet/Server`、`LinuxSharedTopic` 的契约和取舍差异应分别进入对应页面阅读。
- `RamFS` 当前公开的是 `Custom` 节点模型，而不是旧材料中曾出现过的 `Device` 节点模型。

更多接口说明见各页面。
