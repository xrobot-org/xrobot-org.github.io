---
id: proj-man-setup
title: 模块请求与锁定
sidebar_position: 1
---

# 模块请求与锁定

`Modules/modules.yaml` 列出 BSP 需要的模块。`xrobot setup` 把它们解析为 `xrobot.lock` 中的具体提交，检出模块，检查所有配置，并重新生成 `User/xrobot_main.hpp`。

---

## modules.yaml

```yaml
xrobot: 1.0.1
modules:
  - xrobot-org/BlinkLED@dev
  - xrobot-org/BMI088@same-or-dev
  - id: xrobot-org/MadgwickAHRS
    ref: 286cc8935c9349c1d5c0446f6f5e957083465ee2
    context_ref: refs/heads/feature/new-api
```

- `xrobot:` 固定工具版本（发布版本号或 40 位十六进制的提交号）。
- `modules` 只写直接需要的模块；依赖由各模块头文件中的 manifest 递归给出。
- 每项是 `owner/Repo[@ref]`，或含 `id`、`ref`、`context_ref` 的映射；`owner/Repo` 必须能在 [源](./src_man.md) 中找到。只在本 BSP 中使用的模块以 `path:` 请求，见[本地模块](#本地模块)。

用命令编辑时不会丢失注释：

```bash
xrobot module add owner/Repo@ref
xrobot module remove owner/Repo
```

不写 `@ref` 时，`xrobot module add` 写入 `@same-or-dev`。

### ref 规则

| ref | 含义 |
| --- | --- |
| 省略 | 远程默认分支 |
| 分支名 / 标签名 / 提交 | 对应的提交；同名的分支和标签需写成 `refs/heads/...` 或 `refs/tags/...` |
| `same-or-dev` | 与 BSP 当前分支同名的模块分支，不存在时用 `dev`；BSP 在标签上时要求同名标签 |
| `same` | 必须存在同名分支或标签 |

`same` / `same-or-dev` 跟随 BSP 仓库的当前分支；CI 等分离 HEAD 的检出用 `--context-ref refs/heads/<分支>`（或 `refs/tags/<标签>`）传入逻辑分支。请求中的 `context_ref` 为这一个模块及其依赖指定上下文，例如用 PR 的提交测试一个模块时保留其依赖的分支。显式分支名的请求把它自己的分支作为下一层的上下文；`same`、`same-or-dev`、显式 tag 和提交号沿用最初的上下文，每一层各自查找同名分支、找不到退回 `dev`，中间层退回 `dev` 不改变下一层跟随的分支。同一模块沿两条依赖链解析到不同提交时，报错列出链上缺同名分支、退回 `dev` 的仓库。

BSP 不在 Git 仓库中时没有可跟随的分支：不加 `--update` 时沿用 lock 中的提交；`--update` 会报错，需要用 `--context-ref refs/heads/<分支>` 给出逻辑分支，或给请求写显式的 ref。

---

## 本地模块

只在一个 BSP 中使用的模块可以直接放在 BSP 的目录中，在 `modules.yaml` 中以 `path:` 请求（XRobot 1.0.2 起）。目录结构与普通模块相同：目录名即类名，目录中有同名的主头文件 `<目录名>.hpp`，也可以有自己的 `CMakeLists.txt`。模块 id 为 `local/<目录名>`；`local` 这个 owner 保留给本地模块，源中的包使用它时报错。

```yaml
xrobot: 1.0.2
modules:
  - xrobot-org/BlinkLED@same-or-dev
  - path: Modules/local/Heartbeat
```

`path` 相对 BSP 根目录，也可以是绝对路径，推荐的位置是 `Modules/local/<目录名>`。`path` 的最后一段与目录的实际名称一致，包括大小写。路径指向 BSP 根目录、`Modules/` 或包含 BSP 的目录，含有分号或控制字符，或两个本地模块的目录名相同时，`xrobot setup` 报错。

`xrobot module add --path` 写入这样一项，写入前检查目录和主头文件。相对路径先按当前目录查找，不存在时按 BSP 根目录查找，写入时换算成相对 BSP 根目录的路径。删除时写模块 id：

```text
$ xrobot module add --path Modules/local/Heartbeat
已添加本地模块 local/Heartbeat（path: Modules/local/Heartbeat）；请运行 `xrobot setup` 更新 xrobot.lock
$ xrobot module remove local/Heartbeat
已删除 local/Heartbeat；请运行 `xrobot setup` 更新 xrobot.lock
```

### 提交与 .gitignore

BSP 目录内的本地模块随 BSP 仓库提交，由 BSP 的提交固定。`xrobot init` 生成的 `.gitignore` 含有 `/Modules/*/`，这条规则也忽略 `Modules/local/`。`xrobot setup` 检查本地模块目录中尚未被 Git 跟踪的源文件、头文件和 CMake 文件，其中有被 `.gitignore` 忽略的文件时报错，并给出需要添加的一行：

```text
$ xrobot setup
本地模块 local/Heartbeat（Modules/local/Heartbeat）被 BSP 的 .gitignore 忽略，Modules/local/Heartbeat/Heartbeat.hpp 不会被提交；请在 .gitignore 中忽略它的规则（.gitignore:3:/Modules/*/）之后加一行 `!/Modules/local/`
```

加上 `!/Modules/local/` 之后，`Modules/local/` 下的本地模块都随 BSP 提交。

本地模块目录中有自己的 `.git` 时，BSP 仓库不跟踪其中的文件，`xrobot setup` 给出警告。BSP 目录之外的本地模块（例如 `../shared/Heartbeat` 或绝对路径）只在本机可用；`xrobot setup` 每次运行时给出警告，`--frozen` 下同样只是警告：

```text
$ xrobot setup
警告：本地模块 local/Heartbeat 在 BSP 之外（../shared/Heartbeat）；没有提交固定它，其他检出和 CI 无法复现
已解析 1 个模块提交和 1 个本地模块
已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp
```

### 依赖

本地模块的 manifest 与普通模块的写法相同，`xrobot setup` 直接读取工作区中的主头文件。它请求的模块与 `modules.yaml` 中的请求同等对待：`same`、`same-or-dev` 跟随 BSP 的分支，解析结果写入 lock。依赖另一个本地模块时写它的 id，例如 `local/Base`，被依赖的模块同样在 `modules.yaml` 中以 `path:` 请求。来自源的模块请求本地模块时报错。

### lock 与 setup 选项

lock 在 `local` 部分记录每个本地模块的路径，它是 `modules.yaml` 中 `path:` 请求的副本；没有本地模块时不写出这一部分。

```yaml
local:
  local/Heartbeat:
    path: Modules/local/Heartbeat
```

生成的 `Modules/CMakeLists.txt` 按路径加入本地模块，相对路径写成相对 `Modules/` 的路径：

```cmake
target_include_directories(xr PUBLIC "${CMAKE_CURRENT_LIST_DIR}/local/Heartbeat")
include("${CMAKE_CURRENT_LIST_DIR}/xrobot-org/BlinkLED/CMakeLists.txt")
```

| 命令 | 对本地模块的效果 |
| --- | --- |
| `xrobot setup` | 本地模块的依赖变化后，保持已锁定的提交并重新解析依赖闭包；lock 的 `local` 部分与 `modules.yaml` 不一致时重写 |
| `xrobot setup --frozen` | 本地模块的依赖或 lock 的 `local` 部分与当前不一致时失败 |
| `xrobot setup --offline` | 本地模块的依赖变化后失败 |
| `xrobot setup --update local/<目录名>` | 重新解析它的依赖 |
| `xrobot setup --leave-local` | 只接受来自源的模块，点名本地模块时报错 |
| `xrobot setup --release-ref` | 只检查来自源的模块 |

---

## xrobot.lock

lock 记录依赖闭包中每个模块的仓库、请求的 ref、解析结果和提交。本地仓库路径保存为相对 lock 的路径。lock 生成后即为唯一依据，同一份 lock 在功能分支、合并后和 CI 中检出相同的模块代码。

lock 由 `xrobot setup` 写出，首行为生成说明，不应手动编辑。修改 `modules.yaml` 后运行 `xrobot setup` 更新 lock，并与 `modules.yaml` 一起提交。

| 命令 | 效果 |
| --- | --- |
| `xrobot setup` | 保留已锁定的提交；新增、删除或修改的请求只影响对应条目 |
| `xrobot setup --update MODULE...` | 只重新解析指定模块 |
| `xrobot setup --update` | 重新解析全部模块 |
| `xrobot setup --frozen` | 严格按 lock 检出；`modules.yaml` 与锁不一致，或已安装的 XRobot 与 `xrobot:` 不一致时失败 |
| `xrobot setup --offline` | 不访问网络，只使用本地已有的检出和提交；需要 `xrobot.lock`，且 `modules.yaml` 与 lock 一致 |
| `xrobot setup --context-ref REF` | 指定 `same` / `same-or-dev` 的 BSP 上下文 |
| `xrobot setup --release-ref REF` | 拒绝对目标分支未发布的提交（见下文） |
| `xrobot setup --leave-local MODULE...` | 把点名的模块移到 lock 解析出的提交（见下文） |
| `xrobot setup --no-line-directives` | 重新生成头文件时不写 `#line` 指令 |

`--update` 不能与 `--frozen`、`--offline` 同时使用；它还会对所有配置执行 `xrobot sync`，并打印改动。

模块被检出为锁定提交的分离 HEAD。模块已在锁定的提交上时，其中未提交的修改保持不变；需要把模块移到另一个提交时，若模块有未提交的修改，或 HEAD 是不在任何远程分支或标签上的本地提交，`xrobot setup` 停止并说明原因。在 BSP 中开发模块时，保持修改未提交；准备好后推送到模块的一个分支，再运行 `xrobot setup --update <模块>`。

`xrobot setup --leave-local <模块...>` 把点名的模块移到 lock 解析出的提交：模块停在未推送的本地提交上时，先打印这些提交，再检出目标提交，本地提交留在原来的分支上，HEAD 游离时可用 `git reflog` 找回。点名模块有未提交的修改时仍然拒绝；加 `-f` 时先打印将丢弃的内容，再丢弃需要移动的点名模块的已跟踪修改和未跟踪文件（子模块里的同样处理），被忽略的文件保留。`-f` 只与 `--leave-local` 一起使用，只作用于点名的模块。

两个选中的模块定义了同名的全局类、依赖成环、同一模块被解析到不同提交时，setup 都会报错。

---

## setup 的执行步骤

1. 比较已安装的 XRobot 与 `xrobot:`：不一致时给出警告，`--frozen` 下报错；`xrobot:` 为提交号时不比较；
2. 按上表解析模块，写入 `xrobot.lock`，把模块检出到 `Modules/<owner>/<Repo>/`；
3. 生成 `Modules/CMakeLists.txt`；
4. 检查 `User/` 下的所有配置（`User/libxr_config.yaml` 除外）；
5. 为选中的配置重新生成 `User/xrobot_main.hpp`（默认 `User/xrobot.yaml`）。

输出示例：

```text
$ xrobot setup
已解析 1 个模块提交
已检查 1 个配置；已为 User/xrobot.yaml 生成 User/xrobot_main.hpp
```

`Modules/<owner>/<Repo>/`、`Modules/CMakeLists.txt` 和 `User/xrobot_main.hpp` 不提交。

---

## 发布门禁

BSP 与官方模块使用同一套分支：`dev` 接收修改，`master` 是稳定线，只通过从 `dev` 发起的 PR 更新。`--release-ref` 指定 BSP 的目标：

| `--release-ref` | 每个锁定的提交必须在 |
| --- | --- |
| `refs/heads/dev` | 模块的 `dev` |
| `refs/heads/master`、`refs/heads/main`、`refs/tags/...` | 模块的 `master`（或 `main`） |
| 其他分支（如 `refs/heads/feature-x`） | 不检查 |

显式请求的标签视为已发布；没有该分支线的第三方模块只能用显式提交。模块 PR 以 merge commit 合并后，锁定的提交就在目标分支上，BSP 无需刷新 lock 即可通过；以 squash / rebase 方式合并或改写历史后，锁定的提交不再在目标分支上，按报错给出的命令刷新，例如 `xrobot setup --update <模块> --context-ref refs/heads/dev`。

同一规则也用于工具版本：`Modules/modules.yaml` 的 `xrobot:` 必须存在，`User/libxr_config.yaml` 中写了 `generator:` 时同样检查；写成提交号时必须在工具仓库的对应分支上，发布版本号直接通过。

BSP CI 的典型步骤：

```bash
xrobot format --check
xrobot setup --frozen --context-ref "$CONTEXT_REF" --release-ref "$TARGET_REF"
cmake -S . -B build
cmake --build build
```

`CONTEXT_REF` 是被构建的分支或标签，`TARGET_REF` 是 PR 的目标分支（推送时即被推送的分支或标签）。STM32 BSP 不必自己写这些步骤：共享工作流 `bsp-stm32-ci.yml` 已包含它们，见 [BSP CI](./ci.md#bsp-ci)。

---

## CMake 集成

BSP 在添加 LibXR 之前把 `XROBOT_MODULES_DIR` 设为 `Modules` 目录（需要 CMake 3.19 或更新）：

```cmake
set(XROBOT_MODULES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/Modules)
add_subdirectory(Middlewares/Third_Party/LibXR)
```

STM32 工程中这一行由代码生成器写入，见 [与 XRobot 集成](../code_gen/xrobot_inter.md)。LibXR 随后包含 `Modules/CMakeLists.txt`，并检查 `User/xrobot_main.hpp`，见 [主函数生成](./gen_main.md#构建时检查)。
