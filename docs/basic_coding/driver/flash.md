---
id: flash
title: 闪存接口
sidebar_position: 9
---

# Flash（闪存接口）

`LibXR::Flash` 提供跨平台的闪存访问接口，用于按块擦除和写入。现有后端为 `STM32Flash`、`CH32Flash`（片上 Flash）和 `LinuxBinaryFileFlash`（以文件模拟）。

## 接口定义

```cpp
class Flash {
public:
  Flash(size_t min_erase_size, size_t min_write_size, RawData flash_area);

  // 擦除指定区域（起始偏移与长度）
  virtual ErrorCode Erase(size_t offset, size_t size) = 0;

  // 写入数据到指定偏移地址
  virtual ErrorCode Write(size_t offset, ConstRawData data) = 0;

  // 读取指定偏移地址的数据
  virtual ErrorCode Read(size_t offset, RawData data);

  // 获取最小可擦除块大小
  size_t MinEraseSize() const;

  // 获取最小可写入块大小
  size_t MinWriteSize() const;

  // 获取flash大小
  size_t Size() const;
};
```

## 使用说明

- 后端通常围绕 `MinWriteSize()` / `MinEraseSize()` 这样的最小擦写粒度组织实现；上层布局应按这些粒度设计，但具体是否作为前置限制、以及如何分块处理，仍由具体后端决定；
- `flash_area` 是该 `Flash` 对象可操作的存储区域，`Size()` 返回其长度；
- `Read()` 在基类中有默认实现，从 `flash_area` 按内存复制；`flash_area` 可直接按地址读取时，后端只需实现 `Erase()` 和 `Write()`；
- 上层可基于该接口实现参数存储、文件系统、日志管理等功能。
