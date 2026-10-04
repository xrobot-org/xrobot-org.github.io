---
id: proj-man-ci
title: CI and Firmware Release
sidebar_position: 6
---

# CI and Firmware Release

The CI of Module repositories and STM32 BSPs calls shared workflows of the XRobot repository: Modules use `module-ci.yml`, STM32 BSPs use `bsp-stm32-ci.yml`, which also uploads the firmware when a `v*` tag is pushed or a Release is published.

---

## Module CI

Module repositories call the shared workflow `xrobot-org/XRobot/.github/workflows/module-ci.yml`. The `.github/workflows/build.yml` of official Modules on their `dev` line:

```yaml
name: Module CI
on:
  push:
  pull_request:
  workflow_dispatch:
jobs:
  build:
    uses: xrobot-org/XRobot/.github/workflows/module-ci.yml@dev
    with:
      xrobot-ref: dev
      libxr-ref: dev
      dependency-ref: refs/heads/dev
      template-args: '[]'
```

In a Linux container the workflow resolves the Module's dependencies, runs `xrobot check-module` to write one constructor call, and compiles the Module sources and that call against LibXR. Dependencies are `void*` placeholders; the call is compiled, not run. For a `standalone: false` library, only its headers and sources are compiled.

`xrobot check-module` resolves Modules as `xrobot setup` does and updates `xrobot.lock` and `Modules/`; `-o FILE` names the output file (default `module_check.cpp`), `--template-arg` gives one template argument of a class template (once per argument), and `--offline` uses only the Modules already in `Modules/`.

| Input | Default | Meaning |
| --- | --- | --- |
| `xrobot-ref` | `master` | XRobot version used |
| `libxr-ref` | `master` | LibXR version used |
| `dependency-ref` | `refs/heads/master` | Context for `same-or-dev` dependencies |
| `template-args` | `'[]'` | Template arguments for a class template (JSON list) |
| `sources` | empty | Further index URLs, one per line; the official indexes win when both list a package |
| `image` | `ghcr.io/xrobot-org/docker-image-linux:main` | Build container |
| `apt-packages` | empty | Extra Debian packages |
| `cmake-options` | empty | Extra CMake configure options |
| `ctest-regex` | empty | When set, build tests and run the matching CTest tests |
| `ctest-timeout` | `15` | Per-test CTest timeout in seconds |

---

## BSP CI

The CI of an STM32 BSP calls the shared workflow `xrobot-org/XRobot/.github/workflows/bsp-stm32-ci.yml`, and the BSP only names its project and the configurations to build:

```yaml
name: build
on:
  push: {branches: [master, dev], tags: ['v*']}
  pull_request: {branches: [master, dev]}
  release: {types: [published]}
  workflow_dispatch:
jobs:
  build:
    permissions: {contents: write}   # attach the firmware to releases
    uses: xrobot-org/XRobot/.github/workflows/bsp-stm32-ci.yml@v1
    with:
      project: DevC
      configs: |
        default
        debug
        full
```

The check job and the build jobs install the tools at the versions pinned by `xrobot:` in `Modules/modules.yaml` and `generator:` in `User/libxr_config.yaml`. The check job runs steps 1 to 4; the build jobs (step 5) run in parallel with it; the release job (step 6) runs after the check job and every build job have succeeded:

1. regenerates the BSP objects (`libxr parse`, `libxr gen`) and checks that `User/app_main.cpp`, `User/app_main.h`, `User/flash_map.hpp` and `User/libxr_config.yaml` match the commit;
2. checks that no text file is stored with CRLF in the repository (`i/crlf` in `git ls-files --eol`), and otherwise fails with the fix `git add --renormalize .`; see the `.gitattributes` that [`xrobot init`](./README.md#bsp-layout) writes;
3. checks the layout of the configurations with `xrobot format --check`;
4. checks out the locked Modules and checks every configuration with `xrobot setup --frozen`;
5. configures and builds every configuration; the builds to publish (see [Publishing Firmware](#publishing-firmware)) package the firmware (`.elf`, `.hex`, `.bin`, the configuration and a `build-info.json` with the build information) and upload it as a build artifact;
6. for a `v*` tag or a published Release, one job downloads all build artifacts, writes the release files, the checksums, the manifest and the description, and uploads them to the Release once.

| Input | Default | Meaning |
| --- | --- | --- |
| `project` | required | CMake project name; the firmware is `build/<project>.elf` |
| `configs` | `default` | Configurations to build, one per line; `default` is `User/xrobot.yaml`, and any other name is `<config-dir>/<name>.yaml` |
| `config-dir` | `User/RobotConfig` | Folder of the configurations |
| `toolchain` | `cmake/starm-clang.cmake` | CMake toolchain file |
| `build-type` | `Release` | CMake build type; empty leaves it unset |
| `presets` | empty | CMake presets, one per line, for a BSP with several images (such as the app and the bootloader of OpenCR): each needs a configure preset and a build preset of the same name, and the workflow runs `cmake --preset` and `cmake --build --preset` without `toolchain` and `build-type`; every preset is built once per entry of `configs` |
| `release-configs` | empty | Configurations published on a release, one per line, each of which must be in `configs`; empty follows the default rules of [Publishing Firmware](#publishing-firmware) |
| `image` | `ghcr.io/xrobot-org/docker-image-stm32:main` | Build container |

The workflow sets `XR_CONTEXT_REF` and `XR_RELEASE_REF` (the `--context-ref` and `--release-ref` of `xrobot setup`) from the triggering event; a BSP does not write them.

### Publishing Firmware

A `v*` tag or a published Release makes the workflow upload the firmware. These rules choose the configurations to publish:

- when `configs` has only `default`, `default` is published;
- otherwise every configuration except `default` is published;
- when `release-configs` is given, the configurations it lists are published, and `default` may be one of them.

With `presets`, every published configuration is published with the image of every preset.

The published files are listed below. `<tag>` is the tag name (such as `v1.2.0`), with the characters a file name cannot hold replaced by `-`:

| File | Content |
| --- | --- |
| `<project>-<config>[-<preset>]-<tag>.elf`, `.hex`, `.bin` | The firmware of every build |
| `<project>-<config>-<tag>.yaml` | The configuration file of this configuration: `User/xrobot.yaml` for `default`, `<config-dir>/<name>.yaml` for any other |
| `<project>-<config>-<tag>.tar.gz` | All files of this configuration, in the folder `<project>-<config>-<tag>/` inside the archive |
| `SHA256SUMS` | The SHA-256 of every file above, to be checked with `sha256sum -c SHA256SUMS` |
| `firmware-manifest.json` | The build manifest |

The configuration and the preset are joined with `-` into the build name (`<config>-<preset>`), and build names must differ: `a-b` with `c` and `a` with `b-c` give the same name, which makes the workflow fail in the planning job.

Each build uploads its files as a build artifact. One job then downloads all build artifacts, writes the files above and uploads them once, so `SHA256SUMS` covers every file of the release. The job fails when a build artifact is missing or when the builds differ in commit or tool versions.

`firmware-manifest.json` records the tag, the commit, the BSP repository, the project, the build type, the toolchain file and the image; the installed and the pinned versions of xrobot and libxr; the commit of the LibXR submodule; the commit of every Module in `xrobot.lock`; and, for every build, the configuration, the preset, the file names and the text, data and bss sizes reported by `arm-none-eabi-size`. With `presets`, the presets choose the build type and the toolchain, and the manifest holds `null` for them. An example manifest of a BSP that builds only `default`:

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

A tag push makes the workflow create the Release, with the size table of the builds and the tool versions as its description:

```markdown
## CtrBoard-H7_ALL v1.0.0

| Config | Preset | text | data | bss | Archive |
| --- | --- | ---: | ---: | ---: | --- |
| `default` | - | 137384 | 84 | 117172 | `CtrBoard-H7_ALL-default-v1.0.0.tar.gz` |

- Commit `ad662b2` of QDU-Robomaster/bsp-dev-mc02
- XRobot 1.0.0, libxr 6.0.0, LibXR `6c51bf4`
- Image `ghcr.io/xrobot-org/docker-image-stm32:main`, toolchain `cmake/starm-clang.cmake`, build type `Debug`
- `SHA256SUMS` lists every file of this release; `firmware-manifest.json` records the builds and the Module commits
```

A Release that already has a description keeps it (creating a Release in the web page also pushes the tag). For a published Release the workflow only attaches the files and leaves the description as it is. The calling job needs `permissions: contents: write` so that the workflow can create the Release and upload the files.
