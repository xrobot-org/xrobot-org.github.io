---
id: perf-topic
title: 消息系统性能测试
sidebar_position: 3
---

# 消息系统性能测试

本页汇总消息系统性能基准的参考资料。

当前可公开参考的基准仓库在这里：

- [Jiu-xiao/FuckingRosLatency](https://github.com/Jiu-xiao/FuckingRosLatency)

阅读这类结果时，至少要同时看清：

- 测试是在什么系统和调度条件下跑的；
- 测的是进程内 `Topic`、Linux 共享内存路径，还是别的链路；
- payload 大小、订阅方式、发布频率和统计口径分别是什么。
