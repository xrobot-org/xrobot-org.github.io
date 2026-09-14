---
id: ramfs
title: 内存文件系统
sidebar_position: 6
---

# RamFS 内存文件系统

`RamFS` 是 LibXR 提供的轻量级内存文件系统模块，支持统一管理文件、目录和自定义节点，适用于嵌入式系统中的文件访问与调试模拟。

---

## 主要功能

- 基于红黑树结构组织文件与目录；
- 支持只读 / 读写 / 可执行文件类型；
- 支持自定义节点（`Custom`），可由上层自行扩展节点语义；
- 文件系统支持递归查找文件、目录与自定义节点；
- 文件数据访问具备类型安全校验；
- 所有数据完全驻留内存，适合运行时构建与模拟。

---

## 核心结构

### FsNode

所有节点的基类，具有统一接口字段：

- `name`：节点名
- `type`：节点类型（FILE / DIR / CUSTOM）
- `parent`：所属目录

### File

通过 `CreateFile()` 创建，支持以下三类：

- 只读（READ_ONLY）
- 读写（READ_WRITE）
- 可执行文件（EXEC）：具备 `Run(argc, argv)` 方法

### Dir

目录类支持添加 / 查找：

- 添加：`Add(file)`、`Add(dir)`、`Add(custom)`
- 查找：`FindFile(name)`、`FindDir(name)`、`FindCustom(name)`，均支持 `Rev` 递归版

### Custom

`Custom` 节点用于挂接用户自定义元数据或扩展语义。当前 `RamFS` 只负责命名、挂接和查找，不替自定义节点定义额外 I/O 约束。

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

### File 接口

| 方法 | 功能 |
|------|------|
| `Run(argc, argv)` | 运行可执行文件（仅 EXEC 类型） |
| `Data<T>()` | 获取类型安全数据引用 |

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

---

## 应用场景

- 嵌入式平台中模拟文件系统；
- 调试模式下的虚拟文件访问；
- 使用内存构建临时配置、日志、参数节点；
- 挂接用户自定义节点与调试元数据；

---

## 单元测试参考

详见 [`test_ramfs.cpp`]，覆盖：

- 可执行文件运行
- 类型安全数据访问
- 文件、目录、自定义节点的添加与查找
