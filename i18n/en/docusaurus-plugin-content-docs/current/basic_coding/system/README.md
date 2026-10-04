---
id: system-coding
title: Operating System
sidebar_position: 4
---

# Operating System

This chapter covers LibXR's common interface for threads, synchronization primitives, and timers. Backends: Linux, FreeRTOS, ThreadX, Webots, WebAssembly, and none (no operating system).

## Contents

- [Thread](./thread.md)
- [Mutex](./mutex.md)
- [Semaphore](./semaphore.md)
- [Async](./async.md)
- [Timer](./timer.md)

Backends differ in implementation (for example priority inheritance, and polling waits and direct thread calls on threadless backends); see each page for details.
