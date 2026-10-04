---
id: perf-daplink
title: DAPLink(SWD)性能测试
sidebar_position: 4
---

# DAPLink（CMSIS-DAP v2 / SWD）性能测试

## 测试环境

* Probe：自制 DAPLink（CMSIS-DAP v2）
  * 主控：CH32V307 144 MHz
  * SWD：GPIO 翻转实现（SwdGeneralGPIO）
* USB：USBHS（High-Speed）
  * 端点类型：Bulk
  * MaxPacketSize：512
* 编译优化：`-O3`
* 目标芯片：STM32F401RC
* SWD 时钟：`SwdGeneralGPIO` 使用 `loops_per_us = 0`（无延时路径，SWCLK 由 GPIO 翻转速度决定，上位机 Speed 不改变 SWCLK），实测约 10 MHz

![daplink-benchmark](/img/dap.png)

## 测试代码

```cpp
static constexpr auto USB_OTG_HS_LANG_PACK =
      LibXR::USB::DescriptorStrings::MakeLanguagePack(
          LibXR::USB::DescriptorStrings::Language::EN_US,
          "XRobot", "CMSIS-DAP", "XROBOT-XRDAP-");

LibXR::USB::CDCUart cdc(128, 128, 3);

LibXR::Debug::SwdGeneralGPIO<decltype(PA0), decltype(PA4)> swd(PA0, PA4, 0);

LibXR::USB::DapLinkV2Class<decltype(swd)> dap(swd);

LibXR::CH32USBOtgHS usb_dev_hs(
    ...
    /* config */
    {{&dap, &cdc}},
    {reinterpret_cast<void*>(0x1FFFF7E8), 12});
...
```

## 测试方法

本测试包含两组指标：

1) 吞吐（不同块大小）：使用 `probe-rs` 的 benchmark 输出，固定参数如下：
* Speed=10000
* Word size=32bit
* Iterations=32
* 变更 Data length：32 / 128 / 2048 / 32768 bytes

2) SRAM 读写上限（固定长度）：使用 OpenOCD + TCL 脚本进行 SRAM 指定地址区间的 write/read/e2e 计时统计。

## 测试结果

### 吞吐（不同块大小）

Speed=10000，Word size=32bit，Iterations=32：

* Data length = 32 bytes  
  * Read : 167394.75 bytes/s（Std Dev 26285.19）  
  * Write: 164495.92 bytes/s（Std Dev 35468.60）

* Data length = 128 bytes  
  * Read : 365890.08 bytes/s（Std Dev 42441.94）  
  * Write: 376733.44 bytes/s（Std Dev 66519.33）

* Data length = 2048 bytes  
  * Read : 596184.47 bytes/s（Std Dev 19107.54）  
  * Write: 613571.24 bytes/s（Std Dev 34987.02）

* Data length = 32768 bytes  
  * Read : 598801.08 bytes/s（Std Dev 9090.12）  
  * Write: 625560.76 bytes/s（Std Dev 12092.70）

### SRAM 读写上限（固定长度）

* SRAM_WRITE_LIMIT：49152 bytes in 0.066248 s（724.55 KiB/s）
* SRAM_READ：49152 bytes in 0.069153 s（694.11 KiB/s）
* SRAM_E2E（write+read）：98304 bytes in 0.135401 s（709.01 KiB/s）

## 总结

本次测试基于 CH32V307 的 USBHS（512B Bulk）与 GPIO 翻转 SWD 实现 CMSIS-DAP v2（DAPLink），对 STM32F401RC 目标的 SRAM 访问吞吐进行了基准测量。

在 Speed=10000、32bit 访问、32 次迭代的条件下，大块传输（2KB～32KB）区间的读写吞吐稳定在约 0.6 MB/s 量级；固定长度 48 KiB 的 SRAM 端到端（write+read）吞吐约 709 KiB/s。
