---
id: terminal
title: Terminal Command Interface
sidebar_position: 7
---

# Terminal Command Interface

`LibXR::Terminal` is a command-line terminal backed by `RamFS`. It provides ANSI line editing, history, path completion, and command parsing, and runs in a thread or a timer task.

## Feature Overview

- Finds executable files in `RamFS` by path and runs them;
- Supports command history with up/down navigation;
- Tab completes directory and file names in the first argument;
- Splits arguments at spaces, up to `MAX_ARG_NUMBER` including the command itself (extra arguments are dropped); the only built-in commands are `cd` and `ls`;
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

- `READ_BUFF_SIZE`: the maximum number of bytes taken from the read port at a time;
- `MAX_LINE_SIZE`: the maximum number of characters in one line, equal to `READ_BUFF_SIZE` by default; further characters are not added to the input line and are not echoed;
- `MAX_ARG_NUMBER`: the maximum number of arguments parsed from one line, including the command itself;
- `MAX_HISTORY_NUMBER`: the number of history entries kept.

When a command line can be longer than 32 characters, larger template arguments are used, for example `LibXR::Terminal<64>`, which sets both the read buffer and the line length to 64.

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
- `read_port`, `write_port`: input/output ports, defaulting to `STDIO::read_` / `STDIO::write_`, which must be set before construction (on Linux by `PlatformInit()`); other ports such as a UART can be passed instead;
- `mode`: Line ending mode (CRLF, LF, CR).

Both examples below use the default STDIO ports. On Linux these ports are created by `LibXR::PlatformInit()`, so it is called before the `Terminal` is constructed.

## Usage Example (Thread Mode)

```cpp
LibXR::PlatformInit();  // Linux: creates the STDIO ports
static LibXR::RamFS ramfs;
static LibXR::Terminal<> terminal(ramfs);
LibXR::Thread term_thread;
term_thread.Create(&terminal, terminal.ThreadFun, "terminal", 1024,
                   LibXR::Thread::Priority::MEDIUM);
```

## Usage Example (Task Mode)

```cpp
LibXR::PlatformInit();  // Linux: creates the STDIO ports
static LibXR::RamFS ramfs;
static LibXR::Terminal<> terminal(ramfs);
auto terminal_task = LibXR::Timer::CreateTask(terminal.TaskFun, &terminal, 10);
LibXR::Timer::Add(terminal_task);
LibXR::Timer::Start(terminal_task);
```

## Command Execution & Auto-Completion

- Input commands are buffered in `input_line_` and parsed/executed on Enter;
- The only built-in commands are `cd` and `ls`; `ls` prints one line per entry with a type letter and the name: `d` directory, `x` executable, `f` regular file, `?` custom node;
- Any other input treats the first argument as a RamFS file path: without `/` it is looked up in the current directory only, and a leading `/` resolves from the root; an executable file is run, a missing one prints `Command not found.`, and a non-executable one prints `Not an executable file.`;
- Commands are usually created with `CreateCommand()` and added to `ramfs.bin_`, then called as `/bin/<name>` from the root, or after `cd bin`;
- Supports ANSI-based cursor navigation and command history;
- Tab completes the path in the first argument.

## How It Works

- Receives stream data via `ReadPort`, parses ANSI and input characters sequentially;
- Outputs prompts, echo, and feedback via `WritePort`;
- `ThreadFun` reads the port in `BLOCK` mode, processes input in a loop and does not return; it runs in its own thread;
- `TaskFun` reads the port by polling; each call processes the input that has arrived and returns, and a Timer calls it periodically.

## Interface Summary

- `HandleCharacter(char)`: Handle character input;
- `Parse(RawData&)`: Parse input data;
- `ShowHeader()`, `Clear()`, `ClearLine()`: Display control;
- `AddCharToInputLine`, `DeleteChar`: Line editing support;
- `ExecuteCommand()`: Execute command;
- `ThreadFun()`, `TaskFun()`: Driver functions.

---

The terminal works over any `ReadPort` / `WritePort`, such as a UART or TCP link.
