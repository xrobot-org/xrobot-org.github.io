---
id: env-setup-esp32
title: ESP32环境配置
sidebar_position: 3
---

# ESP32 环境配置

ESP32 使用官方 `ESP-IDF` 工作流。

官方入口：

* [ESP-IDF Getting Started](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32/get-started/index.html)

如果你实际用的是 `ESP32-C3 / S3 / C6`，切到对应目标芯片的 `Getting Started` 页面即可。

## 工程接入

LibXR 在 ESP32 上仍然通过 [`cmake/esp32.cmake`](https://github.com/Jiu-xiao/libxr/blob/master/cmake/esp32.cmake) 接入，但它的前提很明确：**必须运行在 ESP-IDF 的 component 工程里**。

对于官方 `Hello World` 这种标准工程，在 `main/CMakeLists.txt` 里先写完 `idf_component_register(...)`，再在后面加入：

```cmake
include(path_to_libxr/cmake/esp32.cmake)
```

注意把 `path_to_libxr` 替换成你的 LibXR 路径，而且这行要放在 `idf_component_register(...)` 之后。

## `esp32.cmake` 会做什么

这份脚本会直接完成这些事：

* 设置 `LIBXR_SYSTEM=FreeRTOS`
* 设置 `LIBXR_DRIVER=esp`
* 如有需要自动 `add_subdirectory(libxr)`
* 链接官方 `idf::freertos`、`idf::driver`、`idf::hal`、`idf::usb`、`idf::esp_timer`、`idf::esp_event`、`idf::esp_netif`、`idf::esp_wifi`、`idf::esp_adc`、`idf::nvs_flash`
* 在新版本 IDF 存在时，自动补上拆分后的 `idf::esp_driver_gpio`、`idf::esp_driver_ledc`

它还会显式检查 `idf::freertos` 是否存在；如果没有，直接报错。因此这份脚本不适用于脱离 `idf.py` 的普通 CMake 工程。

## 当前环境信息

当前 `docker-image-esp32` 里预装的是 `ESP-IDF v5.4.1`。如果你本地使用的是更新的 `5.x` 稳定版本，整体接入方式仍然成立，但实际组件拆分和目录结构仍然以你当前安装的官方 IDF 为准。
