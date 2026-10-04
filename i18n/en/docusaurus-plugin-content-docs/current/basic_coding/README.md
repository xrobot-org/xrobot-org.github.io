---
id: basic-coding
title: Basic Programming (LibXR)
sidebar_position: 4
---

# Basic Programming (LibXR)

This chapter introduces LibXR's CMake configuration and basic APIs. The basic APIs cover the core API, data structures, middleware, OS abstractions, device drivers, and math and utilities.

## Prerequisites

The examples in this chapter assume a project that links `xr` as described in [CMake Configuration](./cmake.md) and includes `libxr.hpp`. Device driver headers (such as `uart.hpp` and `gpio.hpp`) and some utility headers (such as `pid.hpp`, `cycle_value.hpp` and `serialized_service.hpp`) are not part of `libxr.hpp` and are included separately. With `LIBXR_NO_EIGEN` enabled, the contents of `transform.hpp`, `kinematic.hpp` and `inertia.hpp` are not compiled.

A program calls `LibXR::PlatformInit()` once before using other LibXR features; the parameters and the call order on each backend are described in [Platform initialization](./system/README.md#platform-initialization). The minimal Linux program below prints `Hello, 42`:

```cpp
#include "libxr.hpp"

int main()
{
  LibXR::PlatformInit();
  LibXR::STDIO::Printf<"Hello, %d\n">(42);
  LibXR::Thread::Sleep(100);  // wait for the STDIO thread to write
  return 0;
}
```

## Contents

- [CMake Configuration](./cmake.md)
- [Core API](/docs/basic_coding/core)
- [Data Structures](/docs/basic_coding/structure)
- [Middleware](/docs/basic_coding/middleware)
- [Operating System](/docs/basic_coding/system)
- [Device Drivers](/docs/basic_coding/driver)
- [Utilities and Math](/docs/basic_coding/utils)
