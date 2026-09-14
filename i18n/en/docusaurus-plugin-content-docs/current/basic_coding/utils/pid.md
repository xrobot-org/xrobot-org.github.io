---
id: pid
title: PID Controller
sidebar_position: 6
---

# PID Controller

`PID<Scalar>` implements proportional, integral, feedback-derivative and feed-forward terms with integral limiting, output limiting and cyclic-angle error handling.

## Parameters

```cpp
#include "pid.hpp"

LibXR::PID<float>::Param param{
    .k = 1.0f,
    .p = 2.0f,
    .i = 0.5f,
    .d = 0.01f,
    .i_limit = 3.0f,
    .out_limit = 10.0f,
    .cycle = false,
};

LibXR::PID<float> pid(param);
```

`k` is a global scale factor. Internally the controller uses:

```text
error    = setpoint - feedback
scaled   = k * error
fb_dot_k = k * d(feedback)/dt
output   = p * scaled + i * integral - d * fb_dot_k + feed_forward
```

With `cycle=true`, error is the shortest angular difference in radians.

## Calculation

Let the controller derive feedback rate:

```cpp
float output = pid.Calculate(setpoint, feedback, dt);
```

Or provide an external rate estimate:

```cpp
float output = pid.Calculate(setpoint, feedback, feedback_dot, dt);
```

Use a `dt` unit consistent with the gains, normally seconds. Invalid inputs or `dt <= 0` return the previous output.

## Integral and output limits

Integration is enabled when both `i` and `i_limit` exceed the internal threshold. Integral state is clamped to `[-i_limit, i_limit]`. With `out_limit` enabled, final output is clamped to `[-out_limit, out_limit]`, and integral updates avoid driving saturation further in the same direction.

## State

Runtime tuning and observation use the normal setters/getters:

```cpp
pid.SetP(2.5f);
pid.SetI(0.4f);
pid.SetD(0.02f);
pid.SetFeedForward(1.0f);

float e = pid.LastError();
float y = pid.LastOutput();
pid.Reset();
```

`Reset()` clears integral state, previous feedback, error, derivative and output. The feed-forward value is retained.
