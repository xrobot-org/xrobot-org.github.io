## 本任务目标
- 在本地新建一个最小的 CMake 工程目录。
- 把 LibXR 作为子目录引入，成功编译并链接生成可执行文件。
- 运行后在终端里看到周期输出的 “Hello LibXR on Linux”。

本任务只做一件事：搭一个足够简单、可复用的骨架，确认 “CMake + LibXR + 你的代码” 这条链路是通的。

---

## 目录结构预览
本任务结束时，工程目录大致应为：

- `~/dev/xr_hello_linux/`
  - `CMakeLists.txt`  ← 顶层 CMake 配置
  - `User/`
    - `main.cpp`      ← 你的入口代码
  - `libxr/`         ← LibXR 源码（通过 git clone 得到）

下面的步骤会按时间顺序告诉你：**在哪一步创建哪个目录和文件**。

---

## 步骤 1：创建工程目录和 User 目录
1. 在终端中选一个你喜欢的工作目录，例如 `~/dev`：
```bash
mkdir -p ~/dev
cd ~/dev
```

2. 创建本任务用的工程目录，并进入：
```bash
mkdir -p xr_hello_linux
cd xr_hello_linux
```

3. 在工程目录下创建 `User` 子目录，用来放你自己的源文件：
```bash
mkdir -p User
```

此时的目录结构是：
- `~/dev/xr_hello_linux/`
  - `User/`

（`CMakeLists.txt` 和 `libxr/` 稍后再创建。）

---

## 步骤 2：拉取 LibXR 源码到 libxr 目录
> 本步骤只拉 C++ 版 LibXR 源码，不涉及任何 Python 包安装。

1. 确保当前仍在工程根目录：
```bash
cd ~/dev/xr_hello_linux
```

2. 将 LibXR 仓库克隆到名为 `libxr` 的子目录：
```bash
git clone https://github.com/xrobot-org/libxr.git libxr
```

执行完成后，目录结构变为：
- `~/dev/xr_hello_linux/`
  - `User/`
  - `libxr/`  ← 里面是 LibXR 的 C++ 源码及其自带的 CMake 配置

---

## 步骤 3：在 User 目录中创建 main.cpp
1. 确保当前仍在工程根目录：
```bash
cd ~/dev/xr_hello_linux
```

2. 在 `User` 目录下创建 `main.cpp` 文件（用你喜欢的编辑器，如 `code` / `vim`）：
```bash
code User/main.cpp
```

3. 将下面的示例代码写入 `User/main.cpp`：

```cpp
#include "libxr.hpp"
#include "libxr_system.hpp"
#include "thread.hpp"

int main(int, char **) {
  // 初始化 LibXR 的平台层（在 Linux 上会准备内部线程、时间基准等）
  LibXR::PlatformInit();

  // 简单循环：每秒打印一行
  while (true) {
    LibXR::STDIO::Printf("Hello LibXR on Linux\n");
    LibXR::Thread::Sleep(1000);  // 约 1000 ms
  }

  return 0;
}
```

保存并退出编辑器。

---

## 步骤 4：在工程根目录创建 CMakeLists.txt
1. 确保当前在工程根目录：
```bash
cd ~/dev/xr_hello_linux
```

2. 创建顶层 `CMakeLists.txt` 文件：
```bash
code CMakeLists.txt
```

3. 将下面的配置写入 `CMakeLists.txt`：

```cmake
cmake_minimum_required(VERSION 3.10)
project(xr_hello_linux LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 导出编译命令以便 clangd 等工具使用
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# 引入 LibXR 源码（假设就在 libxr 子目录）
add_subdirectory(libxr)

# 我们自己的可执行程序
add_executable(${PROJECT_NAME}
    User/main.cpp
)

# 链接 LibXR 提供的 xr 库
target_link_libraries(${PROJECT_NAME}
    PRIVATE xr
)

# 把 LibXR 的头文件路径和 User 目录也加入包含路径
target_include_directories(${PROJECT_NAME}
    PRIVATE $<TARGET_PROPERTY:xr,INTERFACE_INCLUDE_DIRECTORIES>
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/User
)
```

保存并退出编辑器。

此时完整目录结构应为：
- `~/dev/xr_hello_linux/`
  - `CMakeLists.txt`
  - `User/`
    - `main.cpp`
  - `libxr/`

---

## 步骤 5：使用 CMake 配置与编译
1. 在工程根目录中创建并使用 `build` 目录：
```bash
cd ~/dev/xr_hello_linux
cmake -S . -B build
cmake --build build
```

- 第一条命令会在 `build/` 目录里生成构建配置；
- 第二条命令会实际编译，生成可执行文件。

如果过程中没有报错，`build/` 目录下应出现一个名为 `xr_hello_linux` 的可执行文件（名字来自 `project(xr_hello_linux ...)`）。

---

## 步骤 6：运行程序
1. 仍在工程根目录，执行：
```bash
cd ~/dev/xr_hello_linux
./build/xr_hello_linux
```

2. 如果一切正常，你应该在终端里看到类似这样的输出，每秒一行：

```text
Hello LibXR on Linux
Hello LibXR on Linux
Hello LibXR on Linux
...
```

3. 使用 `Ctrl+C` 结束程序。

---

## 完成标准
- 工程目录结构为：顶层 `CMakeLists.txt` + `User/main.cpp` + `libxr/` 源码目录。
- 能用 `cmake -S . -B build` 成功配置，用 `cmake --build build` 成功编译。
- 能运行 `./build/xr_hello_linux`，并在终端中看到周期输出的 “Hello LibXR on Linux”。
- 理解以后要在 Linux 上写更复杂的逻辑，只需要在这个工程骨架上继续添加源文件和依赖即可。
