---
id: perf-topic
title: Messaging System Performance Tests
sidebar_position: 3
---

# Messaging System Performance Tests

This page lists published messaging-performance benchmarks.

The currently public benchmark repository is:

- [Jiu-xiao/FuckingRosLatency](https://github.com/Jiu-xiao/FuckingRosLatency/blob/master/README_en.md)

When reading those results, check at least:

- which system and scheduler conditions were used;
- whether the path being measured is in-process `Topic`, Linux shared memory, or something else;
- the payload size, subscription form, publish frequency, and statistics method.

If you first want to understand which mainline mechanisms are relevant, start from:

- [Topic](../basic_coding/middleware/message/topic.md)
- [Linux Shared-Memory Topic](../basic_coding/middleware/message/linux-shared-topic.md)
- [Memory FastCopy / FastSet / FastCmp](../basic_coding/core/core-mem.md)
