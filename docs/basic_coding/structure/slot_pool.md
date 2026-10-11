---
id: slot_pool
title: SlotPool
sidebar_position: 11
---

# SlotPool（消息槽池）

`LibXR::SlotPool<T>` 是面向任务与中断的小容量消息槽池：每个槽一个原子状态，写完的槽按发布顺序出队。

以 CAN 发送队列为例：任务和中断回调都会调用 `AddMessage()` 入队，发送服务在任务或发送完成中断里出队。任务在入队或出队做到一半时可能被中断打断；`MPMCQueue` 在这种情况下会返回瞬时的 FULL/EMPTY（假的满/空），`SlotPool` 保证一个被打断的操作只占住它自己的槽，中断拿到的 FULL/EMPTY 反映那一刻的真实状态。

## 核心特性

- 每个槽一个原子状态：空闲、写入中、就绪、读取中。所有转换用 CAS 完成，同一时刻一个槽只属于一个执行上下文；
- `Publish()` 开始时取一个全局递增的发布序号，`Take()` 在已就绪的槽中选序号最小的：同一发布者内部保序；
- `Acquire()`/`Take()` 扫描全部槽位，被其他上下文占着的槽直接跳过，一个还没写完的槽不会挡住其他槽；
- 释放计数和发布计数用于扫描后的重扫判断，最多重扫一次；序号用带符号差值比较，允许回绕；
- 槽在构造时分配，运行期不再分配；对象不可拷贝、不可移动；
- 适用于几到几十个槽的小容量场合，`Acquire()`/`Take()` 是 O(N) 扫描。

## 常用接口

```cpp
template <typename T>
class SlotPool
{
 public:
  explicit SlotPool(size_t slot_count);

  ErrorCode Acquire(size_t& index);   // 空闲 → 写入中；没有空闲槽返回 FULL
  void Publish(size_t index);         // 写入中 → 就绪，并取得发布序号
  ErrorCode Take(size_t& index);      // 序号最小的就绪槽 → 读取中；没有就绪槽返回 EMPTY
  void Release(size_t index);         // 写入中或读取中 → 空闲，不会失败
  T& At(size_t index);                // 访问自己持有的槽

  ErrorCode Put(const T& value);      // Acquire + 拷贝 + Publish
  ErrorCode Get(T& value);            // Take + 拷贝 + Release

  size_t Size() const;                // 槽总数
};
```

- `Acquire()`、`Publish()`、`Take()`、`Release()` 是底层接口，数据通过 `At()` 在槽内原地读写，适合"数据在槽里原地写、原地发送，发送完成后再释放"的用法；
- `Put()`/`Get()` 是便捷接口，一次调用完成入队或出队，要求 `T` 平凡可拷贝；
- 只用 `Acquire()`/`Release()` 时，槽池可以当固定容量的分配器使用，放弃一个只认领未发布的槽也是合法用法。

## 并发约束

- 任意数量的生产者和消费者都可以，任务和普通中断里都能调用；不要在 NMI 里使用；
- 单核上，中断扫描期间低优先级上下文不会改动槽，中断里拿到的 FULL/EMPTY 反映那一刻的真实状态；被打断的操作占着的槽算作占用；
- 出队顺序按发布序号：同一发布者内部保序；一个还没发布完的槽不会挡住其他就绪槽，因此不保证跨发布者的全局先进先出；
- `Publish()` 和 `Release()` 的调用方必须持有对应槽，重复发布或释放其他上下文持有的槽是调用方错误。

## 使用示例

```cpp
LibXR::SlotPool<LibXR::CAN::ClassicPack> tx_pool(8);

// 任务或中断中提交一帧；FULL 表示确实没有空闲槽
void AddMessage(const LibXR::CAN::ClassicPack& pack)
{
  if (tx_pool.Put(pack) != LibXR::ErrorCode::OK)
  {
    // 池满：这一帧没有入队
  }
}

// 发送服务中取出并交给硬件
void TxService()
{
  LibXR::CAN::ClassicPack pack{};
  if (tx_pool.Get(pack) == LibXR::ErrorCode::OK)
  {
    // pack 已拷出，槽已释放，可以直接交给硬件发送
  }
}
```

## 选择建议

- 中断会读写、拿到 FULL 只能丢数据的场合（例如中断与任务共享的发送队列）：用 `SlotPool`，一个被打断的操作只占自己的槽，FULL/EMPTY 是准的；
- 调用方能等待或稍后重试、大容量或多核高争用的场合：用 `MPMCQueue`，单次入队出队 O(1)，`SlotPool` 是 O(N)；
- 生产者和消费者各只有一个：`SPSCQueue`；
- 只关心最新一份完整值：`LatestSnapshot`；
- 管理可复用的对象而不是消息：`ObjectPool`。
