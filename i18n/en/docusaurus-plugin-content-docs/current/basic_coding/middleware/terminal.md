---
id: terminal
title: Terminal Command Interface
sidebar_position: 7
---

# Terminal Command Interface

`LibXR::Terminal` is an embedded command-line terminal component that supports ANSI control, path auto-completion, command parsing, and integration with RamFS. It offers a Unix-style command-line experience with flexible runtime modes, capable of running in threads or periodic tasks — suitable for various embedded platforms.

## Feature Overview

- Seamless integration with the `RamFS` file system, enabling parsing and execution of executable files;
- Supports command history with up/down navigation;
- Supports command auto-completion (Tab to complete file/directory names);
- Built-in commands like parameter parsing, directory switching (`cd`), and listing (`ls`);
- ANSI control character compatibility (supports arrow key movement, cursor control);
- Customizable input/output port binding (UART / Pipe / TCP / STDIO compatible);
- Provides two runtime modes: `ThreadFun` (thread-driven) and `TaskFun` (task-driven).

## Class Template Definition

```cpp
template <size_t READ_BUFF_SIZE = 32,
          size_t MAX_LINE_SIZE = READ_BUFF_SIZE,
          size_t MAX_ARG_NUMBER = 5,
          size_t MAX_HISTORY_NUMBER = 5>
class Terminal;
```

## Constructor

```cpp
Terminal(RamFS &ramfs,
         RamFS::Dir *current_dir = nullptr,
         ReadPort *read_port = STDIO::read_,
         WritePort *write_port = STDIO::write_,
         Mode mode = Mode::CRLF);
```

- `ramfs`: The file system instance to use;
- `current_dir`: The current default directory (defaults to root);
- `read_port`, `write_port`: Input/output ports (e.g., UART, standard streams);
- `mode`: Line ending mode (CRLF, LF, CR).

## Usage Example (Thread Mode)

```cpp
LibXR::RamFS ramfs;
LibXR::Terminal<> terminal(ramfs);
LibXR::Thread term_thread;
term_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                   LibXR::Thread::Priority::MEDIUM);
```

## Usage Example (Task Mode)

```cpp
static LibXR::RamFS ramfs;
static LibXR::Terminal<> terminal(ramfs);
auto terminal_task = Timer::CreateTask(terminal.TaskFun, &terminal, 10);
Timer::Add(terminal_task);
Timer::Start(terminal_task);
```

## Command Execution & Auto-Completion

- Input commands are buffered in `input_line_` and parsed/executed on Enter;
- Built-in commands include `ls`, `cd`;
- If the command matches an executable file in RamFS (`FileType::EXEC`), it is run;
- Supports ANSI-based cursor navigation and command history;
- Press Tab for auto-completion of paths.

## How It Works

- Receives stream data via `ReadPort`, parses ANSI and input characters sequentially;
- Outputs prompts, echo, and feedback via `WritePort`;
- Offers loop functions: `ThreadFun` for thread mode and `TaskFun` for periodic polling.

## Internal Classes & Structures

- `Stack<char> input_line_`: Input buffer;
- `Queue<HistoryLine> history_`: Command history;
- `arg_tab_[]`: Parsed argument array;
- `Path2Dir`, `Path2File`: Path resolution utilities;
- `AutoComplete()`: Completion handler;
- `ExecuteCommand()`: Entry point for command execution.

## Interface Summary

- `HandleCharacter(char)`: Handle character input;
- `Parse(RawData&)`: Parse input data;
- `ShowHeader()`, `Clear()`, `ClearLine()`: Display control;
- `AddCharToInputLine`, `DeleteChar`: Line editing support;
- `ExecuteCommand()`: Execute command;
- `ThreadFun()`, `TaskFun()`: Driver functions.

## Design Principles

- Supports both blocking and non-blocking modes: thread version uses blocking I/O, task version is suitable for polling or event-driven systems;
- All output is unified via `WriteOperation`;
- Compatible with console input and graphical terminal emulation;
- Designed to integrate with standard embedded threads or task schedulers;
- Works with `RamFS` to allow dynamic command extension via executable files.

---

It can be used over UART, TCP, remote debugging, and more.
