---
id: proj-man
title: 项目管理（XRobot）
sidebar_position: 7
---

# 项目管理（XRobot）

XRobot（`xrobot` 命令）把可复用的 C++ 模块解析到精确的 commit，并为 LibXR BSP 生成静态的 C++ 应用入口。它不是构建系统：`xrobot setup` 之后，用 BSP 自己的 CMake、Preset、Docker 或厂商命令构建。LibXR 不依赖 XRobot 也能单独使用。

---

## 安装

```bash
pip install xrobot==1.0.0
```

BSP 在 `Modules/modules.yaml` 里用 `xrobot: 1.0.0` 固定工具版本，安装与之一致的版本；已安装版本与固定版本不同时，`xrobot setup` 和 `xrobot gen` 给出警告，`xrobot setup --frozen` 报错。STM32 BSP 还需要代码生成器 `libxr`（`pip install libxr==6.0.0`），其版本由 `User/libxr_config.yaml` 的 `generator:` 固定。

也可以用 `pipx install xrobot==1.0.0` 安装到隔离环境。不要同时用 pip 和 pipx 安装同一个包。

在 `VS Code` 中可以安装插件 [`XRobot.xrobot`](https://marketplace.visualstudio.com/items?itemName=XRobot.xrobot)（2.0.0 起对应 XRobot 1.0）。插件显示 `xrobot describe` 的结果，所有修改都通过 `xrobot` 命令完成。

---

## BSP 目录约定

BSP 根目录是向上查找到的第一个包含 `Modules/modules.yaml` 的目录。所有命令都可以在 BSP 的任意子目录运行，也可以用 `-C DIR` 指定起点。

| 文件 | 是否提交 | 含义 |
| --- | --- | --- |
| `Modules/modules.yaml` | 是 | 需要的模块（`owner/Repo@ref`）和 `xrobot:` 工具版本 |
| `Modules/sources.yaml` | 是 | 模块源（`index.yaml`）及优先级 |
| `xrobot.lock` | 是 | 依赖闭包中每个模块的精确 commit |
| `User/*.yaml` | 是 | 应用配置（产品）；`User/libxr_config.yaml` 除外 |
| `User/` 下的入口源文件 | 是 | 用 `XR_REGISTER` 注册 BSP 对象并调用 `XROBOT_MAIN()` |
| `Modules/<owner>/<Repo>/` | 否 | 检出到锁定 commit 的模块仓库 |
| `Modules/CMakeLists.txt` | 否 | 由 `xrobot setup` 生成 |
| `User/xrobot_main.hpp` | 否 | 为当前选中的产品生成的入口 |

`xrobot init` 在当前目录创建 `Modules/modules.yaml`、`Modules/sources.yaml`、`User/xrobot.yaml`，并把生成文件写入 `.gitignore`。

---

## 快速上手

```bash
xrobot init
xrobot module add xrobot-org/BlinkLED@dev
xrobot setup                              # 拉取、锁定、检查配置、生成入口
xrobot instance add xrobot-org/BlinkLED   # 新增实例 blinkled_0
```

`instance add` 按构造函数写出全部参数及源码中的默认值；没有默认值的依赖参数留空（`null`，表示"未填写"）。把它填成已注册的 BSP 对象名：

```yaml
modules:
  - module: xrobot-org/BlinkLED
    id: blinkled_0
    args:
      - led: LED_R
      - blink_cycle: 250
settings:
  monitor_sleep_ms: 1000
```

入口源文件注册配置可以使用的对象，然后进入应用：

```cpp
#include "xrobot_main.hpp"

// ... 构造 LED_R 等 BSP 对象 ...
XR_REGISTER(LED_R, LibXR::GPIO);
XROBOT_MAIN();
```

生成并用原生工具构建：

```bash
xrobot gen
cmake -S . -B build
cmake --build build
```

STM32 BSP 的入口 `User/app_main.cpp` 由代码生成器写出，见 [与 XRobot 集成](../code_gen/xrobot_inter.md)。

---

## 命令一览

| 命令 | 作用 |
| --- | --- |
| `xrobot init` | 在当前目录创建 BSP 文件 |
| `xrobot setup` | 解析并锁定模块，检查所有配置，重新生成入口 |
| `xrobot gen [-c CONFIG]` | 生成 `User/xrobot_main.hpp`（选择产品） |
| `xrobot describe [-c CONFIG]` | 以 JSON 输出 BSP 状态，供编辑器使用 |
| `xrobot sync [-c CONFIG]...` | 为新增字段/参数写入默认值，删除已移除的字段 |
| `xrobot format [--check] [-c CONFIG]...` | 把配置改写为规范格式 |
| `xrobot instance [-c CONFIG] add\|set\|remove\|rename` | 编辑一个实例 |
| `xrobot module add\|remove owner/Repo[@ref]` | 编辑 `Modules/modules.yaml` |
| `xrobot module show MODULE` | 显示模块的 manifest 和构造函数（目录、头文件或模块 id） |
| `xrobot new-module NAME` | 创建模块骨架（头文件、CMake、README、CI） |
| `xrobot check-module MODULE` | 生成模块 CI 使用的构造调用（只编译，不执行） |
| `xrobot source ...` | 查询或编辑模块源 |

`xrobot <命令> --help` 显示每个命令的参数。

---

## 本章内容

- [模块请求与锁定](./setup.md)：`modules.yaml`、ref 规则、`xrobot.lock`、`xrobot setup` 与发布门禁
- [应用配置](./config.md)：配置格式、依赖绑定、结构体、常量、多产品
- [入口与生成](./gen_main.md)：`XR_REGISTER`、`XROBOT_MAIN()`、生成的头文件与构建检查
- [编写模块](./create_mod.md)：模块类与构造函数、manifest、模块 CI
- [模块源](./src_man.md)：`sources.yaml`、`index.yaml` 与 `xrobot source`
