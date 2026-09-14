---
id: perf-topic
title: 消息系统性能测试
sidebar_position: 3
---

# 消息系统性能测试

原有的跨框架延迟测试可参考：

- [Jiu-xiao/FuckingRosLatency](https://github.com/Jiu-xiao/FuckingRosLatency)

当前 LibXR 仓库还包含 `LinuxSharedTopic` 的主机侧基准，位置为 `test/automatic/middleware/message/topic/`。这些测试分别覆盖：

- `linux_shm_bench.cpp`：连续发布，统计发布速率、接收延迟和错误计数；
- `linux_shm_latency_bench.cpp`：每条消息等待接收确认后再继续，统计单条交接延迟；
- `linux_shm_overload_bench.cpp`：慢订阅者条件下比较 FULL 与 DROP_OLD；
- `linux_shm_subscriber_modes_bench.cpp`：比较广播、丢旧和负载分担模式。

读取结果时要区分两条数据路径：进程内 `Topic::Publish()` 在发布者上下文同步分发；`LinuxSharedTopic` 通过共享 payload 槽和描述符在进程间交接。两者的 payload 大小、订阅方式和消费者处理量应保持一致后再比较。

基准输出中的吞吐、延迟和错误计数需要一起看。共享内存测试若只更新 payload 的部分字节，则按完整帧大小折算出的带宽表示逻辑消息交接速率，不等同于 CPU 实际逐字节读写了同样的数据量。

这些自动测试随仓库源码维护；比较不同 LibXR 版本时，使用对应版本的测试源码重新运行，不把旧版本数字直接当成当前结果。
