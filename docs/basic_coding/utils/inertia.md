---
id: inertia
title: Inertia（惯性与质心）
sidebar_position: 3
---

# Inertia（惯性与质心）

`inertia.hpp` 提供两个类型：

- `LibXR::Inertia<Scalar>`：刚体惯性张量与质量；
- `LibXR::CenterOfMass<Scalar>`：质心位置与质量。

与 [Transform](./transform.md) 页面中的类型一样，这一组接口也受 `LIBXR_NO_EIGEN` 控制。

---

## 1. `Inertia<Scalar>`

### 1.1 数据组成

`Inertia<Scalar>` 包含两部分公开数据：

- `data[9]`：3x3 惯性张量；
- `mass`：质量。

默认构造时：

- `mass = 0`；
- `data` 被清零。

### 1.2 构造方式

支持以下几种主要构造方式：

- `Inertia(mass, data[9])`
- `Inertia(mass, matrix[3][3])`
- `Inertia(mass, arr[6])`
- `Inertia(mass, xx, yy, zz, xy, yz, xz)`
- `Inertia(mass, Eigen::Matrix<Scalar, 3, 3>)`

6 元形式和 7 参数形式按 `xx, yy, zz, xy, yz, xz` 的顺序接收主惯性矩和惯性积，构造时把惯性积取负后存为非对角元（例如 `(0, 1)` 元为 `-xy`）；9 元数组、3x3 数组和 Eigen 矩阵形式按完整张量原样存储。

### 1.3 主要操作

- 转换为 `Eigen::Matrix<Scalar, 3, 3>`
- `operator()(i, j)` 访问张量元素
- `operator+` 与另一个 3x3 矩阵相加
- `Translate(p)`：按平移向量做惯性平移
- `Rotate(R)`：按旋转矩阵旋转惯性张量
- `Rotate(q)`：按四元数旋转惯性张量

这些接口主要用于把局部坐标系下的惯性信息转换到新的姿态或参考点。

---

## 2. `CenterOfMass<Scalar>`

`CenterOfMass<Scalar>` 用于表达“位置 + 质量”的质心信息。

公开数据包括：

- `position`
- `mass`

支持的常见构造方式：

- `CenterOfMass(mass, Position)`
- `CenterOfMass(mass, Eigen::Matrix<3,1>)`
- `CenterOfMass(inertia, transform)`

并提供：

- `operator+`
- `operator+=`

可用于把多个刚体质心逐步合成为总质心。

---

## 3. 使用示例

```cpp
#include <libxr.hpp>

LibXR::Inertia<> body_inertia(1.5, 0.02, 0.03, 0.04, 0.0, 0.0, 0.0);

LibXR::Position<> offset(0.1, 0.0, 0.0);
auto moved = body_inertia.Translate(offset);

LibXR::Quaternion<> q = LibXR::EulerAngle<>(0.0, 0.0, 1.57).ToQuaternion();
auto rotated = moved.Rotate(q);

LibXR::Transform<> pose(q, LibXR::Position<>(0.2, 0.0, 0.0));
LibXR::CenterOfMass<> cog(rotated, pose);
```

---

## 4. 使用建议

- 如果只需要“几何姿态”，使用 `Transform / Quaternion / RotationMatrix` 即可；只有在涉及质量分布、质心、惯性换算时才需要 `Inertia`。
- `Translate()` 和 `Rotate()` 会返回新的惯性对象，适合按坐标系变换链逐步构造结果。
- 当工程关闭 Eigen（`LIBXR_NO_EIGEN`）时，这些类型不可用，不应作为公共模块边界的一部分。
