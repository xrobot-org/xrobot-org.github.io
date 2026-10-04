---
id: kinematic
title: Kinematic（运动学链）
sidebar_position: 4
---

# Kinematic（运动学链）

`kinematic.hpp` 提供一组基于 `Transform / Inertia / List` 的运动学链工具，命名空间为：

```cpp
namespace LibXR::Kinematic
```

它主要面向串联关节结构的前向运动学、目标姿态传播、逆运动学求解、惯性分布与质心计算。

与 [Transform](./transform.md) 和 [Inertia](./inertia.md) 一样，这一组接口受 `LIBXR_NO_EIGEN` 控制。

---

## 1. 核心类型

### 1.1 `Joint<Scalar>`

`Joint` 表示一个旋转关节，配置保存在 `param_` 中：

- `param_.parent2this`：父坐标系到当前关节的变换；
- `param_.this2child`：当前关节到子物体坐标系的变换；
- `param_.axis`：关节旋转轴；
- `param_.ik_mult`：逆运动学步长系数，默认 1.0，由 `SetBackwardMult()` 设置。

常用接口：

- `SetState(angle)`
- `SetTarget(angle)`
- `SetBackwardMult(mult)`

`SetState()` 与 `SetTarget()` 对大于 π 的角度减去一次 2π，对小于 -π 的角度加上一次 2π；输入在 [-3π, 3π] 内时，结果落在 [-π, π]。

> `Joint` 构造时会为关节链表节点做一次动态分配。

### 1.2 `Object<Scalar>`

`Object` 表示关节连接的刚体节点，内部维护：

- `joints`：子关节链表；
- `parent`：父关节指针；
- `param_`：当前物体的惯性参数；
- `runtime_`：当前 / 目标姿态运行态。

常用接口：

- `SetPosition(pos)`
- `SetQuaternion(quat)`

### 1.3 `StartPoint<Scalar>`

`StartPoint` 表示整条运动学链的起点，提供：

- `CalcForward()`：按当前状态做前向运动学；
- `CalcTargetForward()`：按目标状态做前向运动学；
- `CalcInertia()`：沿链计算惯性分布；
- `CalcCenterOfMass()`：计算当前质心；
- `cog`：保存当前计算得到的质心结果。

### 1.4 `EndPoint<Scalar>`

`EndPoint` 表示链末端，提供：

- `SetTargetPosition(pos)`
- `SetTargetQuaternion(quat)`
- `SetErrorWeight(weight)`
- `SetMaxAngularVelocity(v)`
- `SetMaxLineVelocity(v)`
- `CalcBackward(dt, max_step, max_err, step_size)`
- `GetPositionError()`、`GetQuaternionError()`：目标位姿与末端目标状态之间的位置误差和姿态误差

`CalcBackward(...)` 用雅可比矩阵伪逆迭代求逆运动学，返回最后一次迭代的加权 6 维误差向量。

> `EndPoint::CalcBackward()` 首次调用时会为雅可比矩阵和关节增量向量做动态分配。

---

## 2. 典型工作流

典型调用顺序：

1. 创建 `StartPoint / Object / EndPoint` 以及对应的 `Inertia`；
2. 用 `Joint` 把父子节点连接起来；
3. 调用 `SetState()` 设置关节当前角度；
4. 调用 `CalcForward()` 计算当前姿态链；
5. 为末端设置目标位置 / 目标姿态；
6. 调用 `CalcBackward(...)` 求一轮逆运动学；
7. 调用 `CalcTargetForward()` 传播目标姿态；
8. 按需再调用 `CalcCenterOfMass()` 或 `CalcInertia()`。

---

## 3. 使用示例

```cpp
#include <libxr.hpp>

LibXR::Inertia<> base_inertia;
LibXR::Inertia<> tip_inertia;

LibXR::Kinematic::StartPoint<> base(base_inertia);
LibXR::Kinematic::EndPoint<> tip(tip_inertia);

LibXR::Transform<> base_to_joint;
LibXR::Transform<> joint_to_tip;

LibXR::Kinematic::Joint<> joint(
    LibXR::Axis<>::Z(), &base, base_to_joint, &tip, joint_to_tip);

joint.SetState(0.0);
base.CalcForward();

tip.SetTargetPosition(LibXR::Position<>(0.1, 0.0, 0.0));
tip.CalcBackward(0.001, 10, 1e-3, 1.0);
base.CalcTargetForward();
```

这个示例只展示最小调用路径；真实机器人模型通常还会有更多关节、明确的几何参数和误差权重配置。

---

## 4. 使用建议

- 如果只需要姿态变换，不必引入整套 `Kinematic` 工具；直接使用 `Transform / Quaternion / Position` 即可。
- 如果运行环境严格限制动态分配，需要注意 `Joint` 构造与首次调用 `EndPoint::CalcBackward()` 会触发 `new`。
- 逆运动学的收敛速度与稳定性和 `ik_mult`、`err_weight_`、`max_step`、`step_size` 等参数直接相关，实际工程中应按机构特性调参。
