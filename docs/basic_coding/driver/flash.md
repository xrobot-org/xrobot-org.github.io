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
- `STM32Flash`、`CH32Flash` 由扇区表构造。扇区表是 `FlashRegion{address, sector_size, sector_count}` 的数组，每项描述一段大小相同的连续扇区，按地址顺序列出整片 Flash；STM32 工程的扇区表由代码生成器写入 `User/flash_map.hpp`，构造参数见 [Flash数据库](../../code_gen/stm32/flash.md)；
- `Read()` 在基类中有默认实现，从 `flash_area` 按内存复制；`flash_area` 可直接按地址读取时，后端仅实现 `Erase()` 和 `Write()`；
- 在带片上 Flash ECC 保护的 STM32 系列上，`STM32Flash` 对掉电打断写入造成的双位 ECC 错误提供恢复路径：
  - STM32H7、H7R/S：`Read()` 按 Flash 字屏蔽中断并忽略总线错误读取，检测到双位 ECC 错误（`DBECCERR` / `DBECCERRF`）时将对应位置缓冲区填 `0` 并返回 `ErrorCode::OK`，供 `DatabaseRaw` 等上层按未完成写入处理；`Write()` 写入前比较读到双位 ECC 错误时返回 `ErrorCode::CHECK_ERR`（擦除后恢复可写）；H7R/S 的 `MIN_WRITE_SIZE` 为 `16` 字节；
  - STM32G0、G4、L4、L5、WB、WL、U0、U5、WBA、H5、U3：读到双位 ECC 错误单元会触发不可屏蔽中断（NMI），须在 `NMI_Handler` 中调用 `libxr_stm32_flash_ecc_nmi()`（见 [Flash数据库](../../code_gen/stm32/flash.md#ecc-掉电恢复)）；
- 上层可基于该接口实现参数存储、文件系统、日志管理等功能。
