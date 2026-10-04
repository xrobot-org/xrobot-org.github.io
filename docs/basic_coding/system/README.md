---
id: system-coding
title: 操作系统
sidebar_position: 4
---

# 操作系统

本章介绍 LibXR 对线程、同步原语和定时器的统一接口，后端有 Linux、FreeRTOS、ThreadX、Webots、WebAssembly 和无操作系统（none）。

## 目录

- [Thread（线程）](./thread.md)
- [Mutex（互斥锁）](./mutex.md)
- [Semaphore（信号量）](./semaphore.md)
- [Async（异步任务）](./async.md)
- [Timer（定时器）](./timer.md)

各后端的实现方式不同（例如优先级继承、无线程后端的轮询等待和线程直调），具体行为见各页面。
