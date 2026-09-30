---
id: proj-man-create-mod
title: 编写模块
sidebar_position: 4
---

# 编写模块

模块是一个 Git 仓库 `owner/Repo`，主头文件 `Repo.hpp` 声明同名的全局 C++ 类 `Repo`。它的公有构造函数就是接口：应用配置按参数名填写，生成器直接调用构造函数。模块不继承框架基类，也没有额外的初始化阶段。

---

## 创建骨架

```bash
xrobot new-module MySensor --desc "IMU driver" \
  --constructor "LibXR::I2C& i2c" \
  --constructor "uint32_t period_ms = 10" \
  --include i2c.hpp \
  --depends xrobot-org/BlinkLED
```

| 参数 | 含义 |
| --- | --- |
| `--desc` | 模块描述 |
| `--constructor` | 一个 C++ 参数声明，每个参数重复一次 |
| `--template` | 一个模板参数声明，每个重复一次 |
| `--include` | 头文件 |
| `--depends` | 依赖 `owner/Repo[@ref]`，可写多个；默认 ref 为 `same-or-dev` |
| `--out` | 输出目录，默认当前目录 |

生成：

```text
MySensor/
├── MySensor.hpp                  # 类、构造函数与 manifest
├── CMakeLists.txt                # 把源文件加入 LibXR 的 xr 目标
├── README.md
└── .github/workflows/build.yml   # 调用共享的模块 CI
```

```cpp
#pragma once

// clang-format off
/* === MODULE MANIFEST V2 ===
module_description: IMU driver
depends:
- id: xrobot-org/BlinkLED
  ref: same-or-dev
=== END MANIFEST === */
// clang-format on

#include "i2c.hpp"
class MySensor
{
 public:
  MySensor(LibXR::I2C& i2c, uint32_t period_ms = 10) {}
};
```

`xrobot module show <目录、头文件或模块 id>` 显示模块的 manifest 和构造函数；给出 `owner/Repo` 或 `Repo` 时读取当前 BSP 中锁定的模块。

---

## 构造函数约定

- 依赖（硬件或其他模块）在前，写成没有默认值的引用或指针；可选依赖写成没有默认值的指针，配置可填 `nullptr`。
- 值配置在后，带默认值。`xrobot instance add` 会把默认值写入配置。
- 参数必须有名字；数组、函数指针等复杂类型请先定义类型别名。
- 结构体参数的字段会被配置按映射逐项填写，因此要定义在模块根目录的头文件中，或定义在它们用 `#include "..."` 引入的模块内头文件中。
- 可以有多个公有构造函数，配置按参数名选择；参数名相同的重载需靠显式类型区分。
- 构造函数负责全部初始化。宏生成或随条件编译变化的接口需要写成显式声明。

可选的公有非静态 `void OnMonitor()` 会被主循环按配置顺序周期调用。

---

## Manifest

manifest 只允许以下键：

```yaml
module_description: 描述
depends:
  - id: owner/Repo
    ref: same-or-dev
standalone: false
```

- `depends`：依赖模块及 ref，规则见 [模块请求与锁定](./setup.md#ref-规则)。常用 `same-or-dev`，使依赖跟随 BSP 所在的分支。
- `standalone: false`：只作为其他模块依赖的库，不能被实例化。

---

## 在 BSP 中使用与开发

```bash
xrobot module add owner/MySensor@dev
xrobot setup
xrobot instance add owner/MySensor
```

在 BSP 的 `Modules/owner/MySensor/` 中直接修改并构建；保持修改未提交。准备好后在模块仓库中提交并推送到一个分支，然后在 BSP 中运行 `xrobot setup --update owner/MySensor` 更新锁文件。

模块被加入 BSP 需要能在模块源中找到，见 [模块源](./src_man.md)。

---

## 模块 CI

模块仓库调用共享工作流 `xrobot-org/XRobot/.github/workflows/module-ci.yml`。官方模块在 `dev` 线上的 `.github/workflows/build.yml`：

```yaml
name: Module CI
on:
  push:
  pull_request:
  workflow_dispatch:
jobs:
  build:
    uses: xrobot-org/XRobot/.github/workflows/module-ci.yml@dev
    with:
      xrobot-ref: dev
      libxr-ref: dev
      dependency-ref: refs/heads/dev
      template-args: '[]'
```

工作流在 Linux 容器中解析模块依赖，运行 `xrobot check-module` 生成一个构造调用，然后用 LibXR 编译模块源文件和这个调用。依赖参数用 `void*` 占位，调用只编译、从不执行；`standalone: false` 的库只编译其头文件和源文件。

| 输入 | 默认值 | 含义 |
| --- | --- | --- |
| `xrobot-ref` | `master` | 使用的 XRobot 版本 |
| `libxr-ref` | `master` | 使用的 LibXR 版本 |
| `dependency-ref` | `refs/heads/master` | 依赖 `same-or-dev` 的上下文 |
| `template-args` | `'[]'` | 类模板的模板实参（JSON 列表） |
| `image` | `ghcr.io/xrobot-org/docker-image-linux:main` | 构建容器 |
| `apt-packages` | 空 | 额外的 Debian 包 |
| `cmake-options` | 空 | 额外的 CMake 配置参数 |
| `ctest-regex` | 空 | 非空时构建测试并运行匹配的 CTest |
| `ctest-timeout` | `15` | 每个 CTest 测试的超时（秒） |

编译通过不代表硬件验证。
