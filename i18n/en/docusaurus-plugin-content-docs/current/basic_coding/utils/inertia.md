---
id: inertia
title: Inertia
sidebar_position: 3
---

# Inertia

`inertia.hpp` provides two types:

- `LibXR::Inertia<Scalar>`: rigid-body inertia tensor plus mass
- `LibXR::CenterOfMass<Scalar>`: center-of-mass position plus mass

Like the types described on the [Transform](./transform.md) page, this group is also gated by `LIBXR_NO_EIGEN`.

---

## 1. `Inertia<Scalar>`

### 1.1 Data layout

`Inertia<Scalar>` exposes two public pieces of data:

- `data[9]`: the 3x3 inertia tensor
- `mass`: the mass value

Default construction initializes:

- `mass = 0`
- `data` to zero

### 1.2 Construction forms

The main construction forms are:

- `Inertia(mass, data[9])`
- `Inertia(mass, matrix[3][3])`
- `Inertia(mass, arr[6])`
- `Inertia(mass, xx, yy, zz, xy, yz, xz)`
- `Inertia(mass, Eigen::Matrix<Scalar, 3, 3>)`

The 6-value and 7-argument forms take the principal moments and products of inertia in the order `xx, yy, zz, xy, yz, xz` and store the negated products as off-diagonal elements (for example, element `(0, 1)` is `-xy`); the 9-element array, 3x3 array, and Eigen matrix forms store the full tensor as given.

### 1.3 Main operations

- conversion to `Eigen::Matrix<Scalar, 3, 3>`
- `operator()(i, j)` for element access
- `operator+` with another 3x3 matrix
- `Translate(p)` for inertia translation
- `Rotate(R)` for rotation by a matrix
- `Rotate(q)` for rotation by a quaternion

These operations are mainly used to move local inertia information into another pose or reference point.

---

## 2. `CenterOfMass<Scalar>`

`CenterOfMass<Scalar>` represents a center of mass as “position + mass”.

Its public data members are:

- `position`
- `mass`

Common construction forms:

- `CenterOfMass(mass, Position)`
- `CenterOfMass(mass, Eigen::Matrix<3,1>)`
- `CenterOfMass(inertia, transform)`

It also provides:

- `operator+`
- `operator+=`

which can be used to accumulate multiple rigid-body centers of mass into a total result.

---

## 3. Example

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

## 4. Usage guidance

- For geometry and pose only, `Transform / Quaternion / RotationMatrix` are enough; `Inertia` is needed when mass distribution, center of mass, or inertia conversion matters.
- `Translate()` and `Rotate()` return new inertia objects, which fits transformation-chain style calculations well.
- When the build disables Eigen through `LIBXR_NO_EIGEN`, these types are unavailable and should not be part of public module boundaries.
