---
id: env-setup-esp32
title: ESP32 环境配置
sidebar_position: 3
---

# ESP32 环境配置

ESP32 使用官方 `ESP-IDF` 工作流。

官方入口：

* [ESP-IDF Getting Started](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32/get-started/index.html)

`ESP32-C3 / S3 / C6` 等芯片见对应芯片的 `Getting Started` 页面。

## 工程接入

LibXR 在 ESP32 上仍然通过 [`cmake/esp32.cmake`](https://github.com/xrobot-org/libxr/blob/master/cmake/esp32.cmake) 接入，但它的前提很明确：**必须运行在 ESP-IDF 的 component 工程里**。

对于官方 `Hello World` 这种标准工程，在 `main/CMakeLists.txt` 里先写完 `idf_component_register(...)`，再在后面加入：

```cmake
include(path_to_libxr/cmake/esp32.cmake)
```

`path_to_libxr` 为 LibXR 所在路径，这一行放在 `idf_component_register(...)` 之后。

## `esp32.cmake` 会做什么

这份脚本完成以下工作：

* 设置 `LIBXR_SYSTEM=freertos`、`LIBXR_DRIVER=esp`，并打开 `LIBXR_STATIC_BUILD`
* 未定义 `LIBXR_SINGLE_CORE` 时，按 `CONFIG_SOC_CPU_CORES_NUM` 和 `CONFIG_FREERTOS_UNICORE` 设定：多核且未启用 `CONFIG_FREERTOS_UNICORE` 时为 `OFF`，否则为 `ON`
* 目标 `xr` 不存在时用 `add_subdirectory` 加入 LibXR
* 把 `xr` 链接到存在的 IDF 组件：`idf::freertos`、`idf::driver`、`idf::hal`、`idf::usb`、`idf::esp_hw_support`、`idf::esp_timer`、`idf::esp_event`、`idf::esp_netif`、`idf::esp_wifi`、`idf::esp_adc`、`idf::nvs_flash`，以及新版 IDF 拆分出的 `idf::esp_driver_gpio`、`idf::esp_driver_ledc`
* 最后把 `xr` 链接到当前组件（`target_link_libraries(${COMPONENT_LIB} PUBLIC xr)`），因此这行 `include` 要放在 `idf_component_register(...)` 之后

脚本检查 `idf::freertos` 是否存在，不存在时报错，因此只能在由 `idf.py` 构建的组件中使用。

## 当前环境信息

当前 `docker-image-esp32` 预装 `ESP-IDF v5.4.1`。更新的 `5.x` 稳定版本使用相同的接入方式，组件拆分和目录结构以所安装的 IDF 为准。
