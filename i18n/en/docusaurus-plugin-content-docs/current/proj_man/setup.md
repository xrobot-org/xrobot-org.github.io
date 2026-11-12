---
id: proj-man-setup
title: Module Requests and the Lock
sidebar_position: 1
---

# Module Requests and the Lock

`Modules/modules.yaml` states which Modules a BSP needs. `xrobot setup` resolves them to exact commits in `xrobot.lock`, checks the Modules out, checks every configuration and regenerates `User/xrobot_main.hpp`.

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

- `xrobot:` pins the tool version (a release version or a 40-hex commit).
- `modules` lists only direct requests; dependencies come recursively from each Module header's manifest.
- Each entry is `owner/Repo[@ref]` or a mapping with `id`, `ref` and `context_ref`; `owner/Repo` must be listed in a [Source](./src_man.md). A Module used only by this BSP is requested with `path:`, see [Local Modules](#local-modules).

These commands edit the file and keep its comments:

```bash
xrobot module add owner/Repo@ref
xrobot module remove owner/Repo
```

Without `@ref`, `xrobot module add` writes `@same-or-dev`.

### Ref Rules

| ref | Meaning |
| --- | --- |
| omitted | The remote default branch |
| branch / tag / commit | That commit; write `refs/heads/...` or `refs/tags/...` when a name is both a branch and a tag |
| `same-or-dev` | The Module branch named like the BSP's current branch, otherwise `dev`; on a BSP tag, the identical tag |
| `same` | The branch or tag with the same name must exist |

`same` / `same-or-dev` follow the BSP repository's current branch; a detached checkout (such as CI) passes the logical ref with `--context-ref refs/heads/<branch>` (or `refs/tags/<tag>`). `context_ref` in a request sets the context for that Module and its dependencies, for example to test a Module at a PR commit while its dependencies follow the PR's branch. A request with an explicit branch name makes that branch the context of the next layer; `same`, `same-or-dev`, explicit tags and commits keep the original context: every layer looks for its own branch of that name and falls back to `dev`, and a middle layer's fallback does not change what the next layer follows. When one Module resolves to different commits along two dependency chains, the error names the repositories in the chains that lack the branch and fell back to `dev`.

A BSP outside Git has no branch to follow: without `--update` the lock is kept as it is; `--update` fails and needs `--context-ref refs/heads/<branch>`, or an explicit ref in the request.

---

## Local Modules

A Module used by a single BSP can live in a folder of the BSP and be requested in `modules.yaml` with `path:` (from XRobot 1.0.2). The folder is laid out like any other Module: its name is the class name, it holds the primary header `<folder name>.hpp`, and it may have its own `CMakeLists.txt`. The Module id is `local/<folder name>`; the owner `local` is reserved for local Modules, and a package of a Source that uses it is an error.

```yaml
xrobot: 1.0.2
modules:
  - xrobot-org/BlinkLED@same-or-dev
  - path: Modules/local/Heartbeat
```

`path` is relative to the BSP root or absolute; the recommended place is `Modules/local/<folder name>`. The last segment of `path` matches the actual folder name, including its case. A path that names the BSP root, `Modules/` or a folder containing the BSP, a path with a semicolon or a control character, and two local Modules with the same folder name make `xrobot setup` fail.

`xrobot module add --path` writes such an entry after checking the folder and its primary header. A relative path is looked up from the current directory first and from the BSP root otherwise, and is written relative to the BSP root. Removal takes the Module id:

```text
$ xrobot module add --path Modules/local/Heartbeat
Added local Module local/Heartbeat (path: Modules/local/Heartbeat); run `xrobot setup` to update xrobot.lock
$ xrobot module remove local/Heartbeat
Removed local/Heartbeat; run `xrobot setup` to update xrobot.lock
```

### Commits and .gitignore

A local Module inside the BSP is committed with the BSP repository and pinned by the BSP's commits. The `.gitignore` written by `xrobot init` contains `/Modules/*/`, which also ignores `Modules/local/`. `xrobot setup` checks the source, header and CMake files of a local Module that Git does not track yet; when `.gitignore` ignores one of them, it fails and names the line to add:

```text
$ xrobot setup
Local Module local/Heartbeat (Modules/local/Heartbeat) is ignored by the BSP's .gitignore, so Modules/local/Heartbeat/Heartbeat.hpp would not be committed; add `!/Modules/local/` to .gitignore after the rule that ignores it (.gitignore:3:/Modules/*/)
```

With `!/Modules/local/` added, every local Module under `Modules/local/` is committed with the BSP.

When the folder of a local Module has its own `.git`, the BSP repository does not track its files and `xrobot setup` warns. A local Module outside the BSP (such as `../shared/Heartbeat` or an absolute path) is available on that machine only; `xrobot setup` warns on every run, and `--frozen` warns as well:

```text
$ xrobot setup
warning: local Module local/Heartbeat is outside the BSP (../shared/Heartbeat); no commit pins it, so other checkouts and CI cannot reproduce it
Resolved 1 Module commit and 1 local Module
Checked 1 config; generated User/xrobot_main.hpp for User/xrobot.yaml
```

### Dependencies

The manifest of a local Module is written like that of any Module, and `xrobot setup` reads the primary header from the working tree. The Modules it requests count as requests of `modules.yaml`: `same` and `same-or-dev` follow the BSP branch, and the results go into the lock. A dependency on another local Module is written as its id, such as `local/Base`, and that Module is requested with `path:` in `modules.yaml` as well. A Module from a Source that requests a local Module is an error.

### The Lock and Setup Options

The `local` section of the lock records the path of every local Module; it copies the `path:` requests of `modules.yaml` and is left out when there are no local Modules.

```yaml
local:
  local/Heartbeat:
    path: Modules/local/Heartbeat
```

The generated `Modules/CMakeLists.txt` adds a local Module by its path, writing a relative path relative to `Modules/`:

```cmake
target_include_directories(xr PUBLIC "${CMAKE_CURRENT_LIST_DIR}/local/Heartbeat")
include("${CMAKE_CURRENT_LIST_DIR}/xrobot-org/BlinkLED/CMakeLists.txt")
```

| Command | Effect on local Modules |
| --- | --- |
| `xrobot setup` | After the dependencies of a local Module change, keeps the locked commits and resolves the closure again; rewrites a `local` section that differs from `modules.yaml` |
| `xrobot setup --frozen` | Fails when the dependencies of a local Module or the `local` section of the lock differ from the current state |
| `xrobot setup --offline` | Fails after the dependencies of a local Module change |
| `xrobot setup --update local/<folder name>` | Resolves its dependencies again |
| `xrobot setup --leave-local` | Takes Modules from a Source only; naming a local Module is an error |
| `xrobot setup --release-ref` | Checks the Modules from a Source only |

---

## xrobot.lock

The lock records, for every Module in the dependency closure, the repository, the requested ref, what it resolved to, and the commit. Local repository paths are stored relative to the lock. Once written, the lock is authoritative: the same lock checks out the same Module code on a feature branch, after its merge, and in CI.

The lock is written by `xrobot setup`, says so in its first line, and is not edited by hand. After a change to `modules.yaml`, `xrobot setup` updates the lock, and both are committed together.

| Command | Effect |
| --- | --- |
| `xrobot setup` | Keeps locked commits; added, removed or changed requests change only those entries |
| `xrobot setup --update MODULE...` | Re-resolves the named Modules |
| `xrobot setup --update` | Re-resolves every Module |
| `xrobot setup --frozen` | Restores exactly the lock; fails if `modules.yaml` no longer matches it or the installed XRobot differs from `xrobot:` |
| `xrobot setup --offline` | Uses only local checkouts and commits, without network access; needs `xrobot.lock`, and `modules.yaml` must match it |
| `xrobot setup --context-ref REF` | Sets the BSP context for `same` / `same-or-dev` |
| `xrobot setup --release-ref REF` | Refuses commits that are not released for the target line (see below) |
| `xrobot setup --leave-local MODULE...` | Moves the named Modules to their resolved commits (see below) |
| `xrobot setup --no-line-directives` | Leaves the `#line` directives out of the regenerated header |

`--update` cannot be combined with `--frozen` or `--offline`. It also runs `xrobot sync` on every configuration and prints the changes.

Modules are checked out at their locked commits (detached HEAD). A Module already at its locked commit keeps its uncommitted changes. When a Module has to move to another commit, `xrobot setup` stops with an explanation if the Module has uncommitted changes or its HEAD is a local commit that is on no remote branch or tag. While developing a Module inside a BSP, keep the changes uncommitted; when they are ready, push them to a branch of the Module and run `xrobot setup --update <Module>`.

`xrobot setup --leave-local <Module...>` moves the named Modules to the commits the lock resolves to: at an unpushed local commit, the commits are printed first, then the target commit is checked out, and the local commits stay on the original branch or are recoverable through `git reflog` when HEAD is detached. A named Module with uncommitted changes is still refused; with `-f`, what will be discarded is printed first, then the tracked modifications and untracked files of the named Modules that have to move are discarded (submodules included), and ignored files are kept. `-f` is used only with `--leave-local` and affects only the named Modules.

Setup also fails when two selected Modules define the same global Module class, when dependencies form a cycle, or when one Module resolves to different commits.

---

## Setup Steps

1. Compares the installed XRobot with `xrobot:`: a difference is a warning, and an error with `--frozen`; a commit in `xrobot:` is not compared;
2. resolves the Modules as described above, writes `xrobot.lock` and checks the Modules out into `Modules/<owner>/<Repo>/`;
3. writes `Modules/CMakeLists.txt`;
4. checks every configuration under `User/` (except `User/libxr_config.yaml`);
5. regenerates `User/xrobot_main.hpp` for the selected configuration (default `User/xrobot.yaml`).

Example output:

```text
$ xrobot setup
Resolved 1 Module commit
Checked 1 config; generated User/xrobot_main.hpp for User/xrobot.yaml
```

`Modules/<owner>/<Repo>/`, `Modules/CMakeLists.txt` and `User/xrobot_main.hpp` are not committed.

---

## Release Gate

BSPs and official Modules share one branch model: `dev` receives changes; `master` is the stable line and is updated only by pull requests from `dev`. `--release-ref` names the BSP's target:

| `--release-ref` | Every locked commit must be on |
| --- | --- |
| `refs/heads/dev` | the Module's `dev` |
| `refs/heads/master`, `refs/heads/main`, `refs/tags/...` | the Module's `master` (or `main`) |
| any other branch (such as `refs/heads/feature-x`) | not checked |

Explicitly requested tags count as released; a third-party Module without that line can only be pinned by an explicit commit. After a Module pull request is merged with a merge commit, the locked commit is on the target line and the BSP passes without refreshing the lock; after a squash or rebase merge or a history rewrite, the locked commit is no longer on the line, and the command printed by the gate refreshes it, such as `xrobot setup --update <Module> --context-ref refs/heads/dev`.

The same rule applies to the tools: `xrobot:` in `Modules/modules.yaml` must be present, and `generator:` in `User/libxr_config.yaml` is checked when it is written; a commit pin must be on the tool repository's matching line, and a release version passes.

Typical BSP CI steps:

```bash
xrobot format --check
xrobot setup --frozen --context-ref "$CONTEXT_REF" --release-ref "$TARGET_REF"
cmake -S . -B build
cmake --build build
```

`CONTEXT_REF` is the branch or tag being built; `TARGET_REF` is the pull request's base branch (for a push, the pushed branch or tag). An STM32 BSP does not need to write these steps: the shared workflow `bsp-stm32-ci.yml` contains them; see [BSP CI](./ci.md#bsp-ci).

---

## CMake Integration

The BSP sets `XROBOT_MODULES_DIR` to its `Modules` directory before adding LibXR (CMake 3.19 or newer is required):

```cmake
set(XROBOT_MODULES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/Modules)
add_subdirectory(Middlewares/Third_Party/LibXR)
```

In an STM32 project the code generator writes this line; see [Integrate with XRobot](../code_gen/xrobot_inter.md). LibXR then includes `Modules/CMakeLists.txt` and checks `User/xrobot_main.hpp`; see [Main Function Generation](./gen_main.md#build-check).
