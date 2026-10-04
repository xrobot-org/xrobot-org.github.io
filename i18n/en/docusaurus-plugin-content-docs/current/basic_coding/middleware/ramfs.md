---
id: ramfs
title: In-Memory File System
sidebar_position: 6
---

# RamFS In-Memory File System

`RamFS` is the LibXR in-memory file system. It organizes files, executable files, directories, and custom nodes in a directory tree, and `Terminal` uses it to find and run commands.

---

## Main Features

- Organized using a red-black tree structure for files and directories;
- Files are read-only, read-write, or executable, depending on the `CreateFile()` arguments;
- Supports custom nodes (`Custom`) for user-defined metadata or extension points;
- Supports recursive search of files, directories, and custom nodes;
- `Data<T>()` checks in Debug builds that the file size is at least `sizeof(T)`, and stops when write access is requested on a file that is not read-write;
- A file stores only the address of the caller's object; the caller owns the data and its lifetime.

---

## Core Structures

### FsNode

The base class for all nodes, providing:

- `GetName()`: node name
- `GetNodeType()`: node type (`FsNodeType::FILE` / `DIR` / `CUSTOM`)

### File

Created with `CreateFile()`:

- `CreateFile(name, data)`: creates a read-only file when `data` is a `const` object, otherwise a read-write file;
- `CreateFile(name, exec, arg)` or `CreateCommand(name, exec, arg)`: creates an executable file; `Run(argc, argv)` calls `exec(arg, argc, argv)`.

`IsReadOnly()`, `IsReadWrite()`, and `IsExecutable()` report the file kind.

### Dir

Directory class supports adding and finding:

- Add: `Add(file)`, `Add(dir)`, `Add(custom)`
- Find: `FindNode(name)`, `FindFile(name)`, `FindDir(name)`, `FindCustom(name)`; the last three have recursive `...Rev` variants, and `FindDir` accepts `.` and `..`
- Iterate: `Foreach(func)` visits direct children

### Custom

`Custom` nodes attach user-defined metadata or extensions. The constructor is `Custom(name, kind = 0, context = nullptr)`; `kind_` and `context_` are interpreted by the user, and `RamFS` handles naming, attachment, and lookup.

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
| `CreateCommand(name, exec, arg)` | Create an executable file, same as `CreateFile(name, exec, arg)` |
| `bin_` | The `bin` directory created under the root at construction |

### File Interface

| Method | Description |
|--------|-------------|
| `Run(argc, argv)` | Run executable file |
| `Data<T>()` | Writable reference, read-write files only |
| `Data<const T>()` | Read-only reference, read-only and read-write files |
| `Data()` | Raw data view (a non-const object requires a read-write file) |
| `IsReadOnly()` / `IsReadWrite()` / `IsExecutable()` | Query the file kind |

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
| `FindNode(name)` | Find a direct child node |
| `Foreach(func)` | Visit direct child nodes |

---

## Application Scenarios

- Simulate file systems in embedded platforms;
- Virtual file access in debug mode;
- Build temporary config, log, or parameter nodes in memory;
- Attach user-defined nodes and debug metadata;

---

## Unit Test Reference

Tests are in [`test/automatic/middleware/ramfs/ramfs/test_ramfs.cpp`](https://github.com/xrobot-org/libxr/blob/master/test/automatic/middleware/ramfs/ramfs/test_ramfs.cpp) and cover:

- file data references and read-only data
- command execution
- node lookup, parent links, and direct-child traversal
