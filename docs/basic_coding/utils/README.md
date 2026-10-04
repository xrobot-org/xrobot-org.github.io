---
id: utils-coding
title: 数学与工具
sidebar_position: 6
---

# 数学与工具

本模块汇总 LibXR 的轻量工具与几何/运动学类型。

## 特点

- 包含不依赖平台的 `Flag`、`SerializedService`、PID、周期角度与数值编码、CRC 等工具，也包含位置、姿态、惯性、运动学链等数学类型。
- `libxr.hpp` 直接导出 `flag / transform / inertia / kinematic` 相关接口；`serialized_service.hpp`、`pid.hpp`、`cycle_value.hpp`、`float_encoder.hpp` 和 `crc.hpp` 按各页面示例单独包含。
- `Transform`、`Inertia`、`Kinematic` 受 `LIBXR_NO_EIGEN` 控制；禁用 Eigen 时，这些类型不参与编译。

## 目录

- [Flag（轻量标志位）](./flag.md)
- [Transform（坐标与姿态变换）](./transform.md)
- [Inertia（惯性与质心）](./inertia.md)
- [Kinematic（运动学链）](./kinematic.md)
- [SerializedService（串行服务）](./serialized_service.md)
- [PID 控制器](./pid.md)
- [周期角度与数值编码](./value_encoding.md)
- [CRC 校验](./crc.md)

更多接口说明见各页面。
