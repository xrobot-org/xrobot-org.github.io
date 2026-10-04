---
id: utils-coding
title: 数学与工具
sidebar_position: 6
---

# 数学与工具

本节汇总 LibXR 的工具和数学类型。

`libxr.hpp` 导出 `Flag`、`Transform`、`Inertia` 和 `Kinematic`；`SerializedService`、`PID`、`CycleValue`、`FloatEncoder` 和 CRC 类按各页面示例分别包含 `serialized_service.hpp`、`pid.hpp`、`cycle_value.hpp`、`float_encoder.hpp` 和 `crc.hpp`。`Transform`、`Inertia`、`Kinematic` 基于 Eigen，定义 `LIBXR_NO_EIGEN` 时这三组类型不参与编译。

## 目录

- [Flag（轻量标志位）](./flag.md)：原子标志、普通标志，以及进入作用域时改写、离开时恢复标志的 `ScopedRestore`。
- [Transform（坐标与姿态变换）](./transform.md)：位置、方向轴、欧拉角、旋转矩阵、四元数和刚体变换。
- [Inertia（惯性与质心）](./inertia.md)：惯性张量 `Inertia` 和质心 `CenterOfMass`，支持平移、旋转和质心合成。
- [Kinematic（运动学链）](./kinematic.md)：串联关节的运动学链，包括正运动学、雅可比伪逆逆运动学、惯性分布和质心计算。
- [SerializedService（串行服务）](./serialized_service.md)：合并多个入口的事件，同一时刻只由一个调用者执行处理函数。
- [PID 控制器](./pid.md)：比例、积分、反馈微分和前馈，带积分限幅、输出限幅和周期角度误差。
- [周期角度与数值编码](./value_encoding.md)：`CycleValue` 处理周期角度，`FloatEncoder` 把有限区间内的浮点数量化为整数码。
- [CRC 校验](./crc.md)：`CRC8`、`CRC16`、`CRC32`、`CRC64` 的计算，以及 CRC8/16/32 对尾部校验值的验证。

更多接口说明见各页面。
