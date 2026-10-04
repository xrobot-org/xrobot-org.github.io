---
id: xrusb-dev-stack-dfu-bootloader
title: DFU Bootloader
sidebar_position: 8
---

# DFU Bootloader 设备协议栈

本文档描述 XRUSB 的 bootloader DFU 实现：

- 前端设备类：`LibXR::USB::DfuBootloaderClass`
- 存储与状态机后端：`LibXR::USB::DfuBootloaderBackend`

这条路径用于设备已经进入 bootloader 后的 `DNLOAD / UPLOAD / manifest` 流程。

---

## 1. 类与构造方式

### 1.1 `LibXR::USB::DfuBootloaderBackend`

`DfuBootloaderBackend` 围绕 `LibXR::Flash` 抽象实现 bootloader 侧的存储与状态机。

构造函数：

```cpp
LibXR::USB::DfuBootloaderBackend backend(
    flash,
    image_offset,
    image_limit,
    seal_offset,
    jump_to_app,
    jump_app_ctx,
    true);
```

参数说明：

- `flash`：底层 `Flash` 实例
- `image_offset`（`DfuBootloaderClass` 中名为 `image_base`）：镜像区在 `flash` 对象内的起始偏移，不是绝对地址
- `image_limit`：镜像区总长度
- `seal_offset`：镜像区内 seal 记录偏移
- `jump_to_app`：跳转到应用固件的回调
- `jump_app_ctx`：跳转上下文
- `autorun`：manifest 完成后是否允许自动进入应用

### 1.2 `LibXR::USB::DfuBootloaderClass`

对外使用时通常直接构造 `DfuBootloaderClass`，它是
`DfuBootloaderClassT<4096>` 的别名。

```cpp
LibXR::USB::DfuBootloaderClass dfu_bl(
    flash,
    image_base,
    image_limit,
    seal_offset,
    jump_to_app,
    jump_app_ctx,
    true,
    "XRUSB DFU");
```

该类内部组合了：

- `DfuBootloaderBackend`
- `DFUClass<Backend, MAX_TRANSFER_SIZE>`

---

## 2. 接口与描述符

`DfuBootloaderClass` 只贡献 1 个 DFU 接口，不使用 IAD，也不申请额外数据端点，所有数据都经控制传输完成。

- `GetInterfaceCount() = 1`
- `HasIAD() = false`
- `bInterfaceClass = 0xFE`
- `bInterfaceSubClass = 0x01`
- `bInterfaceProtocol = 0x02`

DFU Functional Descriptor 的关键字段来自 backend 上报的 `DFUCapabilities`：

- `can_download`
- `can_upload`
- `manifestation_tolerant`
- `will_detach`
- `detach_timeout_ms`
- `transfer_size`

当前默认别名 `DfuBootloaderClass` 的最大传输块尺寸是 `4096` 字节，写入描述符时会同步到 `wTransferSize`。

除可选的 WebUSB BOS capability 外，bootloader DFU 路径还会通过 `DfuInterfaceClassBase` 默认发布 WinUSB MS OS 2.0 描述符集；若构造时不额外覆盖，当前默认使用的是 device-scoped WinUSB 元数据。

---

## 3. 支持的请求与行为

支持的请求：

| 请求 | 行为 |
| ---- | ---- |
| `DNLOAD` | 下载固件块，零长度 `DNLOAD` 进入 manifest |
| `UPLOAD` | 从镜像区按块回读 |
| `GETSTATUS` | 返回当前 DFU 状态、错误码与 poll timeout |
| `GETSTATE` | 返回当前状态机状态 |
| `ABORT` | 终止当前传输会话 |
| `CLRSTATUS` | 清除错误态 |

补充：

- bootloader 态 `DETACH` 不实现，会按协议错误处理
- 额外支持 vendor request `0x5A`，用于请求运行已验证镜像

---

## 4. Backend 负责的内容

`DfuBootloaderBackend` 负责：

- download / upload / manifest 会话状态
- 按擦除块管理 Flash 擦除
- 按块缓存并延迟执行写入
- 计算镜像 CRC32
- 写入 seal 记录
- 维护镜像是否有效、是否可启动

seal 记录格式为：

```cpp
struct SealRecord
{
  uint32_t magic;
  uint32_t image_size;
  uint32_t crc32;
  uint32_t crc32_inv;
};
```

其中 `magic` 固定为 `"SEAL"` 对应的 `0x4C414553`。

---

## 5. 运行方式

Bootloader DFU 需要外部周期调用 `Process()`：

```cpp
dfu_bl.Process();
```

`Process()` 负责推进 backend 的延迟动作，包括：

- 处理待提交写入
- 处理 manifest

`Process()` 须在主循环或周期任务中持续调用。不调用时，主机看到的 `GETSTATUS` 一直处于等待状态，写入和 manifest 不会继续。

若启用了 `autorun`，镜像 ready 后仍需要上层显式消费启动请求：

```cpp
if (dfu_bl.TryConsumeAppLaunch(now_ms))
{
}
```

或者通过 `RequestRunApp()` / vendor request `0x5A` 记录一次“请求运行应用”的标志；真正跳转仍发生在后续 `TryConsumeAppLaunch(...)` 被上层显式消费时。

---

## 6. 使用示例

```cpp
#include "dfu/dfu_bootloader.hpp"

static void JumpToApp(void*)
{
  BoardJumpToApplication();
}

LibXR::USB::DfuBootloaderClass dfu_bl(
    flash,
    APP_IMAGE_OFFSET,  // flash 对象内的偏移
    APP_IMAGE_LIMIT,
    APP_SEAL_OFFSET,
    JumpToApp,
    nullptr,
    true);

// USB class list: {{&dfu_bl}}
// usb_dev.Init(false);
// usb_dev.Start(false);

for (;;)
{
  dfu_bl.Process();
  dfu_bl.TryConsumeAppLaunch(LibXR::Timebase::GetMilliseconds());
}
```

---

## 7. 与 Runtime DFU 的关系

- Runtime DFU：应用态响应 `DETACH` 并跳入 bootloader
- DFU Bootloader：bootloader 态负责镜像传输、seal、manifest 和运行应用
