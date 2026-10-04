---
id: kinematic
title: Kinematic
sidebar_position: 4
---

# Kinematic

`kinematic.hpp` provides a set of kinematic-chain utilities based on `Transform / Inertia / List`, under the namespace:

```cpp
namespace LibXR::Kinematic
```

It is mainly intended for serial joint structures and covers forward kinematics, target-state propagation, inverse-kinematics solving, inertia distribution, and center-of-mass calculation.

Like [Transform](./transform.md) and [Inertia](./inertia.md), this group is gated by `LIBXR_NO_EIGEN`.

---

## 1. Core types

### 1.1 `Joint<Scalar>`

`Joint` represents a rotational joint. Its configuration is stored in `param_`:

- `param_.parent2this`: transform from the parent frame to the joint frame
- `param_.this2child`: transform from the joint frame to the child object frame
- `param_.axis`: joint rotation axis
- `param_.ik_mult`: inverse-kinematics step multiplier, 1.0 by default, set with `SetBackwardMult()`

Common APIs:

- `SetState(angle)`
- `SetTarget(angle)`
- `SetBackwardMult(mult)`

`SetState()` and `SetTarget()` subtract 2π once from angles above π and add 2π once to angles below -π, so inputs within [-3π, 3π] end up in [-π, π].

> Constructing a `Joint` performs one dynamic allocation for the joint-list node.

### 1.2 `Object<Scalar>`

`Object` represents a rigid node connected by joints. Internally it maintains:

- `joints`: child-joint list
- `parent`: parent-joint pointer
- `param_`: inertia parameters of the object
- `runtime_`: current and target pose runtime state

Common APIs:

- `SetPosition(pos)`
- `SetQuaternion(quat)`

### 1.3 `StartPoint<Scalar>`

`StartPoint` represents the root of the chain. It provides:

- `CalcForward()`
- `CalcTargetForward()`
- `CalcInertia()`
- `CalcCenterOfMass()`
- `cog` for the computed center-of-mass result

### 1.4 `EndPoint<Scalar>`

`EndPoint` represents the chain end. It provides:

- `SetTargetPosition(pos)`
- `SetTargetQuaternion(quat)`
- `SetErrorWeight(weight)`
- `SetMaxAngularVelocity(v)`
- `SetMaxLineVelocity(v)`
- `CalcBackward(dt, max_step, max_err, step_size)`
- `GetPositionError()`, `GetQuaternionError()`: position and orientation error between the target pose and the end point's target state

`CalcBackward(...)` iterates inverse kinematics with the Jacobian pseudo-inverse and returns the weighted 6D error vector of the last iteration.

> The first call to `EndPoint::CalcBackward()` allocates storage for the Jacobian matrix and the joint-delta vector.

---

## 2. Typical workflow

Typical call order:

1. create `StartPoint / Object / EndPoint` instances and their `Inertia` objects
2. connect parent and child nodes with `Joint`
3. call `SetState()` on joints
4. call `CalcForward()` to build the current pose chain
5. set target position / target orientation for the endpoint
6. call `CalcBackward(...)` for one inverse-kinematics solve pass
7. call `CalcTargetForward()` to propagate target poses
8. optionally call `CalcCenterOfMass()` or `CalcInertia()`

---

## 3. Example

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

This example only shows the minimum call path. A real robot model normally adds more joints, explicit geometry, and tuned error weights.

---

## 4. Usage guidance

- For pose transforms only, `Transform / Quaternion / Position` are enough without the `Kinematic` types.
- `Joint` construction and the first `EndPoint::CalcBackward()` call use `new`, which matters where dynamic allocation is restricted.
- IK convergence speed and stability depend directly on parameters such as `ik_mult`, `err_weight_`, `max_step`, and `step_size`; tune them against the actual mechanism.
