---
id: database
title: 闪存数据库
sidebar_position: 5
---

# Database 闪存数据库

LibXR 提供了两种轻量级的嵌入式键值数据库实现：`DatabaseRawSequential` 和 `DatabaseRaw<MinWriteSize>`。
它们均继承自抽象接口类 `Database`，用于嵌入式 Flash 等顺序写入存储介质，具备主备冗余、断电保护、类型安全封装，适配不同的存储对齐约束。

---

## 主要功能

- 主块和备份块冗余存储，每个块带版本头和写完标记，启动时据此判断主块是否完整，损坏时从备份块恢复；
- 提供统一接口 `Database` 与模板封装 `Database::Key<T>`，支持类型安全读写；
- 两种实现模式：
  - `DatabaseRawSequential`：顺序写入，适用于不支持逆序写入的 Flash；
  - `DatabaseRaw<MinWriteSize>`：面向最小写入单元受限的 Flash 后端，通过模板参数约束最小写入单元大小，并在构造时接收底层 `Flash` 与回收阈值；
- 键值更新后会由数据库实现自动保存；`Restore()` 用于清空数据库并回到初始状态。

---

## 使用示例

### 创建数据库对象

示例在 Linux 上用 `LinuxBinaryFileFlash<容量>` 以文件模拟 Flash（`#include "linux_flash.hpp"`，位于 `driver/linux/`），三个参数依次为文件路径、最小擦除单元和最小写入单元。

```cpp
LinuxBinaryFileFlash<2048> flash("/tmp/flash.bin", 512, 8);
DatabaseRawSequential db(flash);
```

或使用 `DatabaseRaw<MinWriteSize>`：

```cpp
LinuxBinaryFileFlash<2048> flash2("/tmp/flash2.bin", 512, 16);
DatabaseRaw<16> db(flash2, 128);
```

`DatabaseRawSequential(flash, max_buffer_size = 256)` 在 RAM 中分配 `max_buffer_size` 字节的缓冲区，取值不超过 Flash 容量的一半；`DatabaseRaw<MinWriteSize>(flash, recycle_threshold = 128)` 的模板参数不小于 Flash 的最小写入单元，启动或查找键时失效键数超过 `recycle_threshold` 会触发回收。

### 定义类型安全的键

```cpp
int value = 42;
Database::Key<int> key(db, "my_key", value);

// 写入新值
key = 123;

// 读取回变量
key.Load();
printf("value = %d\n", static_cast<int>(key));
```

---

## 类型安全封装：Key

模板类 `Database::Key<T>` 提供类型安全的键值封装，构造时会尝试从数据库中加载键值，若不存在则添加新键。

```cpp
struct Config { uint32_t baudrate; uint8_t mode; };
Database::Key<Config> cfg(db, "uart_cfg", {9600, 1});

// 写入配置
cfg = {115200, 0};

// 加载配置
cfg.Load();
```

- `T` 应为可平凡复制（trivially copyable）的类型，例如基本类型、数组和由它们组成的结构体；
- 赋值操作 `key = value` 会自动更新数据库；
- 可通过 `key.Load()` 显式从数据库刷新内容。
- 键的数据长度在第一次写入时固定。之后用不同长度的类型绑定同名键时，`Load()` 和 `Set()` 返回 `ErrorCode::FAILED`，变量取构造时给出的初值，数据库中的原值保留。

---

## 常用接口

| 方法/操作 | 功能描述 |
|-----------|----------|
| `Key<T>(db, name, init)` | 绑定键；键不存在时以 `init` 写入数据库 |
| `Key<T>(db, name)` | 同上，初值为全零 |
| `Key<T>::Set(T)` / `operator=(T)` | 设置键值并写入数据库，返回 `ErrorCode` |
| `Key<T>::Save()` | 把当前变量值写入数据库 |
| `Key<T>::Load()` | 从数据库加载键值到变量 |
| `Key<T>::operator T()` | 返回当前变量值（不从数据库加载） |
| `DatabaseRawSequential::Restore()` | 清空顺序写数据库并重新初始化 |
| `DatabaseRaw<MinWriteSize>::Restore()` | 清空 raw 数据库并重新初始化 |
| `DatabaseRaw<MinWriteSize>::Recycle()` | 整理存储区，回收失效键占用的空间 |

---

## 工作机制概述

尽管不同实现的底层机制有所区别，但统一遵循如下设计原则：

- 使用主块和备块交替写入，确保写入过程可恢复；
- 键值以原始名值对顺序存放，块尾的固定标记表示该块已完整写入；
- `Init()` 内部自动判断有效块并尝试恢复数据；
- `Restore()` 可主动清空主备数据并初始化空数据库；
- 每个派生类自动处理页对齐、可用空间等底层逻辑，用户无需关心。

---

## 注意事项

- 请优先使用 `Database::Key<T>` 类型封装进行读写；
- 构造 `Key` 时若键不存在，会把初值写入数据库；之后在 `key = val`、`key.Set(val)` 或 `key.Save()` 时写入，值与已存内容相同时不写 Flash；
- 对所有键值数据类型要求为 POD 且可拷贝存储；
- 键不存在或数据长度与已存键不同时，`Set()` 返回 `ErrorCode::FAILED`；`DatabaseRaw` 回收后空间仍不足时返回 `ErrorCode::FULL`；构造 `Key` 时添加新键失败，或底层 Flash 读、写、擦除失败，触发 `REQUIRE` 终止；
- 若要显式清空数据库，可调用具体实现类的 `Restore()`。

---

## 应用场景

- 嵌入式设备参数存储；
- 状态断点续存；
- 多模块配置持久化；
- 内存受限设备上的键值存储；

---

## 示例测试

测试见 LibXR 仓库的 [`test/automatic/middleware/database/`](https://github.com/xrobot-org/libxr/tree/master/test/automatic/middleware/database)：`database/test_database.cpp` 检查 `Key` 的读写和错误码，`raw_sequential/` 检查多键更新、重新打开和 Flash 故障处理，`raw/` 另外覆盖长度不匹配和损坏恢复。
