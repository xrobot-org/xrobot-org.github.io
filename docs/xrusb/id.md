---
id: xrusb-id
title: VID/PID 与 Serial 使用约定
sidebar_position: 4
---

# VID/PID 与 Serial 使用约定

XRUSB 通过 OpenMoko 社区 USB PID Registry 登记并获得一组 USB VID/PID（1D50:6199），用于示例代码与通用开发板固件，登记记录见 [openmoko-usb-oui 的提交 27f3846](https://github.com/openmoko/openmoko-usb-oui/commit/27f3846d77e0d0d10271b809b831f70040c6197a)。

在满足以下约定的前提下，任何基于 XRUSB 协议栈的固件，都可以复用这组 VID/PID，而不必另外购买 PID：

1. 必须通过 Serial 区分不同设备 / 厂商。
2. Serial 的厂商品牌前缀需要向本项目贡献者申请，并显式添加到本文档（申请不收取任何费用）。
3. Serial 生成规则为：

   ```text
   <厂商品牌前缀>-<产品/项目前缀>-<UID_HEX>
   ```

   详细要求见下文。

> CMSIS-DAP 这类为了兼容既有主机工具链而使用特定识别信息的设备，不受本页默认约定约束；以对应设备类页面说明为准。

## Serial 规则

### 1. 厂商品牌前缀

- 厂商品牌前缀用于标识「谁」在使用这组 VID/PID。
  - 前缀长度不少于 6 个字符。
  - 前缀只能包含可见 ASCII 字符，不允许空格和控制字符。
  - 不对大小写做限制，但是建议同一个前缀只使用一种写法：全大写、全小写或首字母大写。
- 建议：
  - 使用能够明显代表团队 / 公司 / 学校的缩写或名称，例如：`XRobot`、`QDU-Future` 等。
  - 不建议使用过短或含义不明的前缀（例如单字符 `X`、`A` 等）。

### 2. 产品/项目前缀

- 由该厂商自行定义，用于区分不同产品或项目线。
- 也应仅使用可见 ASCII 字符，推荐长度 1–16 字符。
- 示例：`CDC`、`IMU`、`MainCtrl`、`RobotArm` 等。

### 3. UID_HEX

- 从芯片的硬件 UID 读取原始字节，并转换为十六进制字符串。
- 推荐直接使用完整 UID：
  - 例如 STM32 / CH32 常见 UID 为 96bit（12 字节），对应 24 个十六进制字符。
- 代码中只填写前缀：语言包的第三个字符串写成 `<厂商品牌前缀>-<产品/项目前缀>-`，UID 以 `{addr, size}` 作为设备构造函数的最后一个参数传入，协议栈把 UID 原始字节转换为大写十六进制字符串追加在前缀之后。UID 地址示例：
  - STM32：`{reinterpret_cast<void*>(UID_BASE), 12}`
  - CH32V2/V3：`{reinterpret_cast<void*>(0x1FFFF7E8), 12}`

> 对同一块物理设备，Serial 应在固件升级、重刷时保持不变，通常意味着始终从同一硬件 UID 派生 Serial。

### 4. 示例

在遵守上述规则的前提下，合法的 Serial 示例如下：

```text
XRobot-CDC-0123456789ABCDEF01234567
QDU-Future-MainCtrl-89ABCDEF0123456701234567
```

其中：

- `XRobot` / `QDU-Future` 为已申请并登记在本文档中的厂商品牌前缀；
- `CDC` / `MainCtrl` 为产品/项目前缀；
- 末尾为 UID_HEX。

## 允许场景

在遵守本文件约定的前提下，对于任何商用 / 个人用途均允许复用 VID/PID = 1D50:6199。
本项目不对兼容性、驱动行为或各操作系统的识别结果做出任何保证。

尽管任何遵守约定的 `(VID, PID, Serial)` 组合在全局范围内都是唯一的，对于大型商用项目仍然建议申请独立的 VID/PID，以获得更强的可控性和品牌独立性。

## 如何申请厂商品牌前缀

申请厂商品牌前缀的方式如下（免费）：

1. 在本网站的仓库 [xrobot-org/xrobot-org.github.io](https://github.com/xrobot-org/xrobot-org.github.io/issues) 提交 issue，说明希望申请的前缀和用途；
2. Fork 该仓库，修改本文档，在「分配列表」中添加申请的厂商品牌前缀，然后提交 Pull Request；
3. 通过本项目提供的邮箱 / 社区 / 交流群联系维护者（见项目首页说明）。

申请通过后，该厂商品牌前缀会加入下面的分配列表，并可按本文件的约定复用 VID/PID。

## 分配列表

### XRobot 项目团队

- `XRUSB-DEMO`：用于 XRUSB 演示 / 例程  
- `XRobot`：用于 XRobot 发布的产品  

### 青岛大学 RoboMaster 未来战队

- `QDU-Future`：用于机器人主控
