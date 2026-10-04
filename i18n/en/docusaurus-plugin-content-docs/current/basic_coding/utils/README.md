---
id: utils-coding
title: Utilities and Math
sidebar_position: 6
---

# Utilities and Math

This section covers the LibXR utility and math types.

`libxr.hpp` exports `Flag`, `Transform`, `Inertia`, and `Kinematic`; `SerializedService`, `PID`, `CycleValue`, `FloatEncoder`, and the CRC classes are included separately through `serialized_service.hpp`, `pid.hpp`, `cycle_value.hpp`, `float_encoder.hpp`, and `crc.hpp`, as shown on each page. `Transform`, `Inertia`, and `Kinematic` are built on Eigen; defining `LIBXR_NO_EIGEN` removes these three from the build.

## Contents

- [Flag](./flag.md): atomic and plain boolean flags, and `ScopedRestore`, which changes a flag on scope entry and restores it on exit.
- [Transform](./transform.md): position, axis, Euler angle, rotation matrix, quaternion, and rigid transform types.
- [Inertia](./inertia.md): the inertia tensor `Inertia` and the center of mass `CenterOfMass`, with translation, rotation, and center-of-mass accumulation.
- [Kinematic](./kinematic.md): serial-joint kinematic chains with forward kinematics, Jacobian pseudo-inverse inverse kinematics, inertia distribution, and center-of-mass calculation.
- [SerializedService](./serialized_service.md): coalesces events from several entry points and lets one caller at a time run the handler.
- [PID Controller](./pid.md): proportional, integral, feedback-derivative, and feed-forward terms with integral limiting, output limiting, and cyclic-angle error.
- [Cyclic Angles and Value Encoding](./value_encoding.md): `CycleValue` handles cyclic angles; `FloatEncoder` quantizes floating-point values in a bounded range to integer codes.
- [CRC](./crc.md): `CRC8`, `CRC16`, `CRC32`, and `CRC64` calculation, and verification of a trailing checksum for CRC8/16/32.

See the individual pages for details.
