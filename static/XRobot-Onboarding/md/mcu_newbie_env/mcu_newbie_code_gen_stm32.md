## 参考资料
- 文档：STM32 代码生成 https://xrobot-org.github.io/docs/code_gen/stm32
- 视频：[STM32 + VS Code] 自动生成 C++ 代码 | Python & libxr  - XRobot 官方教程 1.0 节
  https://www.bilibili.com/video/BV1yUnpz6E6h
本任务建议一边对照视频，一边按照文字步骤操作。文档中的高级选项和工具链切换内容，新手可以暂时跳过。
## 本任务目标
- 在已经可以正常编译的 STM32Cube CMake 工程中，首次运行 libxr stm32 setup。
- 让工程自动集成 LibXR：生成 app_main.cpp 等初始化代码，并把 LibXR 加入 CMake 构建。
- 大致认识生成出的关键文件，知道后续要在 app_main.cpp 的 User Code 区块中写自己的逻辑。
## 前置条件
- 已在 Windows 上完成 STM32 + VS Code 环境配置，能通过 “STM32CubeIDE for Visual Studio Code” 插件正常编译一个 STM32 CMake 工程。
- 前面任务中已经安装好 Python 3 以及 libxr 包（CodeGenerator）。
- 手上有一个简单的 STM32Cube 工程（CMake + GCC），并能在 VS Code 中干净编译通过。
## 操作步骤（简要）
1. 在 VS Code 中打开你的 STM32Cube 工程根目录（包含 .ioc 和 CMakeLists.txt 的那一层）。
2. 确认工程目前可以正常编译：先用 STM32 插件执行一次构建，确保环境没有现有错误。
3. 在工程根目录打开一个终端（VS Code 内置终端或系统终端均可），执行：
   libxr stm32 setup -d .
4. 等待命令运行完成，出现类似“All tasks completed successfully”之类的提示，即表示生成流程完成。
5. 回到 VS Code，再次构建工程：
   - 如果构建通过，说明 LibXR 已经成功集成进当前工程。
6. 打开 User/app_main.cpp，浏览生成的代码结构，重点找到几个位置：
   - app_main() 函数本身。
   - 注释标记的 “User Code Begin / End” 区块（后续会在这些区块中补充自己的逻辑）。
   - 若干自动生成的外设对象（如 STM32UART、STM32SPI 等）。
## libxr stm32 setup 做了什么（只需大致了解）
- 从 .ioc 文件中解析出当前工程的硬件配置，生成 .config.yaml。
- 根据配置自动生成基于 LibXR 的初始化代码：
  - 在 User/ 目录下生成 app_main.cpp / app_main.h。
  - 生成 libxr_config.yaml 和 flash_map.hpp 等辅助文件。
- 修改工程 CMake 配置，自动加入 LibXR：
  - 在 Middlewares/Third_Party 下添加 LibXR 作为 Git 子模块（如果尚未存在）。
  - 生成 cmake/LibXR.CMake 并在 CMakeLists.txt 中插入 include。
## 本节暂时不需要做的事情
- 不需要修改 main() 或 FreeRTOS 线程入口，只需记住 app_main() 这个名字，后续任务会指导如何在入口中调用它。
- 不需要手动编辑 .config.yaml 或 libxr_config.yaml；先以默认生成内容为主，之后有需要再调整。
- 不需要单独使用 libxr stm32 toolchain 等子命令，新手路线只用 libxr stm32 setup 即可。
## 完成标准
- 在当前 STM32 工程根目录成功运行过一次 libxr stm32 setup -d .。
- 工程重新构建后仍能顺利通过编译。
- 能在 User/app_main.cpp 中找到 app_main() 函数和 User Code Begin / End 区块，知道这些是后续编写用户逻辑的主要入口。
