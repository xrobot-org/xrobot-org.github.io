---
id: terminal
title: 命令行终端
sidebar_position: 7
---

# Terminal 命令行终端

`LibXR::Terminal` 是一个支持 ANSI 控制、路径补全、命令解析与 RamFS 集成的嵌入式命令行终端组件，提供类 Unix 命令风格交互体验。支持运行模式灵活，可运行于线程或定时任务中，适用于多种嵌入式平台。

## 功能概览

- 与 `RamFS` 文件系统无缝集成，可解析并运行可执行文件；
- 支持命令历史与上下翻阅；
- 支持命令补全（Tab 补全目录与文件名）；
- 支持参数解析、目录切换（cd）、列目录（ls）等内置命令；
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
- `read_port`, `write_port`: 输入输出端口，可为串口、标准流等；
- `mode`: 行结束模式（CRLF、LF、CR）。

## 使用示例（线程模式）

```cpp
  LibXR::RamFS ramfs;
  LibXR::Terminal<> terminal(ramfs);
  LibXR::Thread term_thread;
  term_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                     LibXR::Thread::Priority::MEDIUM);
```

## 使用示例（任务模式）

```cpp
  static LibXR::RamFS ramfs;
  static LibXR::Terminal<> terminal(ramfs);
  auto terminal_task = Timer::CreateTask(terminal.TaskFun, &terminal, 10);
  Timer::Add(terminal_task);
  Timer::Start(terminal_task);
```

## 命令执行与自动补全

- 命令输入被缓存在 `input_line_` 中，按回车自动解析并执行；
- 使用 `ls`, `cd` 为内建命令；
- 若输入命令匹配到 RamFS 中的可执行文件（`FileType::EXEC`），则自动运行；
- 支持 ANSI 上下左右键移动与历史记录查阅；
- 输入 Tab 键进行路径自动补全。

## 运行原理

- 通过 ReadPort 接收数据流，并依序解析 ANSI 控制字符与输入字符；
- 通过 WritePort 输出命令行提示、回显字符、反馈信息；
- 提供循环线程函数 `ThreadFun` 与任务函数 `TaskFun`，分别适用于线程与定时轮询任务。

## 内部使用的类与结构

- `Stack<char> input_line_`: 输入缓冲；
- `Queue<HistoryLine> history_`: 命令历史；
- `arg_tab_[]`: 解析后的参数数组；
- `Path2Dir`, `Path2File`: 路径解析工具；
- `AutoComplete()`: 补全处理；
- `ExecuteCommand()`: 命令解析与运行入口。

## 接口摘要

- `HandleCharacter(char)`: 处理字符输入；
- `Parse(RawData&)`: 解析输入数据；
- `ShowHeader()`, `Clear()`, `ClearLine()`: 控制显示；
- `AddCharToInputLine`, `DeleteChar`: 行编辑支持；
- `ExecuteCommand()`: 命令执行；
- `ThreadFun()`, `TaskFun()`: 驱动函数。

## 设计思想

- 支持阻塞与非阻塞运行模式；线程版本采用阻塞读写，适用于独立线程环境，任务版本适用于定期轮询或事件驱动；
- 所有输出均通过 `WriteOperation` 统一调用；
- 所有解析逻辑兼容控制台输入与图形终端模拟；
- 支持标准嵌入式线程与任务调度系统接入；
- 与 `RamFS` 协同工作，允许通过创建可执行文件动态扩展命令集。

---

本模块可配合串口、TCP、远程调试等方式使用。
