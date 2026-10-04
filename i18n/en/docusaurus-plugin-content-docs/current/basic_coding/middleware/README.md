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

For detailed API descriptions, see the individual pages.
