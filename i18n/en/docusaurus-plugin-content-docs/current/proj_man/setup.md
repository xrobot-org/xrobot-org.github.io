---
id: proj-man-setup
title: Module Requests and the Lock
sidebar_position: 1
---

# Module Requests and the Lock

`Modules/modules.yaml` states which Modules a BSP needs. `xrobot setup` resolves them to exact commits in `xrobot.lock`, checks the Modules out, checks every application configuration and regenerates the entry.

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

- `xrobot:` pins the tool version (a release version or a 40-hex commit).
- `modules` lists only direct requests; dependencies come recursively from each Module header's manifest.
- Each entry is `owner/Repo[@ref]` or a mapping with `id`, `ref` and `context_ref`; `owner/Repo` must be listed in a [catalog](./src_man.md).

These commands edit the file and keep its comments:

```bash
xrobot module add owner/Repo@ref
xrobot module remove owner/Repo
```

### Ref Rules

| ref | Meaning |
| --- | --- |
| omitted | The remote default branch |
| branch / tag / commit | That commit; write `refs/heads/...` or `refs/tags/...` when a name is both a branch and a tag |
| `same-or-dev` | The Module branch named like the BSP's current branch, otherwise `dev`; on a BSP tag, the identical tag |
| `same` | The branch or tag with the same name must exist |

`same` / `same-or-dev` use the BSP repository's current branch as context. A detached checkout (such as CI) passes the logical ref with `--context-ref refs/heads/<branch>` (or `refs/tags/<tag>`). `context_ref` in a request sets the context for that Module and its dependencies, for example to test a Module at a PR commit while its dependencies follow the PR's branch.

---

## xrobot.lock

The lock records, for every Module in the dependency closure, the repository, the requested ref, what it resolved to, and the commit. Local repository paths are stored relative to the lock file. Once written, the lock is authoritative: the same lock builds the same sources on a feature branch, after its merge, and in CI.

The lock is written by `xrobot setup`, says so in its first line, and is not edited by hand. After a change to `modules.yaml`, `xrobot setup` updates the lock, and both are committed together.

| Command | Effect |
| --- | --- |
| `xrobot setup` | Keeps locked commits; added, removed or changed requests change only those entries |
| `xrobot setup --update MODULE...` | Re-resolves the named Modules |
| `xrobot setup --update` | Re-resolves every Module |
| `xrobot setup --frozen` | Restores exactly the lock; fails if `modules.yaml` no longer matches it or the installed XRobot differs from `xrobot:` |
| `xrobot setup --offline` | Uses only local checkouts and commits, without network access |
| `xrobot setup --context-ref REF` | Sets the BSP context for `same` / `same-or-dev` |
| `xrobot setup --release-ref REF` | Refuses commits that are not released for the target line (see below) |

`--update` cannot be combined with `--frozen` or `--offline`. It also runs `xrobot sync` on every configuration and prints the changes.

Modules are checked out at their locked commits (detached HEAD). Setup never discards local work: a Module with uncommitted changes, or with a HEAD commit that is on no remote branch or tag, stops it with an explanation. While developing a Module inside a BSP, keep the changes uncommitted; when they are ready, push them to a branch of the Module and run `xrobot setup --update <Module>`.

Setup also fails when two selected packages define the same global Module class, when dependencies form a cycle, or when one Module resolves to different commits.

---

## What Setup Does

1. Compares the installed XRobot with `xrobot:`: a difference is a warning, and an error with `--frozen`; a commit in `xrobot:` is not compared;
2. resolves the Modules as described above, writes `xrobot.lock` and checks the Modules out into `Modules/<owner>/<Repo>/`;
3. writes `Modules/CMakeLists.txt`;
4. checks every application configuration under `User/` (except `User/libxr_config.yaml`);
5. regenerates `User/xrobot_main.hpp` for the selected product (default `User/xrobot.yaml`).

```text
$ xrobot setup
Resolved 1 Module commits
Checked 2 configs; generated User/xrobot_main.hpp for User/xrobot.yaml
```

`Modules/<owner>/<Repo>/`, `Modules/CMakeLists.txt` and `User/xrobot_main.hpp` are not committed.

---

## Release Gate

BSPs and official Modules share one branch model: `dev` receives changes; `master` is the stable line and is updated only by pull requests from `dev`. `--release-ref` names the BSP's target:

| `--release-ref` | Every locked commit must be on |
| --- | --- |
| `refs/heads/dev` | the Module's `dev` |
| `refs/heads/master`, `refs/heads/main`, `refs/tags/...` | the Module's `master` (or `main`) |

Explicitly requested tags count as released; a third-party Module without that line can only be pinned by an explicit commit. A commit that was not merged, or was merged by squash or rebase, is not on the target line: merge the Module first, then run `xrobot setup --update <Module> --context-ref refs/heads/<target>`.

The same rule applies to the tools: `xrobot:` in `Modules/modules.yaml` and `generator:` in `User/libxr_config.yaml` must be present; a commit pin must be on the tool repository's matching line, and a release version passes.

Typical BSP CI steps:

```bash
xrobot format --check
xrobot setup --frozen --context-ref "$CONTEXT_REF" --release-ref "$TARGET_REF"
cmake -S . -B build
cmake --build build
```

`CONTEXT_REF` is the branch or tag being built; `TARGET_REF` is the pull request's base branch (for a push, the pushed branch or tag).

---

## CMake Integration

The BSP sets `XROBOT_MODULES_DIR` to its `Modules` directory before adding LibXR (CMake 3.19 or newer is required):

```cmake
set(XROBOT_MODULES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/Modules)
add_subdirectory(Middlewares/Third_Party/LibXR)
```

In an STM32 project, `libxr stm32 cmake` and `libxr stm32 setup` write or remove this line according to whether `User/app_main.cpp` uses XRobot. LibXR then includes `Modules/CMakeLists.txt` and checks `User/xrobot_main.hpp`; see [Entry and Generation](./gen_main.md#build-check).
