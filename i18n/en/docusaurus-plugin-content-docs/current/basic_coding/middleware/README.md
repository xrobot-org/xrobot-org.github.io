---
id: middleware-coding
title: Middleware
sidebar_position: 3
---

# Middleware

This section covers the LibXR middleware for system services, communication, and terminal interaction.

The middleware consists of logging, events, messaging (in-process Topic, packet packing and parsing, Linux shared-memory Topic), a Flash key-value database, an in-memory file system, and a command-line terminal. Topic supports synchronous, asynchronous, queued, and callback subscribers; the database adapts to different Flash minimum write units.

## Contents

- [Logger System](./logger.md)
- [Event System](./event.md)
- [Message System](/docs/basic_coding/middleware/message)
- [Database Key-Value Storage](./database.md)
- [RamFS In-Memory File System](./ramfs.md)
- [Terminal Command Interface](./terminal.md)

Notes:

- In current mainline, the message subsystem is no longer best understood as one catch-all page; the contracts and tradeoffs of `Topic`, `Packet/Server`, and `LinuxSharedTopic` are split into their own pages and should be read there.
- Current `RamFS` public docs are based on the `Custom` node model, not the older `Device` node model that appeared in older materials.

For detailed API descriptions, see the individual pages.
