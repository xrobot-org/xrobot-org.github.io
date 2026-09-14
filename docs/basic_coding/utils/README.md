---
id: utils-coding
title: 数学与工具
sidebar_position: 6
---

# 数学与工具

本模块汇总 LibXR 当前主线中直接公开给用户的轻量状态工具与几何/运动学工具。

## 特点

- **面向基础能力**：既包含不依赖平台的 `Flag` 状态工具，也包含位置、姿态、惯性、运动学链等数学类型。
- **与主线导出一致**：本目录对应 `libxr.hpp` 当前直接导出的 `flag / transform / inertia / kinematic` 相关接口。
- **编译边界清晰**：除 `Flag` 外，其余页面对应的类型都受 `LIBXR_NO_EIGEN` 控制；禁用 Eigen 时，这些类型不会参与编译。

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
