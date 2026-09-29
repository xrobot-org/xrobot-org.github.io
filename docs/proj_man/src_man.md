---
id: proj-man-source-man
title: 模块源
sidebar_position: 5
---

# 模块源

模块源（catalog）是一个 `index.yaml`，列出模块和 BSP 的 Git 仓库。BSP 的 `Modules/sources.yaml` 组合多个模块源；`xrobot setup` 用它把 `owner/Repo` 解析为仓库地址。

---

## sources.yaml

```yaml
sources:
  - url: https://xrobot.work/xrobot-modules/index.yaml
    priority: 0
  - url: https://qdu-robomaster.github.io/qdu-future-modules/index.yaml
    priority: 0
  - url: ./my-index.yaml
    priority: 1
```

- `url` 可以是 HTTP(S) 地址，也可以是相对 `sources.yaml` 的本地路径。
- 同一个包出现在多个源中时，`priority` 数值小的优先；优先级相同且仓库不同时报错。
- `xrobot init` 写入官方源 `https://xrobot.work/xrobot-modules/index.yaml`。

---

## index.yaml

```yaml
namespace: my-team
modules:
  - https://github.com/my-team/MySensor.git
  - id: my-team/Filter
    repo: https://git.example.com/my-team/Filter.git
    status: verified
    tested_ref: v1.2.0
    tested_libxr: 0123456789abcdef0123456789abcdef01234567
bsps:
  - https://github.com/my-team/bsp-my-board.git
```

- 包的标识是 `owner/Repo`。GitHub 地址直接给出标识；其他地址使用 `namespace/仓库名`，或在映射中写 `id`。
- `bsps` 只用于发现 BSP 仓库，BSP 不能作为模块依赖。
- `status` 取 `community`（默认）、`verified` 或 `official`，描述维护与验证情况；后两者必须写 `tested_ref` 和 `tested_libxr`，表示验证针对的版本，不代表之后的所有版本。
- `mirror_of: <namespace>` 表示镜像源：从镜像拉取源码，`xrobot.lock` 仍记录原仓库地址。

---

## xrobot source

`xrobot source` 默认读取当前目录下的 `Modules/sources.yaml`，请在 BSP 根目录运行，或在子命令前加 `--sources PATH`。

```bash
xrobot source list                      # 所有包
xrobot source list --type bsp           # 只列 BSP（或 --type module）
xrobot source search STM32              # 在包信息中搜索
xrobot source get xrobot-org/BlinkLED   # 包的地址、来源和状态
xrobot source find xrobot-org/BlinkLED  # 包在所有源（含镜像）中的位置
```

编辑：

```bash
xrobot source create-sources                          # 写入只含官方源的 Modules/sources.yaml
xrobot source add-source https://example.com/index.yaml --priority 1
xrobot source create-index -o my-index.yaml --namespace my-team [--mirror-of xrobot-org]
xrobot source add-index https://github.com/my-team/MySensor.git --index my-index.yaml
```

输出示例：

```text
$ xrobot source list
xrobot-org/BlinkLED [module] https://github.com/xrobot-org/BlinkLED.git
...
```

---

## 官方模块源

- [xrobot-org/xrobot-modules](https://github.com/xrobot-org/xrobot-modules)：`https://xrobot.work/xrobot-modules/index.yaml`
- [QDU-Robomaster/qdu-future-modules](https://github.com/QDU-Robomaster/qdu-future-modules)：`https://qdu-robomaster.github.io/qdu-future-modules/index.yaml`
