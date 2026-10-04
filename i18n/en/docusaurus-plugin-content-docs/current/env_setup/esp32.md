---
id: env-setup-esp32
title: ESP32 Environment Setup
sidebar_position: 3
---

# ESP32 Environment Setup

The ESP32 line follows the official `ESP-IDF` workflow directly.

Official entry:

- [ESP-IDF Getting Started](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/index.html)

For `ESP32-C3 / S3 / C6` and other chips, see the getting-started page of that chip.

## Project Integration

LibXR still integrates on ESP32 through [`cmake/esp32.cmake`](https://github.com/xrobot-org/libxr/blob/master/cmake/esp32.cmake), but the precondition is explicit: it **must** run inside an ESP-IDF component project.

For a standard ESP-IDF `Hello World` style project, finish `idf_component_register(...)` in `main/CMakeLists.txt` first, then append:

```cmake
include(path_to_libxr/cmake/esp32.cmake)
```

`path_to_libxr` is the path of LibXR; the line goes after `idf_component_register(...)`.

## What `esp32.cmake` Does

The script does the following:

- sets `LIBXR_SYSTEM=freertos` and `LIBXR_DRIVER=esp`, and turns on `LIBXR_STATIC_BUILD`
- when `LIBXR_SINGLE_CORE` is not defined, sets it from `CONFIG_SOC_CPU_CORES_NUM` and `CONFIG_FREERTOS_UNICORE`: `OFF` on a multi-core chip without `CONFIG_FREERTOS_UNICORE`, `ON` otherwise
- adds LibXR with `add_subdirectory` when target `xr` does not exist yet
- links `xr` to the IDF components that exist: `idf::freertos`, `idf::driver`, `idf::hal`, `idf::usb`, `idf::esp_hw_support`, `idf::esp_timer`, `idf::esp_event`, `idf::esp_netif`, `idf::esp_wifi`, `idf::esp_adc`, `idf::nvs_flash`, and the split `idf::esp_driver_gpio` and `idf::esp_driver_ledc` of newer IDF versions
- finally links `xr` to the current component (`target_link_libraries(${COMPONENT_LIB} PUBLIC xr)`), which is why the `include` line goes after `idf_component_register(...)`

The script checks that `idf::freertos` exists and fails otherwise, so it works only in a component built by `idf.py`.

## Current Environment Note

The `docker-image-esp32` image ships `ESP-IDF v5.4.1`. Newer stable `5.x` releases use the same integration; the component split and directory layout follow the installed IDF.
