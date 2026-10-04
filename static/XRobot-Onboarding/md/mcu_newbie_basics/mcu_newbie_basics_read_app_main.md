## 本任务目标
- 了解运行 CodeGenerator 之后，STM32 工程的整体结构发生了哪些变化。
- 找到 app_main() 函数，弄清它大致负责哪些初始化工作、有哪些预留给用户的代码区块。
- 在合适的位置主动接入 app_main()：在 main()（或 FreeRTOS 默认任务入口）中包含 app_main.h 并调用 app_main()，形成完整的启动链路。
## 前置条件
- 已经有一个可以在 VS Code 中正常编译的 STM32 CMake 工程。
- 已经在该工程上运行过一次 LibXR 的代码生成流程（例如使用 libxr stm32 setup），并确认工程仍然可以编译通过。
- 工程中已经出现 User/app_main.cpp 和 app_main.h 等文件。
## 步骤 1：整体看一眼工程结构
1. 在 VS Code 中打开 STM32 工程根目录。
2. 在资源管理器中浏览目录结构，注意区分几类目录：
   - Core/ 与 Drivers/：主要为 STM32CubeMX 生成的启动代码、HAL 驱动等。
   - Middlewares/Third_Party/LibXR（或类似路径）：存放 LibXR 源码或子模块。
   - User/：放置与当前工程相关的用户代码和 LibXR 生成代码，通常包含 app_main.cpp、app_main.h、libxr_config.yaml 等文件。
3. 这一阶段只需要大致分清：哪些是原始 CubeMX 工程，哪些是 LibXR 引入的新增部分，以及 app_main.cpp / app_main.h 所在的位置。
## 步骤 2：打开 app_main.cpp，认识 LibXR 初始化代码
1. 打开 User/app_main.cpp（路径以实际工程为准）。
2. 在文件中找到 app_main() 函数：
   - 通常以 C 接口形式提供（可看到 extern "C" 包裹的函数定义），由 C 语言侧的启动代码调用。
   - 函数内部一般包括：
     - 平台初始化（例如时间基准、基础设施初始化等）。
     - 按当前 .ioc 配置创建各类外设封装对象（如 STM32GPIO、STM32UART、STM32SPI 等）。
     - 进入主循环或调用后续逻辑。
3. 观察文件顶部和中部的结构：
   - 可以看到包含 libxr.hpp 以及若干 stm32_xxx.hpp 头文件，这是 LibXR 针对 STM32 的封装入口。
   - 中间通常会有一些静态缓冲区和外设相关的对象定义，这些都是 CodeGenerator 根据 .ioc 自动生成的初始化部分。
4. 注意文件中用注释标出的“User Code Begin / User Code End”区块：
   - 这些区块是后续编写自定义逻辑的主要位置。
   - 重新运行代码生成工具时，区块外的内容可能会更新，而区块内的代码会被保留。
## 步骤 3：在工程入口中接入 app_main()
1. 打开 Core/ 目录下的 main.c 文件：
   - 在裸机工程中，可以在 main() 函数中看到 HAL_Init()、SystemClock_Config() 以及若干初始化调用。
   - 在使用 FreeRTOS 的工程中，main() 中会启动调度器，默认任务入口函数（例如 StartDefaultTask）是应用层主要入口。
2. 在合适位置包含 app_main.h：
   - 在 main.c 顶部其他头文件附近，加入一行：
     - #include "app_main.h"
3. 选择调用 app_main() 的位置：
   - 裸机工程：
     - 在 main() 中，完成 HAL_Init() 和时钟等基础配置后，调用 app_main();
     - 调用位置应在你希望“正式开始应用逻辑”的地方。
   - FreeRTOS 工程：
     - 在默认任务（例如 StartDefaultTask）的函数体中，选择合适位置调用 app_main();
     - 确保调用时调度器已经启动，处于应用线程上下文。
4. 保存修改后，重新构建工程：
   - 确认没有因 app_main 相关改动而引入新的编译或链接错误。
## 步骤 4：简单确认调用链路
1. 从调用关系的角度，在脑中梳理一次当前工程的启动过程：
   - 复位 → 启动代码 → main() →（如有 RTOS：调度器 + 默认任务）→ app_main()。
2. 这一步不需要单步调试，只要能用文字描述出大概顺序即可，为后续排查启动问题打基础。
## 完成标准
- 可以在工程中准确找到 app_main.cpp 和 app_main() 函数，知道它包含哪些自动生成的初始化内容，以及 User Code 区块大致位置。
- 已在 main.c 中正确包含 app_main.h，并在合适的位置调用 app_main()（无论是直接在 main() 中，还是在默认 FreeRTOS 任务入口中）。
- 重新构建工程后没有新增错误，能够清楚说出：当前工程从启动到进入 app_main() 的关键入口函数分别是什么。
