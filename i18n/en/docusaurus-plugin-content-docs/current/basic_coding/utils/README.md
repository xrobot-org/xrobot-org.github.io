---
id: utils-coding
title: Utilities and Math
sidebar_position: 6
---

# Utilities and Math

This module summarizes LibXR's lightweight utilities and geometry / kinematics types.

## Features

- Includes platform-independent utilities such as `Flag`, `SerializedService`, PID, cyclic angles and value encoding, and CRC, as well as math types for pose, inertia, and kinematic chains.
- `libxr.hpp` exports the `flag / transform / inertia / kinematic` interfaces directly; `serialized_service.hpp`, `pid.hpp`, `cycle_value.hpp`, `float_encoder.hpp`, and `crc.hpp` are included separately as shown on each page.
- `Transform`, `Inertia`, and `Kinematic` are gated by `LIBXR_NO_EIGEN`; when Eigen is disabled, these types are not compiled.

## Contents

- [Flag](./flag.md)
- [Transform](./transform.md)
- [Inertia](./inertia.md)
- [Kinematic](./kinematic.md)
- [SerializedService](./serialized_service.md)
- [PID Controller](./pid.md)
- [Cyclic Angles and Value Encoding](./value_encoding.md)
- [CRC](./crc.md)

See the individual pages for details.
