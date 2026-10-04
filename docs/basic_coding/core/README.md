---
id: core-coding
title: 核心组件
sidebar_position: 1
---

# 核心组件

本章介绍 LibXR 的核心头文件：数据类型、错误处理、回调、读写端口、时间戳和终端格式等基础功能。

## 概览

- [`libxr_def`](./core-def.md)：常用宏定义、错误码与基础常量
- [`libxr_assert`](./core-assert.md)：断言机制与致命错误回调
- [`libxr_cb`](./core-cb.md)：类型安全的回调机制
- [`libxr_type`](./core-type.md)：原始数据封装与类型识别
- [`libxr_mem`](./core-mem.md)：内存复制、清零与比较辅助
- [`libxr_string`](./core-string.md)：运行期构造、长期保留的字符串 `RuntimeStringView`
- [`libxr_color`](./core-color.md)：终端输出格式与 ANSI 控制
- [`print`](./core-print.md)：编译期格式化输出与 sink 与有界缓冲区包装
- [`libxr_time`](./core-time.md)：微秒/毫秒级时间戳与时间差
- [`libxr_rw`](./core-rw.md)：通用读写接口与操作封装
- [`Operation`](./core-op.md)：异步完成反馈模型
- [`Pipe`](./core-pipe.md)：基于共享字节队列的单向管道
