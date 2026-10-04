---
id: ramfs
title: In-Memory File System
sidebar_position: 6
---

# RamFS In-Memory File System

`RamFS` is a lightweight in-memory file system module provided by LibXR. It supports unified management of files, directories, and custom nodes, and is suitable for file access and debugging simulations in embedded systems.

---

## Main Features

- Organized using a red-black tree structure for files and directories;
- Supports read-only, read-write, and executable file types;
- Supports custom nodes (`Custom`) for user-defined metadata or extension points;
- Supports recursive search of files, directories, and custom nodes;
- Type-safe data access for all files;
- All data resides entirely in memory, ideal for runtime construction and simulation.

---

## Core Structures

### FsNode

The base class for all nodes, with a unified interface:

- `name`: node name
- `type`: node type (FILE / DIR / CUSTOM)
- `parent`: parent directory

### File

Created using `CreateFile()`, supporting:

- Read-only (`READ_ONLY`)
- Read-write (`READ_WRITE`)
- Executable (`EXEC`): has a `Run(argc, argv)` method

### Dir

Directory class supports adding and finding:

- Add: `Add(file)`, `Add(dir)`, `Add(custom)`
- Find: `FindFile(name)`, `FindDir(name)`, `FindCustom(name)`, and their recursive variants with `Rev`

### Custom

`Custom` nodes are used to attach user-defined metadata or extension semantics. Current `RamFS` is responsible only for naming, attachment, and lookup; it does not impose extra I/O behavior on custom nodes.

---

## Usage Example

```cpp
RamFS fs;

int counter = 0;

// Create executable file (increments counter each time it's run)
auto exec_file = RamFS::CreateFile<int*>(
  "runme",
  [](int* arg, int argc, char** argv) {
    UNUSED(argc);
    UNUSED(argv);
    (*arg)++;
    return 0;
  },
  &counter
);

// Create read/write file
auto data_file = RamFS::CreateFile("value", counter);

// Create directory and custom node
auto dir = RamFS::CreateDir("mydir");
auto custom = RamFS::Custom("mycustom");

// Build file system structure
fs.Add(data_file);  // Add to root directory
fs.Add(dir);
dir.Add(exec_file);
dir.Add(custom);

// Run exec file multiple times and verify count
for (int i = 1; i <= 5; ++i) {
  exec_file.Run(0, nullptr);
  ASSERT(data_file.Data<int>() == i);
}
```

---

## Interface Overview

### RamFS File System Interface

| Method | Description |
|--------|-------------|
| `CreateFile(name, data)` | Create a read-only or read-write file |
| `CreateFile(name, exec, arg)` | Create an executable file |
| `CreateDir(name)` | Create a directory |
| `Add(file/dir/custom)` | Add node to root directory |
| `FindFile(name)` | Recursively search for a file |
| `FindDir(name)` | Search for a directory |
| `FindCustom(name)` | Search for a custom node |

### File Interface

| Method | Description |
|--------|-------------|
| `Run(argc, argv)` | Run executable file (only for EXEC type) |
| `Data<T>()` | Get a type-safe reference to file data |

### Dir Interface

| Method | Description |
|--------|-------------|
| `Add(node)` | Add a file, directory, or custom node |
| `FindFile(name)` | Find file in current directory |
| `FindFileRev(name)` | Recursively find file |
| `FindDir(name)` | Find subdirectory |
| `FindDirRev(name)` | Recursively find directory |
| `FindCustom(name)` | Find custom node |
| `FindCustomRev(name)` | Recursively find custom node |

---

## Application Scenarios

- Simulate file systems in embedded platforms;
- Virtual file access in debug mode;
- Build temporary config, log, or parameter nodes in memory;
- Attach user-defined nodes and debug metadata;

---

## Unit Test Reference

See [`test_ramfs.cpp`] for coverage of:

- Executable file execution
- Type-safe data access
- Adding and finding files, directories, and custom nodes
