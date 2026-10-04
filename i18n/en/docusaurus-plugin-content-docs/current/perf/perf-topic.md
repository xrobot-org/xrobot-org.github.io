---
id: perf-topic
title: Message System Performance
sidebar_position: 3
---

# Message System Performance

A comparison of latency and CPU usage between ROS 2 and LibXR on an image-message path is available in the [LibXR and ROS 2 latency comparison benchmark](https://github.com/Jiu-xiao/FuckingRosLatency); there, ROS 2 intra-process communication corresponds to the ordinary LibXR `Topic`, and multi-process pub/sub corresponds to `LibXR::LinuxSharedTopic`.

The LibXR repository contains host-side `LinuxSharedTopic` benchmarks under `test/automatic/middleware/message/topic/`:

- `bench_standard.cpp`: continuous publication, reporting publish rate, receive latency, and errors;
- `bench_latency.cpp`: waits for receive acknowledgement per message and measures handoff latency;
- `bench_overload.cpp`: compares FULL and DROP_OLD with a slow subscriber;
- `bench_modes.cpp`: compares broadcast, drop-old, and load-balanced subscriber modes.

One set of results for the first three on a Linux host is given in sections 6 and 9 of [LinuxSharedTopic Design](../adv_coding/middleware/linux_shared_topic_design.md).

Keep the two data paths separate when reading results. In-process `Topic::Publish()` dispatches synchronously in the publisher context, while `LinuxSharedTopic` hands shared payload slots and descriptors between processes. Match payload size, subscription mode, and consumer work before comparing them.

Read throughput together with latency and error/drop counters. If a shared-memory benchmark touches only part of a payload, bandwidth calculated from the full logical frame size represents message handoff rate; it does not mean the CPU read or wrote every payload byte at that rate.

These automatic benchmarks are maintained with the repository source. When comparing LibXR revisions, rerun the benchmark source from each corresponding revision instead of treating old numbers as current results.
