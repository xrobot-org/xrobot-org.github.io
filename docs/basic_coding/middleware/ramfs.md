---
id: ramfs
title: 内存文件系统
sidebar_position: 6
---

# RamFS 内存文件系统

`RamFS` 是 LibXR 的内存文件系统，用目录树组织文件、可执行文件、目录和自定义节点，`Terminal` 通过它查找并运行命令。

---

## 主要功能

- 基于红黑树结构组织文件与目录；
- 文件分为只读、可读写和可执行三种，由 `CreateFile()` 的参数决定；
- 支持自定义节点（`Custom`），可由上层自行扩展节点语义；
- 文件系统支持递归查找文件、目录与自定义节点；
- `Data<T>()` 在 Debug 构建下检查文件大小不小于 `sizeof(T)`，对非读写文件请求可写访问时终止；
- 文件只保存调用方对象的地址，数据和对象生命周期由调用方负责。

---

## 核心结构

### FsNode

所有节点的基类，提供：

- `GetName()`：节点名
- `GetNodeType()`：节点类型（`FsNodeType::FILE` / `DIR` / `CUSTOM`）

### File

通过 `CreateFile()` 创建：

- `CreateFile(name, data)`：`data` 为 `const` 对象时创建只读文件，否则创建可读写文件；
- `CreateFile(name, exec, arg)` 或 `CreateCommand(name, exec, arg)`：创建可执行文件，`Run(argc, argv)` 调用 `exec(arg, argc, argv)`。

`IsReadOnly()`、`IsReadWrite()`、`IsExecutable()` 返回文件种类。

### Dir

目录类支持添加 / 查找：

- 添加：`Add(file)`、`Add(dir)`、`Add(custom)`
- 查找：`FindNode(name)`、`FindFile(name)`、`FindDir(name)`、`FindCustom(name)`，后三者有递归版本 `...Rev`，`FindDir` 支持 `.` 和 `..`
- 遍历：`Foreach(func)` 遍历直属子节点

### Custom

`Custom` 节点用于挂接用户自定义元数据或扩展语义，构造为 `Custom(name, kind = 0, context = nullptr)`，`kind_` 和 `context_` 由用户解释；`RamFS` 只负责命名、挂接和查找。

---

## 使用示例

```cpp
RamFS fs;

int counter = 0;

// 创建可执行文件（每次调用将计数器 +1）
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

// 创建读写文件
auto data_file = RamFS::CreateFile("value", counter);

// 创建目录和自定义节点
auto dir = RamFS::CreateDir("mydir");
auto custom = RamFS::Custom("mycustom");

// 构建文件系统结构
fs.Add(data_file);  // 添加到根目录
fs.Add(dir);
dir.Add(exec_file);
dir.Add(custom);

// 多次运行 exec 文件，修改计数值
for (int i = 1; i <= 5; ++i) {
  exec_file.Run(0, nullptr);
  ASSERT(data_file.Data<int>() == i);
}
```

---

## 接口一览

### RamFS 文件系统接口

| 方法 | 功能 |
|------|------|
| `CreateFile(name, data)` | 创建只读或读写文件 |
| `CreateFile(name, exec, arg)` | 创建可执行文件 |
| `CreateDir(name)` | 创建目录 |
| `Add(file/dir/custom)` | 添加节点到根目录 |
| `FindFile(name)` | 在整个文件系统中查找文件（递归） |
| `FindDir(name)` | 查找目录 |
| `FindCustom(name)` | 查找自定义节点 |
| `CreateCommand(name, exec, arg)` | 创建可执行文件，与 `CreateFile(name, exec, arg)` 相同 |
| `bin_` | 构造时创建并挂在根目录下的 `bin` 目录 |

### File 接口

| 方法 | 功能 |
|------|------|
| `Run(argc, argv)` | 运行可执行文件 |
| `Data<T>()` | 返回可写引用，只用于读写文件 |
| `Data<const T>()` | 返回只读引用，用于只读和读写文件 |
| `Data()` | 返回原始数据视图（非 const 对象要求读写文件） |
| `IsReadOnly()` / `IsReadWrite()` / `IsExecutable()` | 查询文件种类 |

### Dir 接口

| 方法 | 功能 |
|------|------|
| `Add(node)` | 添加文件、目录或自定义节点 |
| `FindFile(name)` | 查找文件（当前目录） |
| `FindFileRev(name)` | 递归查找文件 |
| `FindDir(name)` | 查找子目录 |
| `FindDirRev(name)` | 递归查找目录 |
| `FindCustom(name)` | 查找自定义节点 |
| `FindCustomRev(name)` | 递归查找自定义节点 |
| `FindNode(name)` | 查找直属子节点 |
| `Foreach(func)` | 遍历直属子节点 |

---

## 应用场景

- 嵌入式平台中模拟文件系统；
- 调试模式下的虚拟文件访问；
- 使用内存构建临时配置、日志、参数节点；
- 挂接用户自定义节点与调试元数据；

---

## 单元测试参考

测试见 LibXR 仓库的 [`test/automatic/middleware/ramfs/ramfs/test_ramfs.cpp`](https://github.com/xrobot-org/libxr/blob/master/test/automatic/middleware/ramfs/ramfs/test_ramfs.cpp)，覆盖：

- 文件数据引用与只读属性
- 命令执行
- 节点查找、父目录关系和直属子节点遍历
