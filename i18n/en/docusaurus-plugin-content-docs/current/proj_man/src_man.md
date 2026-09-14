---
id: proj-man-source-man
title: Module Source Management
sidebar_position: 0
---

# Module Source Management

XRobot can combine multiple `index.yaml` files through `sources.yaml`. Official sources, private sources, and mirrors all use the same mechanism, and `xrobot_src_man` is used to generate, maintain, and query them.

---

## Why Manage Module Sources?

- Add a mirror or internal acceleration source when access to the official repository is slow.
- Maintain a private `index.yaml` and namespace for internal modules.
- Use separate namespaces per source to avoid naming conflicts.
- Let same-named modules come from different sources and choose by priority.

---

## Basic Concepts

| Term              | Description                                                                 |
|-------------------|-----------------------------------------------------------------------------|
| **Module Source** | An `index.yaml` file describing multiple module repositories under a namespace |
| **sources.yaml**  | A local file listing multiple source entries including URLs and priorities   |
| **index.yaml**    | The actual module list and namespace definition, hosted publicly or locally  |

---

## 1. Quick Start: Using the Official Module Source

No configuration needed—uses the default source: [xrobot-modules/index.yaml](https://xrobot.work/xrobot-modules/index.yaml)

### Create a sources.yaml Template

```bash
xrobot_src_man create-sources
```

### List All Available Modules

```bash
xrobot_src_man list
```

Sample output:

```bash
Available modules:
  xrobot-org/BlinkLED   source: https://xrobot.work/xrobot-modules/index.yaml (actual namespace: xrobot-org)
```

---

## 2. Add a Private Module Source

You can add a custom `index.yaml` for private modules or mirrors.

### 1. Create `sources.yaml` and Add Multiple Sources

```bash
xrobot_src_man create-sources --output Modules/sources.yaml
```

Then edit it like this:

```yaml
sources:
  - url: https://xrobot.work/xrobot-modules/index.yaml
    priority: 0
  - url: https://your-domain.com/private-index.yaml
    priority: 1
```

### 2. Add a Local Private Source (Local Paths Supported)

```bash
xrobot_src_man add-source ./Modules/my-index.yaml --priority 1
```

---

## 3. Mirror / Intranet Acceleration Support

Some `index.yaml` files support the `mirror_of` field to indicate they mirror another source, for example:

```yaml
namespace: your-team
mirror_of: xrobot-org
modules:
  - https://git.your-company.com/BlinkLED.git
  - https://git.your-company.com/MySensor.git
```

---

## 4. Creating and Maintaining Custom index.yaml

You can also maintain your own `index.yaml` to organize private modules.

### 1. Create an index.yaml Template

```bash
xrobot_src_man create-index --output Modules/my-index.yaml --namespace yourns
```

To mark it as a mirror:

```bash
xrobot_src_man create-index --output my-index.yaml --namespace yourns --mirror-of xrobot-org
```

### 2. Add Module Repositories to index.yaml

```bash
xrobot_src_man add-index https://github.com/yourorg/MyModule.git --index Modules/my-index.yaml
```

---

## 5. Query and Validate Modules

Module origins and URLs can be queried directly:

### List All Modules

```bash
xrobot_src_man list
```

### Get Address and Source of a Module

```bash
xrobot_src_man get yourns/MyModule
```

### Find a Module Across All Sources (Including Mirrors)

```bash
xrobot_src_man find yourns/MyModule
```
