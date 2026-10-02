---
id: proj-man-setup
title: 模块请求与锁定
sidebar_position: 1
---

# 模块请求与锁定

`Modules/modules.yaml` 写需要哪些模块，`xrobot setup` 把它们解析成 `xrobot.lock` 中的精确 commit、检出模块、检查所有应用配置并重新生成入口。

---

## modules.yaml

```yaml
xrobot: 1.0.0
modules:
  - xrobot-org/BlinkLED@dev
  - QDU-Robomaster/Gimbal@same-or-dev
  - id: QDU-Robomaster/Chassis
    ref: 0123456789abcdef0123456789abcdef01234567
    context_ref: refs/heads/feature/new-api
```

- `xrobot:` 固定工具版本（发布版本号或 40 位 commit）。
- `modules` 只写直接需要的模块；依赖由各模块头文件中的 manifest 递归给出。
- 每项是 `owner/Repo[@ref]`，或含 `id`、`ref`、`context_ref` 的映射；`owner/Repo` 必须能在 [模块源](./src_man.md) 中找到。

用命令编辑时不会丢失注释：

```bash
xrobot module add owner/Repo@ref
xrobot module remove owner/Repo
```

### ref 规则

| ref | 含义 |
| --- | --- |
| 省略 | 远程默认分支 |
| 分支名 / 标签名 / commit | 对应的提交；同名的分支和标签需写成 `refs/heads/...` 或 `refs/tags/...` |
| `same-or-dev` | 与 BSP 当前分支同名的模块分支，不存在时用 `dev`；BSP 在标签上时要求同名标签 |
| `same` | 必须存在同名分支或标签 |

`same` / `same-or-dev` 以 BSP 仓库的当前分支为上下文。CI 等分离 HEAD 的检出用 `--context-ref refs/heads/<分支>`（或 `refs/tags/<标签>`）传入逻辑分支；请求中的 `context_ref` 为这一个模块及其依赖指定上下文，例如用 PR 的 commit 测试一个模块时保留其依赖的分支。

---

## xrobot.lock

锁文件记录依赖闭包中每个模块的仓库、请求的 ref、解析结果和 commit。本地仓库路径以相对锁文件的路径保存。锁生成后即为唯一依据，同一个锁在功能分支、合并后和 CI 中构建出相同的源码。

锁文件由 `xrobot setup` 写出，首行为生成说明，不应手动编辑。修改 `modules.yaml` 后运行 `xrobot setup` 更新锁文件，并与 `modules.yaml` 一起提交。

| 命令 | 效果 |
| --- | --- |
| `xrobot setup` | 保留已锁定的 commit；新增、删除或修改的请求只影响对应条目 |
| `xrobot setup --update MODULE...` | 只重新解析指定模块 |
| `xrobot setup --update` | 重新解析全部模块 |
| `xrobot setup --frozen` | 严格恢复锁文件；`modules.yaml` 与锁不一致，或已安装的 XRobot 与 `xrobot:` 不一致时失败 |
| `xrobot setup --offline` | 不访问网络，只使用本地已有的检出和提交 |
| `xrobot setup --context-ref REF` | 指定 `same` / `same-or-dev` 的 BSP 上下文 |
| `xrobot setup --release-ref REF` | 拒绝对目标分支未发布的提交（见下文） |

`--update` 不能与 `--frozen`、`--offline` 同时使用；它还会对所有配置执行 `xrobot sync`，并打印改动。

模块被检出为锁定 commit 的分离 HEAD。setup 不会丢弃本地修改：模块有未提交修改，或 HEAD 是不在任何远程分支或标签上的本地提交时，setup 停止并说明原因。在 BSP 中开发模块时，保持修改未提交；准备好后推送到模块的一个分支，再运行 `xrobot setup --update <模块>`。

两个选中的包定义了同名的全局模块类、依赖成环、同一模块被解析到不同 commit 时，setup 都会报错。

---

## setup 做了什么

1. 比较已安装的 XRobot 与 `xrobot:`：不一致时给出警告，`--frozen` 下报错；`xrobot:` 为提交号时不比较；
2. 按上表解析模块，写入 `xrobot.lock`，把模块检出到 `Modules/<owner>/<Repo>/`；
3. 生成 `Modules/CMakeLists.txt`；
4. 检查 `User/` 下的所有应用配置（`User/libxr_config.yaml` 除外）；
5. 为当前选中的产品重新生成 `User/xrobot_main.hpp`（默认 `User/xrobot.yaml`）。

输出示例：

```text
$ xrobot setup
Resolved 1 Module commits
Checked 2 configs; generated User/xrobot_main.hpp for User/xrobot.yaml
```

`Modules/<owner>/<Repo>/`、`Modules/CMakeLists.txt` 和 `User/xrobot_main.hpp` 不提交。

---

## 发布门禁

BSP 与官方模块使用同一套分支：`dev` 接收修改，`master` 是稳定线，只通过从 `dev` 发起的 PR 更新。`--release-ref` 指定 BSP 的目标：

| `--release-ref` | 每个锁定的 commit 必须在 |
| --- | --- |
| `refs/heads/dev` | 模块的 `dev` |
| `refs/heads/master`、`refs/heads/main`、`refs/tags/...` | 模块的 `master`（或 `main`） |

显式请求的标签视为已发布；没有该分支线的第三方模块只能用显式 commit。未合并、或以 squash / rebase 方式合并的提交不在目标分支上，此时先合并模块，再运行 `xrobot setup --update <模块> --context-ref refs/heads/<目标分支>`。

同一规则也用于工具版本：`Modules/modules.yaml` 的 `xrobot:` 和 `User/libxr_config.yaml` 的 `generator:` 必须存在；写成 commit 时必须在工具仓库的对应分支上，发布版本号直接通过。

BSP CI 的典型步骤：

```bash
xrobot format --check
xrobot setup --frozen --context-ref "$CONTEXT_REF" --release-ref "$TARGET_REF"
cmake -S . -B build
cmake --build build
```

`CONTEXT_REF` 是被构建的分支或标签，`TARGET_REF` 是 PR 的目标分支（推送时即被推送的分支或标签）。

---

## CMake 集成

BSP 在添加 LibXR 之前把 `XROBOT_MODULES_DIR` 设为 `Modules` 目录（需要 CMake 3.19 或更新）：

```cmake
set(XROBOT_MODULES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/Modules)
add_subdirectory(Middlewares/Third_Party/LibXR)
```

STM32 工程的这一行由 `libxr stm32 cmake` 和 `libxr stm32 setup` 按 `User/app_main.cpp` 是否使用 XRobot 写入或删除。LibXR 随后包含 `Modules/CMakeLists.txt`，并检查 `User/xrobot_main.hpp`，见 [入口与生成](./gen_main.md#构建时检查)。
