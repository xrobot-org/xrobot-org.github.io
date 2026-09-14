---
id: proj-man-init-mod
title: Initialize Module Repositories
sidebar_position: 1
---

# Initialize Module Repositories

`xrobot_init_mod` fetches and synchronizes the module repositories required by a project. It supports both local and remote configuration files, and recursively resolves dependencies so the dependency tree and version constraints stay consistent.

---

## Basic Usage

### 1. First Run (Auto-generate Config Template)

If no config file exists yet, such as `Modules/modules.yaml`, the first run creates a template:

```bash
$ xrobot_init_mod
[WARN] Configuration file not found, creating template: Modules/modules.yaml
[INFO] Please edit the configuration file and rerun this script.
```

Fill in the module list, for example:

```yaml
modules:
  - xrobot-org/BlinkLED
  - xrobot-org/MySensor@master
```

Run it again and the repositories will be fetched automatically:

```bash
$ xrobot_init_mod
[INFO] Cloning new module: BlinkLED
[INFO] Cloning new module: MySensor
[SUCCESS] All modules and their dependencies processed.
```

---

### 2. Specify Local Config File

Use `--config` to point to a local configuration file:

```bash
$ xrobot_init_mod --config Modules/modules.yaml
[INFO] Updating module: BlinkLED
[SUCCESS] All modules and their dependencies processed.
```

---

### 3. Specify Remote Config File

A remote configuration file, such as a GitHub raw URL, can also be passed directly:

```bash
$ xrobot_init_mod --config https://raw.githubusercontent.com/<user>/<repo>/<branch>/modules.yaml
[INFO] Cloning new module: BlinkLED
[SUCCESS] All modules and their dependencies processed.
```

---

### 4. Custom Repository Sources (Optional)

XRobot supports multiple sources and mirrors through `sources.yaml`.
Use `--sources` to point to a custom sources file:

```bash
$ xrobot_init_mod --config Modules/modules.yaml --sources Modules/sources.yaml
```

A typical `sources.yaml` example:

```yaml
sources:
- url: https://xrobot.work/xrobot-modules/index.yaml
  priority: 0
...
```

---

## Recursive Dependency Resolution & Version Consistency

- The tool will **recursively parse all dependent modules** (dependencies are defined in the MANIFEST block of each module header) to ensure a complete and consistent dependency tree.
- If different modules require different versions of the same dependency, the tool will **report a conflict** for you to manually resolve.

---

## CMake Integration

All fetched modules are stored under the `Modules/` directory.  
You need to set the XROBOT_MODULES_DIR variable so that LibXR can automatically discover and load the modules.

```cmake
# Add XRobot Modules
set(XROBOT_MODULES_DIR "${CMAKE_CURRENT_SOURCE_DIR}/Modules")
```

Don't forget to include LibXR too!

```cmake
# A simple example
project(xrobot_mod_test CXX)
set(CMAKE_CXX_STANDARD 20)
add_executable(xr_test main.cpp)

# Set before add_subdirectory
set(XROBOT_MODULES_DIR ${CMAKE_CURRENT_SOURCE_DIR}/Modules/)
add_subdirectory(libxr)

target_include_directories(xr_test PUBLIC 
    $<TARGET_PROPERTY:xr,INTERFACE_INCLUDE_DIRECTORIES> 
    ${CMAKE_SOURCE_DIR}/User
)

target_link_libraries(xr_test PUBLIC xr)
```
