---
id: con-guide-how2con
title: How to Contribute
sidebar_position: 1
---

# How to Contribute

Most contributions go through `Issue` and `Pull Request`. Local fixes, doc corrections, and example updates can usually go straight to a `PR`.

## Repositories

An `Issue` or `PR` goes to the repository the problem belongs to:

| Problem area | Repository |
| --- | --- |
| LibXR C++ library | [xrobot-org/libxr](https://github.com/xrobot-org/libxr) |
| XRobot (the `xrobot` command) and the shared CI workflows | [xrobot-org/XRobot](https://github.com/xrobot-org/XRobot) |
| CodeGenerator (pip package `libxr`) | [xrobot-org/LibXR_CppCodeGenerator](https://github.com/xrobot-org/LibXR_CppCodeGenerator) |
| xr-syntax (C++ source parsing) | [xrobot-org/xr-syntax](https://github.com/xrobot-org/xr-syntax) |
| VS Code extension | [xrobot-org/xrobot-vscode-extension](https://github.com/xrobot-org/xrobot-vscode-extension) |
| A Module | that Module's repository, for example [xrobot-org/BMI088](https://github.com/xrobot-org/BMI088) |
| Module listing in the official Source | [xrobot-org/xrobot-modules](https://github.com/xrobot-org/xrobot-modules) |
| A BSP | that BSP's repository |
| This documentation website | [xrobot-org/xrobot-org.github.io](https://github.com/xrobot-org/xrobot-org.github.io) |
| Docker images | [xrobot-org/Docker-Image](https://github.com/xrobot-org/Docker-Image) |

## `Issue`

An `Issue` should at least include:

- the observed problem or target
- the affected scope
- reproduction conditions or usage scenario
- the expected result

Bug reports should not stop at “there is a bug here”. Refactor requests should not stop at “I want to change this”. Reviewers need enough information to judge whether the change is local, semantic, or structural.

## `Pull Request`

A `PR` should stay on one topic. The description can be kept to four parts:

- what changed
- why it changed
- how it was verified
- what is still unverified

Small fixes do not need a long write-up, but they also should not be just a title.

```text
## What
- fix uart BLOCK timeout wakeup path

## Why
- late completion may post an expired waiter

## Verify
- build linux test
- run related regression

## Not Verified
- no board-side verification on CH32
```

## Discussion Boundary

The following changes start with an `Issue` for discussion before any work:

- public interface changes
- semantic changes to existing behavior
- cross-platform public-layer changes
- driver hot-path rewrites
- large refactors

## Verification

Before a `PR` is submitted, the checks of the repository's CI are run locally. A `PR` is merged only after all CI checks pass. Driver, concurrency, and performance changes describe their verification as stated in [Change Boundaries](./change_boundary.md); unverified parts are stated in the `PR` description. The checks of each repository follow; all commands run from the repository root.

### LibXR

CI builds and runs the automatic tests on Linux in Debug and Release configurations, then checks the formatting of C++ and CMake files. The format scripts need clang-format 21.1.8 and cmakelang[YAML] 0.6.13. Build dependencies and build options are in the repository's [test/README.md](https://github.com/xrobot-org/libxr/blob/master/test/README.md); the format rules are in [Code Style](./coding_style.md#clang-format).

```bash
cmake -S . -B build -DLIBXR_TEST_BUILD=ON -DLIBXR_DEV_ASSERT_BUILD=ON -DCMAKE_BUILD_TYPE=Debug
cmake --build build --parallel 8
ctest --test-dir build --output-on-failure --no-tests=error
tools/format_cpp_files.sh --check
tools/format_cmake_files.sh --check
```

### XRobot and LibXR_CppCodeGenerator

CI checks formatting and code with ruff 0.16.9, then installs the repository's package and runs the unit tests; the format tests of the generated code use clang-format 21.1.8. The XRobot tests also compile the generated C++ code with the compiler named by the `CXX` environment variable; CI uses both g++ and clang++.

XRobot:

```bash
python -m pip install ruff==0.16.9
ruff format --check src tests tools
ruff check src tests tools
python -m pip install . clang-format==21.1.8
python -m unittest discover -s tests -v
```

In LibXR_CppCodeGenerator, ruff checks `src`, `tests` and `scripts`:

```bash
python -m pip install ruff==0.16.9
ruff format --check src tests scripts
ruff check src tests scripts
python -m pip install . clang-format==21.1.8
python -m unittest discover -s tests -v
```

The LibXR_CppCodeGenerator CI also compiles the generated code of the STM32 test projects and runs `libxr stm32 setup` on `bsp_stm32f103`.

### xr-syntax

CI runs pytest, checks the bilingual docstrings, then checks formatting and code with ruff and types with mypy:

```bash
python -m pip install -e ".[dev]"
python -m pytest
python tools/check_bilingual_docs.py
python -m ruff format --check src tests tools
python -m ruff check src tests tools
python -m mypy src
```

### VS Code Extension

CI compiles, lints and tests the extension with Node.js 22 on Linux and Windows, then packages the `.vsix`:

```bash
npm ci
npm run compile
npm run lint
npm test
```

### Modules

The CI of a Module repository calls the shared workflow `module-ci.yml` from the XRobot repository. In a Linux container it resolves the Module's dependencies and compiles the Module's sources and the constructor call written by `xrobot check-module` against LibXR; see [CI and Firmware Release](../proj_man/ci.md#module-ci).

### BSPs

The CI of an STM32 BSP calls the shared workflow `bsp-stm32-ci.yml`: it regenerates `User/app_main.cpp` and the other generated files and compares them with the committed versions, checks that text files are stored with LF, runs `xrobot format --check` and `xrobot setup --frozen`, and builds every configuration; see [CI and Firmware Release](../proj_man/ci.md#bsp-ci). Other BSPs run the workflows in their own `.github/workflows/`. The commands to run before submitting a change to an STM32 BSP:

```bash
xrobot format --check
xrobot setup --frozen
```

### Documentation Website

CI installs the dependencies and builds the site with Node.js 20:

```bash
npm ci
npm run build
```

Doc changes are also checked in a local preview for pages, sidebar and links; the root `README.md` of the repository describes the preview.
