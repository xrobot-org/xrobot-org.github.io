---
id: proj-man-source-man
title: Module Catalogs
sidebar_position: 5
---

# Module Catalogs

A catalog is an `index.yaml` that lists Module and BSP Git repositories. A BSP's `Modules/sources.yaml` combines several catalogs; `xrobot setup` uses them to map `owner/Repo` to a repository.

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

- `url` is an HTTP(S) address or a local path relative to `sources.yaml`.
- When several catalogs list a package, the smaller `priority` wins; equal priorities that name different repositories are an error.
- `xrobot init` writes the official catalog `https://xrobot.work/xrobot-modules/index.yaml`.

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

- A package is identified as `owner/Repo`. A GitHub URL gives the identity directly; other URLs use `namespace/<repository name>`, or an explicit `id` in a mapping.
- `bsps` is for discovering BSP repositories only; a BSP is never a Module dependency.
- `status` is `community` (default), `verified` or `official` and describes maintenance and validation. The latter two require `tested_ref` and `tested_libxr`, the versions the validation applies to, not every later version.
- `mirror_of: <namespace>` marks a mirror catalog: sources are fetched from the mirror while `xrobot.lock` keeps the original repository URL.

---

## xrobot source

`xrobot source` reads `Modules/sources.yaml` relative to the current directory; run it from the BSP root, or put `--sources PATH` before the subcommand.

```bash
xrobot source list                      # every package
xrobot source list --type bsp           # BSPs only (or --type module)
xrobot source search STM32              # search the package records
xrobot source get xrobot-org/BlinkLED   # repository, catalog and status of a package
xrobot source find xrobot-org/BlinkLED  # where a package appears in every catalog (mirrors included)
```

Editing:

```bash
xrobot source create-sources                          # write Modules/sources.yaml with the official catalog
xrobot source add-source https://example.com/index.yaml --priority 1
xrobot source create-index -o my-index.yaml --namespace my-team [--mirror-of xrobot-org]
xrobot source add-index https://github.com/my-team/MySensor.git --index my-index.yaml
```

Example output:

```text
$ xrobot source list
xrobot-org/BlinkLED [module] https://github.com/xrobot-org/BlinkLED.git
...
```

---

## Official Catalogs

- [xrobot-org/xrobot-modules](https://github.com/xrobot-org/xrobot-modules): `https://xrobot.work/xrobot-modules/index.yaml`
- [QDU-Robomaster/qdu-future-modules](https://github.com/QDU-Robomaster/qdu-future-modules): `https://qdu-robomaster.github.io/qdu-future-modules/index.yaml`
