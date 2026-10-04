---
id: perf-topic
title: 消息系统性能测试
sidebar_position: 3
---

# 消息系统性能测试

ROS 2 与 LibXR 在图像消息链路上的延迟和 CPU 占用对比见 [LibXR 与 ROS 2 的延迟对比基准](https://github.com/Jiu-xiao/FuckingRosLatency)，其中 ROS 2 的 intra-process 通信对应 LibXR 的普通 `Topic`，多进程 pub/sub 对应 `LibXR::LinuxSharedTopic`。

LibXR 仓库在 `test/automatic/middleware/message/topic/` 中包含 `LinuxSharedTopic` 的主机侧基准，分别覆盖：

- `bench_standard.cpp`：连续发布，统计发布速率、接收延迟和错误计数；
- `bench_latency.cpp`：每条消息等待接收确认后再继续，统计单条交接延迟；
- `bench_overload.cpp`：慢订阅者条件下比较 FULL 与 DROP_OLD；
- `bench_modes.cpp`：比较广播、丢旧和负载分担模式。

前三项在一台 Linux 主机上的一组结果见 [LinuxSharedTopic 设计](../adv_coding/middleware/linux_shared_topic_design.md) 的第 6 节和第 9 节。

读取结果时要区分两条数据路径：进程内 `Topic::Publish()` 在发布者上下文同步分发；`LinuxSharedTopic` 通过共享 payload 槽和描述符在进程间交接。两者的 payload 大小、订阅方式和消费者处理量应保持一致后再比较。

基准输出中的吞吐、延迟和错误计数需要一起看。共享内存测试若只更新 payload 的部分字节，则按完整帧大小折算出的带宽表示逻辑消息交接速率，不等同于 CPU 实际逐字节读写了同样的数据量。

这些自动测试随仓库源码维护；比较不同 LibXR 版本时，使用对应版本的测试源码重新运行，不把旧版本数字直接当成当前结果。
