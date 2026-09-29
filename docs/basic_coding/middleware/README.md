---
id: middleware-coding
title: 中间件
sidebar_position: 3
---

# 中间件

本模块汇总了 LibXR 中用于系统服务、通信管理、终端交互等场景的中间件组件。

## 特点

- **统一封装**：提供事件、日志、主题发布、虚拟终端等核心中间件功能。
- **多种调用模型**：支持同步、异步、队列、回调等操作方式，适配不同场景。
- **高性能实现**：内部大量使用无锁链表/队列等数据结构，保障并发性能。
- **适配嵌入式限制**：支持 Flash 最小写入单元限制、内存受限设备上的键值存储等。

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
