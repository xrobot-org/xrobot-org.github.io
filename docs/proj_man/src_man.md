---
id: proj-man-source-man
title: 模块仓库源管理
sidebar_position: 0
---

# 模块仓库源管理

XRobot 的模块仓库可以通过 `sources.yaml` 组合多个 `index.yaml`。官方源、私有源和镜像源都走同一套机制，`xrobot_src_man` 负责生成、维护和查询这些源。

---

## 为什么需要模块源管理？

- 访问官方仓库较慢时，可以接入镜像源或内网加速源。
- 有内部模块时，可以单独维护私有 `index.yaml` 和 namespace。
- 不同源使用独立 namespace，可避免模块命名冲突。
- 同名模块可以来自不同来源，按优先级选择。

---

## 基础概念

| 名称 | 说明 |
|------|------|
| **模块源（Source）** | 一个 `index.yaml` 文件，描述若干模块仓库的列表，绑定命名空间（namespace） |
| **sources.yaml** | 用户本地的模块源列表，包含多个 `index.yaml` 的地址、优先级等信息 |
| **index.yaml** | 单个源的模块列表和命名空间定义文件，可托管在公网或本地 |

---

## 一、快速上手：使用官方模块源

无需配置，默认使用官方源：[xrobot-modules/index.yaml](https://xrobot.work/xrobot-modules/index.yaml)。

### 创建 sources.yaml 模板

```bash
xrobot_src_man create-sources
```

### 查看当前所有可用模块

```bash
xrobot_src_man list
```

输出示例：

```bash
Available modules:
  xrobot-org/BlinkLED   source: https://xrobot.work/xrobot-modules/index.yaml (actual namespace: xrobot-org)
```

---

## 二、添加私有模块源

项目里可以额外接入自定义 `index.yaml`，用于私有模块或镜像仓库。

### 1. 创建 sources.yaml 并加入多个源

```bash
xrobot_src_man create-sources --output Modules/sources.yaml
```

然后编辑该文件：

```yaml
sources:
  - url: https://xrobot.work/xrobot-modules/index.yaml
    priority: 0
  - url: https://your-domain.com/private-index.yaml
    priority: 1
```

### 2. 本地添加私有源（本地路径也支持）

```bash
xrobot_src_man add-source ./Modules/my-index.yaml --priority 1
```

---

## 三、镜像/内网加速支持

某些 index.yaml 支持指定 `mirror_of` 字段，表示该源是另一个源的镜像，例如：

```yaml
namespace: your-team
mirror_of: xrobot-org
modules:
  - https://git.your-company.com/BlinkLED.git
  - https://git.your-company.com/MySensor.git
```

---

## 四、创建与维护自定义 index.yaml

也可以单独维护自己的 `index.yaml` 来组织私有模块。

### 1. 创建 index.yaml 模板

```bash
xrobot_src_man create-index --output Modules/my-index.yaml --namespace yourns
```

如需标记为镜像：

```bash
xrobot_src_man create-index --output my-index.yaml --namespace yourns --mirror-of xrobot-org
```

### 2. 向 index.yaml 添加模块仓库

```bash
xrobot_src_man add-index https://github.com/yourorg/MyModule.git --index Modules/my-index.yaml
```

---

## 五、模块查询与验证

模块来源和地址可以直接查询：

### 查询所有模块

```bash
xrobot_src_man list
```

### 获取某模块的地址及来源

```bash
xrobot_src_man get yourns/MyModule
```

### 查找模块在所有源中的位置（包括镜像）

```bash
xrobot_src_man find yourns/MyModule
```
