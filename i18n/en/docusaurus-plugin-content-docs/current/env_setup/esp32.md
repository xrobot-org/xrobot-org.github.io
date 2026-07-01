---
id: env-setup-esp32
title: ESP32 Environment Setup
sidebar_position: 3
---

# ESP32 Environment Setup

The ESP32 line follows the official `ESP-IDF` workflow directly.

Official entry:

- [ESP-IDF Getting Started](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/index.html)

If your target is actually `ESP32-C3 / S3 / C6`, switch to the corresponding chip-specific getting-started page.

## Project Integration

LibXR still integrates on ESP32 through [`cmake/esp32.cmake`](https://github.com/Jiu-xiao/libxr/blob/master/cmake/esp32.cmake), but the precondition is explicit: it **must** run inside an ESP-IDF component project.

For a standard ESP-IDF `Hello World` style project, finish `idf_component_register(...)` in `main/CMakeLists.txt` first, then append:

```cmake
include(path_to_libxr/cmake/esp32.cmake)
```

Replace `path_to_libxr` with your actual LibXR path, and keep this line after `idf_component_register(...)`.

## What `esp32.cmake` Does

The current script directly does all of the following:

- sets `LIBXR_SYSTEM=freertos`
- sets `LIBXR_DRIVER=esp`
- enables `LIBXR_STATIC_BUILD`
- adds `libxr` as a subdirectory if target `xr` does not already exist
- links official ESP-IDF targets such as `idf::freertos`, `idf::driver`, `idf::hal`, `idf::usb`, `idf::esp_timer`, `idf::esp_event`, `idf::esp_netif`, `idf::esp_wifi`, `idf::esp_adc`, and `idf::nvs_flash`
- automatically links split driver targets such as `idf::esp_driver_gpio` and `idf::esp_driver_ledc` when the current IDF version exposes them

It also explicitly checks for `idf::freertos` and fails immediately when that target is missing. This script is not intended for a plain standalone CMake project outside the ESP-IDF build model.

## Current Environment Note

The current `docker-image-esp32` ships with `ESP-IDF v5.4.1` preinstalled. If your local environment uses a newer stable `5.x` release, the overall integration model still applies, but the exact component split and directory layout should follow your actual installed IDF.

## Notes

The ESP32 line is documented around the official `ESP-IDF + CMake + idf.py` workflow. There is no separate parallel environment flow maintained outside that model.
