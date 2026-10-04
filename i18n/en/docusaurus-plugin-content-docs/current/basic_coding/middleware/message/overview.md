---
id: message-overview
title: Message System
slug: /basic_coding/middleware/message
sidebar_position: 0
---

# Message System
## Contents

- [Topic Basics, Subscription Models, and Dispatch Semantics](./topic.md)
- [Packet Packing and Parsing](./packet-server.md)
- [Linux Shared-Memory Topic](./linux-shared-topic.md)

## Scope

This group covers three public paths:

- `Topic`: in-process strongly typed message publish/subscribe
- `Topic::Server` / `Packet`: packing and parsing over byte-stream transports such as UART, buses, or network links
- `LinuxSharedTopic`: Linux host-side cross-process Topics over shared memory

The core `Topic` contract is strongly typed dispatch: each publish is dispatched synchronously to subscribers by type, and `Topic` itself does not keep the latest message.
