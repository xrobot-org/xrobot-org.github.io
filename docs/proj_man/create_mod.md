---
id: proj-man-create-mod
title: 编写模块
sidebar_position: 4
---

# 编写模块

模块是一个 Git 仓库 `owner/Repo`，主头文件 `Repo.hpp` 声明同名的全局 C++ 类 `Repo`。它的公有构造函数就是接口：配置按参数名填写，生成器直接调用构造函数。

---

## 创建骨架

```bash
xrobot new-module MySensor --desc "IMU driver" \
  --constructor "LibXR::I2C& i2c" \
  --constructor "uint32_t period_ms = 10" \
  --depends xrobot-org/BlinkLED
```

| 参数 | 含义 |
| --- | --- |
| `--desc` | 模块描述 |
| `--constructor` | 一个 C++ 参数声明，每个参数重复一次 |
| `--template` | 一个模板参数声明，每个重复一次 |
| `--template-arg` | 模块 CI 编译时使用的模板实参，每个重复一次；有默认值的模板参数可以不写 |
| `--include` | 另外包含的头文件；`libxr.hpp` 和构造参数用到的 LibXR 硬件接口头文件（如 `i2c.hpp`）总会包含 |
| `--depends` | 依赖 `owner/Repo[@ref]`，每个依赖写一次；默认 ref 为 `same-or-dev` |
| `--out` | 在该目录下创建 `<NAME>/`，默认当前目录 |

写文件前，`new-module` 按 `setup` 和 `instance add` 的规则检查拼好的头文件：参数要有名字，依赖在带默认值的参数之前，没有默认值的模板参数要有 `--template-arg`。检查不通过时报错，不创建任何文件。

生成：

```text
MySensor/
├── MySensor.hpp                  # 类、构造函数与 manifest
├── CMakeLists.txt                # 把源文件加入 LibXR 的 xr 目标
├── README.md                     # 按模块 README 的结构写出，参数用途等留给作者填写
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
#include "libxr.hpp"

class MySensor
{
 public:
  MySensor(LibXR::I2C& i2c, uint32_t period_ms = 10) {}
};
```

`xrobot module show <目录、头文件或模块 id>` 显示模块的 manifest 和构造函数；给出 `owner/Repo` 或 `Repo` 时读取当前 BSP 中锁定的模块。manifest 的 YAML 写错时，报错给出头文件中的行列号。

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

在 BSP 的 `Modules/owner/MySensor/` 中直接修改并构建；保持修改未提交。准备好后在模块仓库中提交并推送到一个分支，然后在 BSP 中运行 `xrobot setup --update owner/MySensor` 更新 lock。

模块被加入 BSP 需要能在源中找到，见 [源](./src_man.md)。

`new-module` 生成的 `.github/workflows/build.yml` 调用共享的模块 CI，工作流的步骤和输入见 [CI 与固件发布](./ci.md#模块-ci)。
