---
id: pid
title: PID 控制器
sidebar_position: 6
---

# PID 控制器

`PID<Scalar>` 实现比例、积分、反馈微分和前馈，并提供积分限幅、输出限幅和周期角度误差。

## 参数

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

`k` 是全局比例因子。控制器内部使用：

```text
error    = setpoint - feedback
scaled   = k * error
fb_dot_k = k * d(feedback)/dt
output   = p * scaled + i * integral - d * fb_dot_k + feed_forward
```

`cycle=true` 时，误差按弧度最短角差计算。

## 计算

由控制器内部计算反馈导数：

```cpp
float output = pid.Calculate(setpoint, feedback, dt);
```

已有速度或导数估计时直接传入：

```cpp
float output = pid.Calculate(setpoint, feedback, feedback_dot, dt);
```

`dt` 与控制器增益使用同一时间单位，通常使用秒。无效输入或 `dt <= 0` 时返回上一次输出。

## 积分与限幅

积分项在 `i` 和 `i_limit` 都大于内部阈值时启用。积分状态限制在 `[-i_limit, i_limit]`。设置了 `out_limit` 后，最终输出限制在 `[-out_limit, out_limit]`；积分更新同时避免继续加重饱和。

## 状态

以下接口可用于运行时调参和观察：

```cpp
pid.SetP(2.5f);
pid.SetI(0.4f);
pid.SetD(0.02f);
pid.SetFeedForward(1.0f);

float e = pid.LastError();
float y = pid.LastOutput();
pid.Reset();
```

`Reset()` 清除积分、上一反馈、误差、导数和输出；前馈值保持不变。
