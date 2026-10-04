---
id: con-guide-how2con
title: 如何参与贡献
sidebar_position: 1
---

# 如何参与贡献

贡献主要通过 `Issue` 和 `Pull Request` 进行。局部修复、文档勘误、示例修正通常可以直接提 `PR`。

## 仓库

`Issue` 和 `PR` 提交到问题所属的仓库：

| 问题所属 | 仓库 |
| --- | --- |
| LibXR C++ 库 | [xrobot-org/libxr](https://github.com/xrobot-org/libxr) |
| XRobot（`xrobot` 命令）与共享 CI 工作流 | [xrobot-org/XRobot](https://github.com/xrobot-org/XRobot) |
| CodeGenerator（pip 包 `libxr`） | [xrobot-org/LibXR_CppCodeGenerator](https://github.com/xrobot-org/LibXR_CppCodeGenerator) |
| xr-syntax（C++ 源码解析） | [xrobot-org/xr-syntax](https://github.com/xrobot-org/xr-syntax) |
| VS Code 扩展 | [xrobot-org/xrobot-vscode-extension](https://github.com/xrobot-org/xrobot-vscode-extension) |
| 某个模块 | 该模块的仓库，例如 [xrobot-org/BMI088](https://github.com/xrobot-org/BMI088) |
| 官方源中的模块收录 | [xrobot-org/xrobot-modules](https://github.com/xrobot-org/xrobot-modules) |
| 某个 BSP | 该 BSP 的仓库 |
| 本文档网站 | [xrobot-org/xrobot-org.github.io](https://github.com/xrobot-org/xrobot-org.github.io) |
| Docker 镜像 | [xrobot-org/Docker-Image](https://github.com/xrobot-org/Docker-Image) |

## `Issue`

`Issue` 至少写清楚这几件事：

- 现象或目标
- 影响范围
- 复现条件或使用场景
- 预期结果

缺陷类问题不要只写“这里有 bug”；重构类问题不要只写“这里想改一下”。评审者需要先判断这是局部修复、语义调整，还是结构变更。

## `Pull Request`

`PR` 只处理一个主题。正文直接写四项即可：

- 改了什么
- 为什么改
- 怎么验证
- 哪些部分还没验证

小修复不需要长篇说明，但也不要只留一个标题。

```text
## What
- fix uart BLOCK timeout wakeup path

## Why
- late completion may post an expired waiter

## Verify
- build linux test
- run related regression

## Not Verified
- no board-side verification on CH32
```

## 讨论边界

以下改动先开 `Issue` 讨论，再动手：

- 公共接口变更
- 已有语义调整
- 跨平台公共层改动
- 驱动热路径重写
- 大范围重构

## 验证

提交 `PR` 前，在本地运行所在仓库 CI 中的检查。所有 CI 检查通过后，`PR` 才能合并。驱动、并发和性能相关改动按[代码修改边界](./change_boundary.md)说明验证方式；没有验证的部分在 `PR` 正文中写明。各仓库的检查如下，下文的命令都在仓库根目录运行。

### LibXR

CI 在 Linux 上以 Debug 和 Release 配置构建并运行自动测试，再检查 C++ 和 CMake 文件的格式。格式检查脚本需要 clang-format 21.1.8 和 cmakelang[YAML] 0.6.13；构建依赖与构建选项见仓库的 [test/README.md](https://github.com/xrobot-org/libxr/blob/master/test/README.md)，格式规则见[编码规范](./coding_style.md#clang-format)。

```bash
cmake -S . -B build -DLIBXR_TEST_BUILD=ON -DLIBXR_DEV_ASSERT_BUILD=ON -DCMAKE_BUILD_TYPE=Debug
cmake --build build --parallel 8
ctest --test-dir build --output-on-failure --no-tests=error
tools/format_cpp_files.sh --check
tools/format_cmake_files.sh --check
```

### XRobot 与 LibXR_CppCodeGenerator

CI 用 ruff 0.16.9 检查格式和代码，然后安装本仓库的包并运行单元测试；生成代码的格式测试使用 clang-format 21.1.8。XRobot 的测试还用环境变量 `CXX` 指定的编译器编译生成的 C++ 代码，CI 分别使用 g++ 和 clang++。

XRobot：

```bash
python -m pip install ruff==0.16.9
ruff format --check src tests tools
ruff check src tests tools
python -m pip install . clang-format==21.1.8
python -m unittest discover -s tests -v
```

LibXR_CppCodeGenerator 的 ruff 检查 `src`、`tests` 和 `scripts`：

```bash
python -m pip install ruff==0.16.9
ruff format --check src tests scripts
ruff check src tests scripts
python -m pip install . clang-format==21.1.8
python -m unittest discover -s tests -v
```

LibXR_CppCodeGenerator 的 CI 另外编译 STM32 测试工程中生成的代码，并在 `bsp_stm32f103` 上运行 `libxr stm32 setup`。

### xr-syntax

CI 运行 pytest，检查中英 docstring，再用 ruff 检查格式和代码、用 mypy 检查类型：

```bash
python -m pip install -e ".[dev]"
python -m pytest
python tools/check_bilingual_docs.py
python -m ruff format --check src tests tools
python -m ruff check src tests tools
python -m mypy src
```

### VS Code 扩展

CI 在 Linux 和 Windows 上用 Node.js 22 编译、检查和测试扩展，再打包 `.vsix`：

```bash
npm ci
npm run compile
npm run lint
npm test
```

### 模块

模块仓库的 CI 调用 XRobot 仓库中的共享工作流 `module-ci.yml`，在 Linux 容器中解析模块依赖，再用 LibXR 编译模块源文件和 `xrobot check-module` 生成的构造调用，见 [CI 与固件发布](../proj_man/ci.md#模块-ci)。

### BSP

STM32 BSP 的 CI 调用共享工作流 `bsp-stm32-ci.yml`：重新生成 `User/app_main.cpp` 等文件并与提交的版本比较，检查文本文件以 LF 存储，运行 `xrobot format --check` 和 `xrobot setup --frozen`，再构建每份配置，见 [CI 与固件发布](../proj_man/ci.md#bsp-ci)。其他 BSP 运行各自仓库 `.github/workflows/` 中的工作流。STM32 BSP 提交前运行：

```bash
xrobot format --check
xrobot setup --frozen
```

### 文档网站

CI 用 Node.js 20 安装依赖并构建站点：

```bash
npm ci
npm run build
```

文档改动另外在本地预览中检查页面、目录和链接，预览方法见仓库根目录的 `README.md`。
