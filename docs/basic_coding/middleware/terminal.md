---
id: terminal
title: 命令行终端
sidebar_position: 7
---

# Terminal 命令行终端

`LibXR::Terminal` 是基于 `RamFS` 的命令行终端，提供 ANSI 行编辑、历史记录、路径补全和命令解析，可在线程或定时任务中运行。

## 功能概览

- 按路径查找并运行 `RamFS` 中的可执行文件；
- 支持命令历史与上下翻阅；
- Tab 补全第一个参数中的目录名和文件名；
- 按空格切分参数，参数个数上限为 `MAX_ARG_NUMBER`（含命令本身），超出部分被丢弃；内建命令只有 `cd` 和 `ls`；
- ANSI 控制字符兼容（支持方向键移动、光标控制）；
- 可绑定自定义输入输出端口，兼容串口 / Pipe / TCP / 标准输入输出；
- 提供线程驱动 (`ThreadFun`) 和任务驱动 (`TaskFun`) 两种运行模式。

## 类模板定义

```cpp
template <size_t READ_BUFF_SIZE = 32,
          size_t MAX_LINE_SIZE = READ_BUFF_SIZE,
          size_t MAX_ARG_NUMBER = 5,
          size_t MAX_HISTORY_NUMBER = 5>
class Terminal;
```

- `READ_BUFF_SIZE`：每次从读端口取出的最大字节数；
- `MAX_LINE_SIZE`：一行最多容纳的字符数，默认等于 `READ_BUFF_SIZE`，超出的字符不加入输入行，也不回显；
- `MAX_ARG_NUMBER`：一行最多解析的参数个数（含命令本身）；
- `MAX_HISTORY_NUMBER`：保存的历史命令条数。

命令行可能超过 32 个字符时，增大模板参数，例如 `LibXR::Terminal<64>`，读缓冲区和行长度都为 64。

## 构造函数

```cpp
Terminal(RamFS &ramfs,
         RamFS::Dir *current_dir = nullptr,
         ReadPort *read_port = STDIO::read_,
         WritePort *write_port = STDIO::write_,
         Mode mode = Mode::CRLF);
```

- `ramfs`: 所使用的文件系统实例；
- `current_dir`: 当前默认目录，默认使用根目录；
- `read_port`, `write_port`: 输入输出端口，默认为 `STDIO::read_` / `STDIO::write_`，构造前须已设置（Linux 上由 `PlatformInit()` 设置），也可传入串口等其他端口；
- `mode`: 行结束模式（CRLF、LF、CR）。

下面两个示例使用默认的 STDIO 端口。Linux 上这两个端口由 `LibXR::PlatformInit()` 创建，因此先调用它，再构造 `Terminal`。

## 使用示例（线程模式）

```cpp
  LibXR::PlatformInit();  // Linux：创建 STDIO 端口
  static LibXR::RamFS ramfs;
  static LibXR::Terminal<> terminal(ramfs);
  LibXR::Thread term_thread;
  term_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                     LibXR::Thread::Priority::MEDIUM);
```

## 使用示例（任务模式）

```cpp
  LibXR::PlatformInit();  // Linux：创建 STDIO 端口
  static LibXR::RamFS ramfs;
  static LibXR::Terminal<> terminal(ramfs);
  auto terminal_task = LibXR::Timer::CreateTask(terminal.TaskFun, &terminal, 10);
  LibXR::Timer::Add(terminal_task);
  LibXR::Timer::Start(terminal_task);
```

## 命令执行与自动补全

- 命令输入被缓存在 `input_line_` 中，按回车自动解析并执行；
- 内建命令只有 `cd` 和 `ls`；`ls` 每行输出类型字母和名称：`d` 目录、`x` 可执行文件、`f` 普通文件、`?` 自定义节点；
- 其他输入把第一个参数当作 RamFS 文件路径：不含 `/` 时只在当前目录查找，以 `/` 开头时从根目录解析；找到可执行文件则运行，找不到时输出 `Command not found.`，不是可执行文件时输出 `Not an executable file.`；
- 命令通常用 `CreateCommand()` 创建后加入 `ramfs.bin_`，在根目录下以 `/bin/<name>` 调用，或先 `cd bin`；
- 支持 ANSI 上下左右键移动与历史记录查阅；
- Tab 键补全第一个参数的路径。

## 运行原理

- 通过 ReadPort 接收数据流，并依序解析 ANSI 控制字符与输入字符；
- 通过 WritePort 输出命令行提示、回显字符、反馈信息；
- `ThreadFun` 以 `BLOCK` 方式读取端口，循环处理输入，不返回，在独立线程中运行；
- `TaskFun` 以轮询方式读取端口，每次调用处理已经到达的输入后返回，由 Timer 周期调用。

## 接口摘要

- `HandleCharacter(char)`: 处理字符输入；
- `Parse(RawData&)`: 解析输入数据；
- `ShowHeader()`, `Clear()`, `ClearLine()`: 控制显示；
- `AddCharToInputLine`, `DeleteChar`: 行编辑支持；
- `ExecuteCommand()`: 命令执行；
- `ThreadFun()`, `TaskFun()`: 驱动函数。

---

终端可通过串口、TCP 等任意 `ReadPort` / `WritePort` 使用。
