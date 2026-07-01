---
id: transform
title: Transform（坐标与姿态变换）
sidebar_position: 2
---

# Transform（坐标与姿态变换）

`transform.hpp` 提供了 LibXR 当前主线中的一组几何基础类型，包括位置、方向、欧拉角、旋转矩阵、四元数与刚体变换。

这些类型当前都受 `LIBXR_NO_EIGEN` 控制：

- 未定义 `LIBXR_NO_EIGEN` 时，相关类型可用；
- 定义 `LIBXR_NO_EIGEN` 时，整个头文件内容不会参与编译。

模板参数默认使用：

```cpp
using DefaultScalar = LIBXR_DEFAULT_SCALAR;
```

也就是说，`Position<>`、`Quaternion<>`、`Transform<>` 等无显式模板参数时，都会落到当前工程配置的默认标量类型。

---

## 1. 主要类型

### 1.1 `Position<Scalar>`

`Position` 继承自 `Eigen::Matrix<Scalar, 3, 1>`，表示三维位置向量。

当前主线提供的常见能力包括：

- 通过 `(x, y, z)`、`Eigen::Matrix<3,1>` 或长度为 3 的数组构造；
- 通过 `RotationMatrix` / `Quaternion` 做旋转；
- 通过 `/` 与 `/=` 做逆旋转；
- 通过 `*=`、`/=` 做标量缩放。

### 1.2 `Axis<Scalar>`

`Axis` 同样继承自 `Eigen::Matrix<Scalar, 3, 1>`，用于表达方向或单位轴。

当前主线提供了三个便捷静态构造：

- `Axis<>::X()`
- `Axis<>::Y()`
- `Axis<>::Z()`

### 1.3 `EulerAngle<Scalar>`

`EulerAngle` 保存 `(roll, pitch, yaw)` 三个角度分量，并提供多种旋转顺序转换接口。

默认接口：

- `ToRotationMatrix()` 默认等价于 `ToRotationMatrixZYX()`；
- `ToQuaternion()` 默认等价于 `ToQuaternionZYX()`。

如果工程中已经固定了欧拉角顺序，建议显式调用 `XYZ / XZY / YXZ / YZX / ZXY / ZYX` 对应接口，避免默认顺序被误解。

### 1.4 `RotationMatrix<Scalar>`

`RotationMatrix` 继承自 `Eigen::Matrix<Scalar, 3, 3>`，默认构造为单位阵。

当前主线支持：

- 从 `Eigen::Matrix<3,3>`、`Eigen::Quaternion`、`LibXR::Quaternion`、数组构造；
- 与 `Position`、`Eigen::Matrix<3,1>`、其他 `RotationMatrix` 相乘；
- `ToEulerAngle()` 默认走 `ZYX` 顺序；
- `operator-()` 返回转置矩阵，也就是旋转逆。

> `operator-()` 在这里不是数值取负，而是“求逆旋转”的快捷写法。

### 1.5 `Quaternion<Scalar>`

`Quaternion` 继承自 `Eigen::Quaternion<Scalar>`，默认构造为单位四元数 `(1, 0, 0, 0)`。

当前主线支持：

- 从 `(w, x, y, z)`、旋转矩阵、Eigen 四元数、长度为 4 的数组构造；
- 四元数加减乘除；
- 旋转 `Position`；
- `ToEulerAngle()` 默认走 `ZYX` 顺序；
- `ToRotationMatrix()` 转为 3x3 旋转矩阵；
- `operator-()` 返回共轭四元数。

同样需要注意：这里的 `-q` 表示共轭 / 逆旋转语义，不是四元数分量逐项取负。

### 1.6 `Transform<Scalar>`

`Transform` 由两部分组成：

- `rotation`：`Quaternion<Scalar>`
- `translation`：`Position<Scalar>`

当前主线提供：

- 默认单位变换；
- `Transform(rotation, translation)` 构造；
- 用 `operator=` 单独设置旋转或平移分量；
- `operator+` 进行当前实现定义下的变换组合；
- `operator-` 进行当前实现定义下的相对变换计算。

---

## 2. 与 Eigen 的关系

这一组类型是在 Eigen 之上补一层更贴近机器人 / 嵌入式用法的轻量封装，并不会把 Eigen 封死。

因此它们具有两个明显特点：

- 可直接从 Eigen 类型构造，或转换回 Eigen 类型；
- 默认接口会额外提供一些 LibXR 约定的快捷操作，例如 `Axis::X()`、默认 `ZYX` 旋转顺序、`Transform` 的组合写法等。

如果工程本身已经大量使用 Eigen，可以把这些类型理解为“与 LibXR 其他模块配套的几何壳层”。

---

## 3. 使用示例

```cpp
#include <libxr.hpp>

LibXR::Position<> p_body(1.0, 0.0, 0.0);
LibXR::EulerAngle<> euler(0.0, 0.0, 1.57);

LibXR::Quaternion<> q_body_world(euler.ToQuaternion());
LibXR::Position<> p_world = q_body_world * p_body;

LibXR::Transform<> t_body_world(q_body_world, LibXR::Position<>(0.2, 0.0, 0.0));
LibXR::Transform<> t_world_tool;

auto t_body_tool = t_body_world + t_world_tool;
```

---

## 4. 使用建议

- 需要统一姿态表示时，优先在模块边界固定一种主表示，例如内部统一用四元数，对外按需转欧拉角。
- 如果项目对欧拉角顺序敏感，不要只写 `ToEulerAngle()` / `ToQuaternion()`，应显式写成 `...ZYX()`、`...XYZ()` 等具体接口。
- 若工程启用了 `LIBXR_NO_EIGEN`，则这些类型不应作为公共接口依赖。
