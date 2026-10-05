---
id: proj-man-ci
title: CI 与固件发布
sidebar_position: 6
---

# CI 与固件发布

模块仓库和 STM32 BSP 的 CI 调用 XRobot 仓库中的共享工作流：模块使用 `module-ci.yml`，STM32 BSP 使用 `bsp-stm32-ci.yml`，后者还在推送到 `master`、打 `v*` tag 或发布 Release 时上传固件。

---

## 模块 CI

模块仓库调用共享工作流 `xrobot-org/XRobot/.github/workflows/module-ci.yml`。官方模块的 `.github/workflows/build.yml`（`dev` 与 `master` 相同），XRobot 和 LibXR 使用默认的 `master`：

```yaml
name: Module CI
on:
  push:
  pull_request:
  workflow_dispatch:
jobs:
  build:
    uses: xrobot-org/XRobot/.github/workflows/module-ci.yml@v1
    with:
      template-args: '[]'
```

工作流在 Linux 容器中解析模块依赖，运行 `xrobot check-module` 生成一个构造调用，然后用 LibXR 编译模块源文件和这个调用。依赖参数用 `void*` 占位，调用只编译、不运行；`standalone: false` 的库只编译其头文件和源文件。

`xrobot check-module` 像 `xrobot setup` 一样解析模块，会更新 `xrobot.lock` 和 `Modules/`；`-o FILE` 指定输出文件（默认 `module_check.cpp`），`--template-arg` 给出类模板的模板实参（每个写一次），`--offline` 只使用 `Modules/` 中已有的模块。

| 输入 | 默认值 | 含义 |
| --- | --- | --- |
| `xrobot-ref` | `master` | 使用的 XRobot 版本 |
| `libxr-ref` | `master` | 使用的 LibXR 版本 |
| `dependency-ref` | `refs/heads/master` | 依赖 `same-or-dev` 的上下文 |
| `template-args` | `'[]'` | 类模板的模板实参（JSON 列表） |
| `sources` | 空 | 另外使用的 index URL，每行一个；与官方 index 列出同一个包时以官方为准 |
| `image` | `ghcr.io/xrobot-org/docker-image-linux:main` | 构建容器 |
| `apt-packages` | 空 | 额外的 Debian 包 |
| `cmake-options` | 空 | 额外的 CMake 配置参数 |
| `ctest-regex` | 空 | 非空时构建测试并运行匹配的 CTest |
| `ctest-timeout` | `15` | 每个 CTest 测试的超时（秒） |

---

## BSP CI

STM32 BSP 的 CI 调用共享工作流 `xrobot-org/XRobot/.github/workflows/bsp-stm32-ci.yml`，BSP 只需写出工程名和要构建的配置：

```yaml
name: build
on:
  push: {branches: [master, dev], tags: ['v*']}
  pull_request: {branches: [master, dev]}
  release: {types: [published]}
  workflow_dispatch:
jobs:
  build:
    permissions: {contents: write}   # 把固件附到发布
    uses: xrobot-org/XRobot/.github/workflows/bsp-stm32-ci.yml@v1
    with:
      project: DevC
      configs: |
        default
        debug
        full
```

检查作业和构建作业按 `Modules/modules.yaml` 的 `xrobot:` 和 `User/libxr_config.yaml` 的 `generator:` 固定的版本安装工具。检查作业执行第 1 至 4 步；各构建作业（第 5 步）与检查作业并行运行；发布作业（第 6 步）在检查作业和全部构建作业成功后运行：

1. 重新生成 BSP 对象（`libxr parse`、`libxr gen`），检查 `User/app_main.cpp`、`User/app_main.h`、`User/flash_map.hpp` 和 `User/libxr_config.yaml` 与提交一致；
2. 检查仓库内没有以 CRLF 存储的文本文件（`git ls-files --eol` 中的 `i/crlf`），否则失败并提示 `git add --renormalize .`，见 [`xrobot init`](./README.md#bsp-目录约定) 写入的 `.gitattributes`；
3. `xrobot format --check` 检查配置格式；
4. `xrobot setup --frozen` 按 lock 检出模块并检查每份配置；
5. 对每份配置配置并构建；要发布的构建（见[固件发布](#固件发布)）打包固件（`.elf`、`.hex`、`.bin`、配置文件和记录构建信息的 `build-info.json`）并上传为构建产物；
6. 推送到 `master`、打 `v*` tag 或发布 Release 时，一个作业下载全部构建产物，生成发布文件、校验和、清单和说明，并一次上传到 Release。

| 输入 | 默认值 | 含义 |
| --- | --- | --- |
| `project` | 必填 | CMake 工程名，固件是 `build/<project>.elf` |
| `configs` | `default` | 要构建的配置，每行一个；`default` 指 `User/xrobot.yaml`，其余名字对应 `<config-dir>/<名字>.yaml` |
| `config-dir` | `User/RobotConfig` | 配置所在的目录 |
| `toolchain` | `cmake/starm-clang.cmake` | CMake 工具链文件 |
| `build-type` | `Release` | CMake 构建类型；为空时不设置 |
| `presets` | 空 | 每行一个 CMake preset，用于有多个镜像的 BSP（如 OpenCR 的 app 和 bootloader）：每个 preset 都要有同名的配置 preset 和构建 preset，工作流依次 `cmake --preset`、`cmake --build --preset`，不再使用 `toolchain` 和 `build-type`；与 `configs` 的每一项各构建一次 |
| `release-configs` | 空 | 发布到 Release 的配置，每行一个，必须出现在 `configs` 中；为空时按[固件发布](#固件发布)的默认规则 |
| `image` | `ghcr.io/xrobot-org/docker-image-stm32:main` | 构建容器 |

`XR_CONTEXT_REF` 和 `XR_RELEASE_REF`（`xrobot setup` 的 `--context-ref` 与 `--release-ref`）由工作流根据触发事件设置，BSP 不需要写。

### 固件发布

推送到 `master`（或 `main`）、打 `v*` tag 或发布 Release 时，工作流上传固件。`master` 只在发版时从 `dev` 合入，推送到 `master` 时工作流在合并提交上打下一个 tag：已有 `vX.Y.Z` tag 中最大的版本补丁号加一，没有时为 `v1.0.0`；合并提交已有 `v` tag 时，由那个 tag 的运行发布。发布哪些配置按以下规则确定：

- `configs` 只有 `default` 时，发布 `default`；
- 否则发布除 `default` 外的每份配置；
- 给出 `release-configs` 时，发布其中的配置，可以包含 `default`。

使用 `presets` 时，每份发布的配置发布全部 preset 的镜像。

发布的文件如下，`<tag>` 是 tag 名（如 `v1.2.0`），其中不能用于文件名的字符替换为 `-`：

| 文件 | 内容 |
| --- | --- |
| `<project>-<config>[-<preset>]-<tag>.elf`、`.hex`、`.bin` | 每个构建的固件 |
| `<project>-<config>-<tag>.yaml` | 这份配置的配置文件：`default` 是 `User/xrobot.yaml`，其余是 `<config-dir>/<名字>.yaml` |
| `<project>-<config>-<tag>.tar.gz` | 这份配置的全部文件，位于归档内的 `<project>-<config>-<tag>/` 目录 |
| `SHA256SUMS` | 上面每个文件的 SHA-256，可用 `sha256sum -c SHA256SUMS` 校验 |
| `firmware-manifest.json` | 构建清单 |

配置名和 preset 名以 `-` 连接成构建名（`<config>-<preset>`），构建名必须互不相同：`a-b` 加 `c` 与 `a` 加 `b-c` 得到同一个名字，工作流在规划阶段报错。

各构建把文件上传为构建产物，之后由一个作业下载全部构建产物、生成上面的文件并一次上传，所以 `SHA256SUMS` 覆盖本次发布的每个文件。缺少某个构建产物，或各构建的提交、工具版本不一致时，该作业失败。

`firmware-manifest.json` 记录 tag、提交、BSP 仓库、工程名、构建类型、工具链文件、镜像，xrobot 与 libxr 实际安装的版本和固定的版本，LibXR 子模块的提交，`xrobot.lock` 中每个模块的提交，以及每个构建的配置、preset、文件名和 `arm-none-eabi-size` 给出的 text、data、bss 大小。使用 `presets` 时，构建类型和工具链由 preset 决定，清单中为 `null`。以下是一个只构建 `default` 的 BSP 的清单示例：

```json
{
  "schema": 1,
  "tag": "v1.0.0",
  "commit": "ad662b2bc410a440717f6a35e3f83a573f2422c5",
  "repository": "QDU-Robomaster/bsp-dev-mc02",
  "project": "CtrBoard-H7_ALL",
  "build_type": "Debug",
  "toolchain": "cmake/starm-clang.cmake",
  "image": "ghcr.io/xrobot-org/docker-image-stm32:main",
  "tools": {
    "xrobot": {
      "version": "1.0.0",
      "pin": "1.0.0"
    },
    "libxr": {
      "version": "6.0.0",
      "pin": "6.0.0"
    }
  },
  "libxr_submodule": {
    "path": "Middlewares/Third_Party/LibXR",
    "commit": "6c51bf4084d983bc20309e63818ce104dc53f959"
  },
  "modules": {
    "xrobot-org/BuzzerAlarm": "44424519645a0d9297d5a7bd57b8dd4e0c342e74"
  },
  "builds": [
    {
      "config": "default",
      "preset": null,
      "files": {
        "elf": "CtrBoard-H7_ALL-default-v1.0.0.elf",
        "hex": "CtrBoard-H7_ALL-default-v1.0.0.hex",
        "bin": "CtrBoard-H7_ALL-default-v1.0.0.bin",
        "config": "CtrBoard-H7_ALL-default-v1.0.0.yaml",
        "archive": "CtrBoard-H7_ALL-default-v1.0.0.tar.gz"
      },
      "size": {
        "text": 137384,
        "data": 84,
        "bss": 117172
      }
    }
  ]
}
```

推送到 `master` 或推送 tag 时，工作流创建 Release，说明是各构建的大小表和工具版本：

```markdown
## CtrBoard-H7_ALL v1.0.0

| Config | Preset | text | data | bss | Archive |
| --- | --- | ---: | ---: | ---: | --- |
| `default` | - | 137384 | 84 | 117172 | `CtrBoard-H7_ALL-default-v1.0.0.tar.gz` |

- Commit `ad662b2` of QDU-Robomaster/bsp-dev-mc02
- xrobot 1.0.0, libxr 6.0.0, LibXR `6c51bf4`
- Image `ghcr.io/xrobot-org/docker-image-stm32:main`, toolchain `cmake/starm-clang.cmake`, build type `Debug`
- `SHA256SUMS` lists every file of this release; `firmware-manifest.json` records the builds and the Module commits
```

Release 已经有说明时（在网页上创建 Release 会同时推送 tag），保留原有说明。发布 Release 时，工作流只附加文件，说明保持原样。调用方的任务需要 `permissions: contents: write`，工作流才能创建 Release 并上传文件。
