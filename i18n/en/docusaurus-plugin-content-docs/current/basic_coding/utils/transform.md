---
id: transform
title: Transform
sidebar_position: 2
---

# Transform

`transform.hpp` provides the geometry foundation types in LibXR, including position, direction, Euler angles, rotation matrices, quaternions, and rigid transforms.

These types are gated by `LIBXR_NO_EIGEN`:

- when `LIBXR_NO_EIGEN` is not defined, the types are available
- when `LIBXR_NO_EIGEN` is defined, the whole header body is excluded from compilation

Their default template parameter comes from:

```cpp
using DefaultScalar = LIBXR_DEFAULT_SCALAR;
```

So `Position<>`, `Quaternion<>`, `Transform<>`, and similar shorthand forms all use the project’s configured default scalar type.

---

## 1. Main types

### 1.1 `Position<Scalar>`

`Position` derives from `Eigen::Matrix<Scalar, 3, 1>` and represents a 3D position vector.

Common operations include:

- construction from `(x, y, z)`, `Eigen::Matrix<3,1>`, or a 3-element array
- rotation by `RotationMatrix` / `Quaternion`
- inverse rotation via `/` and `/=`
- scalar scaling via `*=` and `/=`

### 1.2 `Axis<Scalar>`

`Axis` also derives from `Eigen::Matrix<Scalar, 3, 1>` and is used for direction or unit-axis values.

Three convenience constructors are provided:

- `Axis<>::X()`
- `Axis<>::Y()`
- `Axis<>::Z()`

### 1.3 `EulerAngle<Scalar>`

`EulerAngle` stores `(roll, pitch, yaw)` and provides conversion helpers for multiple rotation orders.

Default behavior:

- `ToRotationMatrix()` defaults to `ToRotationMatrixZYX()`
- `ToQuaternion()` defaults to `ToQuaternionZYX()`

Projects that depend on a fixed Euler order call the explicit `XYZ / XZY / YXZ / YZX / ZXY / ZYX` variants instead of relying on the defaults.

### 1.4 `RotationMatrix<Scalar>`

`RotationMatrix` derives from `Eigen::Matrix<Scalar, 3, 3>` and defaults to the identity matrix.

Supported operations:

- construction from `Eigen::Matrix<3,3>`, `Eigen::Quaternion`, `LibXR::Quaternion`, and arrays
- multiplication with `Position`, `Eigen::Matrix<3,1>`, and another `RotationMatrix`
- `ToEulerAngle()` with `ZYX` as the default order
- `operator-()` returning the transpose, that is, the inverse rotation

> Here `operator-()` does not mean numeric negation. It is a shorthand for inverse rotation.

### 1.5 `Quaternion<Scalar>`

`Quaternion` derives from `Eigen::Quaternion<Scalar>` and defaults to the identity quaternion `(1, 0, 0, 0)`.

Supported operations:

- construction from `(w, x, y, z)`, rotation matrices, Eigen quaternions, and 4-element arrays
- quaternion addition, subtraction, multiplication, and division
- rotating `Position`
- `ToEulerAngle()` with `ZYX` as the default order
- `ToRotationMatrix()` for 3x3 matrix conversion
- `operator-()` returning the conjugate quaternion

Again, `-q` here means conjugate / inverse-rotation semantics, not per-component negation.

### 1.6 `Transform<Scalar>`

`Transform` consists of two parts:

- `rotation`: `Quaternion<Scalar>`
- `translation`: `Position<Scalar>`

It provides:

- an identity default transform
- `Transform(rotation, translation)` construction
- assignment helpers for setting rotation or translation individually
- `a + b` composes two transforms: rotation `qa * qb`, translation `pa + qa * pb`
- `a - b`: rotation `qa * qb⁻¹`, translation `pa - pb`; the translations are subtracted directly, so `(a + b) - b` generally differs from `a`

---

## 2. Relationship with Eigen

`Position`, `Axis`, `RotationMatrix`, and `Quaternion` derive from the corresponding Eigen types, and `EulerAngle` converts to and from `Eigen::Matrix<Scalar, 3, 1>`; on top of that they add LibXR construction forms and operators.

As a result:

- direct construction from Eigen types and straightforward conversion back to Eigen forms
- LibXR-specific convenience behavior such as `Axis::X()`, default `ZYX` conversions, and shorthand transform composition operators

Code that already uses Eigen can pass these objects directly to functions taking the corresponding Eigen types.

---

## 3. Example

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

## 4. Usage guidance

- For one consistent attitude representation, fix a primary representation at module boundaries, for example quaternions internally and Euler angles only for UI / configuration.
- If Euler order matters, prefer explicit calls such as `ToEulerAngleZYX()` or `ToQuaternionXYZ()` instead of the default helpers.
- If the build uses `LIBXR_NO_EIGEN`, these types should not appear in public interfaces.
