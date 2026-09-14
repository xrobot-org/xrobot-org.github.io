---
id: xrusb-dev-stack-hid
title: HID
sidebar_position: 2
---

# HID 设备协议栈

本节介绍 XRUSB 的 **USB HID（Human Interface Device）** 设备类实现与扩展方式，覆盖：

- HID 模板化基类 `LibXR::USB::HID<REPORT_DESC_LEN, TX_REPORT_LEN, RX_REPORT_LEN>`
- 自动生成配置描述符块（Interface + HID Descriptor + Endpoint Descriptors）
- 可选 **Interrupt OUT**（Output Report over Interrupt OUT）
- 标准请求 `GET_DESCRIPTOR`（HID / Report Descriptor）
- HID 类请求（`GET_REPORT/SET_REPORT/GET_IDLE/SET_IDLE/GET_PROTOCOL/SET_PROTOCOL`）处理框架
- Input Report 发送与 IN/OUT 完成回调
- 典型派生类：鼠标、键盘、手柄

---

## 1. 基类概览

### 1.1 `LibXR::USB::HID<REPORT_DESC_LEN, TX_REPORT_LEN, RX_REPORT_LEN>`

`HID` 为模板化 HID 基类（继承自 `DeviceClass`），通过模板参数在编译期固化报告与描述符尺寸，方便派生实现键盘、鼠标、手柄等设备。

模板参数：

- `REPORT_DESC_LEN`：Report Descriptor 长度（字节）
- `TX_REPORT_LEN`：Input Report 最大长度（Interrupt IN 端点最大包长）
- `RX_REPORT_LEN`：Output Report 最大长度（Interrupt OUT 端点最大包长）
  - 若需要使用 OUT 中断端点，除设置合适的 `RX_REPORT_LEN` 外，还需要在构造时显式启用 `enable_out_endpoint`

基类提供：

- 端点申请与配置：Interrupt IN（必选）+ Interrupt OUT（可选）
- 配置描述符块自动生成
- `GET_DESCRIPTOR`（HID / Report）响应
- HID 类请求处理框架（可在派生类中覆盖/扩展）
- Input Report 发送辅助：`SendInputReport(...)`
- IN/OUT 传输完成回调钩子：`OnDataInComplete(...)` / `OnDataOutComplete(...)`

---

## 2. 描述符与端点布局

### 2.1 Interface

HID 基类贡献 **1 个 HID 接口**，不使用 IAD：

- `bInterfaceClass = 0x03`（HID）
- `bNumEndpoints = 1`（仅 IN）或 `2`（IN + OUT）

### 2.2 HID Descriptor（0x21）

配置描述符中包含 HID 类描述符（9 字节），关键字段：

- `bcdHID = 0x0111`（HID v1.11）
- `bNumDescriptors = 1`
- `bReportDescriptorType = 0x22`
- `wReportDescriptorLength = REPORT_DESC_LEN`

### 2.3 Endpoints

| 端点             | 方向 | 类型      |        最大包长 | 用途                      |
| ---------------- | ---- | --------- | --------------: | ------------------------- |
| IN 端点          | IN   | INTERRUPT | `TX_REPORT_LEN` | 设备 → 主机 Input Report  |
| OUT 端点（可选） | OUT  | INTERRUPT | `RX_REPORT_LEN` | 主机 → 设备 Output Report |

轮询间隔：

- `in_ep_interval_` / `out_ep_interval_` 会写入端点描述符的 `bInterval`

说明：不同速率下 `bInterval` 语义不同（FS 常按 1ms 帧；HS 为 microframe 编码）。本实现以“毫秒”语义组织参数，最终解释取决于底层 USB 控制器/栈。

---

## 3. 生命周期：Bind / Unbind

### 3.1 Bind（初始化）

初始化阶段通常完成：

1. 记录接口号，并清理运行态标志
2. 从 `EndpointPool` 申请 Interrupt IN，按 `TX_REPORT_LEN` 配置
3. 若构造时启用了 `enable_out_endpoint`：申请 Interrupt OUT，按 `RX_REPORT_LEN` 配置
4. 生成并提交配置描述符块（Interface + HID Descriptor + Endpoint Descriptors）
5. 注册端点完成回调（IN 必选；OUT 可选）
6. 若启用 OUT：启动首次 OUT 接收（之后每次完成会自动 re-arm）
7. 置 `inited_ = true`

### 3.2 Unbind（释放）

解绑阶段通常完成：

- 清 `inited_`，关闭并归还 IN/OUT 端点到 `EndpointPool`
- 端点指针置空

---

## 4. 标准请求：GET_DESCRIPTOR（HID / Report）

基类处理标准请求 `GET_DESCRIPTOR`：

- `DescriptorType = 0x21`：返回 HID Descriptor
- `DescriptorType = 0x22`：返回 Report Descriptor
- 其他类型（如 Physical 0x23）：返回不支持

返回数据会按 `wLength` 截断，避免超出主机请求长度。

派生类需要提供 Report Descriptor（基类会调用）：

```cpp
virtual ConstRawData GetReportDesc() = 0;
```

---

## 5. HID 类请求与数据阶段

基类支持常见 HID Class-Specific Requests：

- `GET_REPORT`
  - 根据 `wValue` 高字节区分 `INPUT/OUTPUT/FEATURE`，并调用派生钩子生成返回数据
- `SET_REPORT`
  - Setup 阶段完成基本校验，并准备接收数据
  - Data 阶段到来时回调派生钩子处理具体内容
- `GET_IDLE / SET_IDLE`
  - 维护 `idle_rate_`（单位 4ms，常见实现仅支持 `report_id = 0`）
- `GET_PROTOCOL / SET_PROTOCOL`
  - 维护 `protocol_`（BOOT / REPORT）

建议派生类覆写的钩子（按需）：

- 获取报告：`OnGetInputReport(...)` / `OnGetLastOutputReport(...)` / `OnGetFeatureReport(...)`
  - 其中基类默认的 `OnGetLastOutputReport(...)` 仅返回空数据；如需通过控制传输返回最近的 Output Report，需要派生类自行覆写
- 设置报告：`OnSetReport(...)`（Setup 阶段）与 `OnSetReportData(...)`（Data 阶段）
- 自定义扩展：`OnCustomClassRequest(...)` / `OnCustomClassData(...)`
  - 对于基类未直接处理的类请求，默认实现返回 `NOT_SUPPORT`

---

## 6. 数据通路：Interrupt IN/OUT

### 6.1 发送 Input Report：`SendInputReport(...)`

典型行为：

1. 校验初始化与端点存在
2. 校验 `0 < report_len <= TX_REPORT_LEN`
3. 校验 IN 端点空闲，否则返回 `BUSY`
4. 复制 report 到 IN 端点缓冲并启动传输

常见返回码语义（以栈定义为准）：

- `OK`：成功启动传输
- `BUSY`：端点仍在传输
- `ARG_ERR`：报告长度非法
- `FAILED/NO_BUFF`：端点/缓冲不可用

### 6.2 接收 Output Report（Interrupt OUT，可选）

若启用 OUT 端点，基类默认会持续接收：

- Bind 后启动一次 OUT 接收
- 每次 OUT 完成后：
  - 先回调 `OnDataOutComplete(in_isr, data)` 让派生类消费
  - 再自动 re-arm 继续接收下一帧

该路径适合处理“异步 Output Report”（例如键盘 LED 状态、手柄震动等）。

### 6.3 IN 完成回调

IN 发送完成后会触发 `OnDataInComplete(in_isr, data)`，典型用途：

- 发送队列推进（发送下一帧）
- 统计/监测（吞吐、链路状态等）

---

## 7. 典型派生类（概述）

### 7.1 `HIDMouse`

- 标准 Boot 鼠标
- Input Report：常见为 4 字节（Buttons + X + Y + Wheel）
- 仅启用 IN 端点

### 7.2 `HIDKeyboard`

- 标准 Boot 键盘
- Input Report：常见为 8 字节（Modifier + Reserved + 6 KeyCodes）
- 可选启用 OUT 端点（例如 1 字节 LED）
- 也可兼容主机通过控制端点下发 LED（`SET_REPORT`）

当前派生类还提供了几组与 LED 状态相关的接口：

- `SetOnLedChangeCallback(...)`
- `GetNumLock()`
- `GetCapsLock()`
- `GetScrollLock()`

### 7.3 `HIDGamepadT`

- 模板化手柄（例如 4 轴 + 8 按钮）
- Input Report 与 Report Descriptor 在编译期固化
- 通常提供便捷发送接口用于更新轴值与按键位图

当前主线中还直接提供了两个常用别名：

- `HIDGamepad = HIDGamepadT<0, 2047, 1>`
- `HIDGamepadBipolar = HIDGamepadT<-2048, 2047, 1>`

其中 `HIDGamepad` 适合单极范围输入，`HIDGamepadBipolar` 适合以 0 为中心的双极范围输入。

---

## 8. 使用示例（概念性）

说明：具体 USB Device 框架如何注册 class 列表取决于上层 `usb_dev` 实现；以下示例仅展示典型调用方式。

### 8.1 鼠标

```cpp
#include "hid_mouse.hpp"

using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::HIDMouse hid_mouse(EP::EP1);

// usb_dev class list: {{&hid_mouse}}
// usb_dev.Init();
// usb_dev.Start();

hid_mouse.Move(LibXR::USB::HIDMouse::LEFT, 10, 0);
hid_mouse.Release();
```

### 8.2 键盘（含 LED 回调）

```cpp
#include "hid_keyboard.hpp"

// enable_out_endpoint=true 可启用 OUT 中断端点接收 LED（可选）
using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::HIDKeyboard hid_kbd(EP::EP1, EP::EP1, true);

// 发送：Shift + A
hid_kbd.PressKey({LibXR::USB::HIDKeyboard::KeyCode::A},
                 LibXR::USB::HIDKeyboard::Modifier::LEFT_SHIFT);
hid_kbd.ReleaseAll();

// 可选：注册 LED 状态变化回调
hid_kbd.SetOnLedChangeCallback(
    LibXR::Callback<bool, bool, bool>::Create(
        [](bool in_isr, int, bool num_lock, bool caps_lock, bool scroll_lock) {
          (void)in_isr;
          (void)num_lock;
          (void)caps_lock;
          (void)scroll_lock;
        },
        0));
```

### 8.3 手柄

```cpp
#include "hid_gamepad.hpp"

using EP = LibXR::USB::Endpoint::EPNumber;
LibXR::USB::HIDGamepad gamepad(EP::EP1);
gamepad.Send(1024, 1024, 1024, 1024, LibXR::USB::HIDGamepad::BTN1);

LibXR::USB::HIDGamepadBipolar bipolar_gamepad(EP::EP2);
bipolar_gamepad.SendAxes(0, -512, 512, 0);
```

---

## 9. 扩展建议（派生类实现要点）

实现一个新的 HID 派生类通常需要：

1. 提供 Report Descriptor（实现 `GetReportDesc()`）
2. 定义并管理 Input Report 数据结构（长度不超过 `TX_REPORT_LEN`）
3. 如需 Output/Feature：
   - 控制传输：覆写 `OnSetReport(...) / OnSetReportData(...)`
   - OUT 中断端点：为 `RX_REPORT_LEN` 预留足够长度，并在构造时启用 `enable_out_endpoint`，再覆写 `OnDataOutComplete(...)`

如需连续发送/队列化，可在 `OnDataInComplete(...)` 中实现“发送下一帧”的调度。
