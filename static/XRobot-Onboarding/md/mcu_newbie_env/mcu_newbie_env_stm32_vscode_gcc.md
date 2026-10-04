## 推荐视频
- STM32 开发环境总览（第 0 节）：
  【无需配置！STM32 + VS Code 最好的开发方式：XRobot 官方教程第 0 节——STM32 开发环境】
  https://www.bilibili.com/video/BV1SHnAztE11
- 使用 DAPLink + OpenOCD 调试（后续可参考，第 0.2 节）：
  【STM32 + VS Code】用 DAPLink + OpenOCD 调试 - XRobot 官方教程 0.2 节
  https://www.bilibili.com/video/BV1bnnZz2ESg
本任务不要求逐字跟随视频操作，只是推荐在实际配置时配合视频一起查看，遇到细节问题可以回到视频中对照。
## 参考文档
- STM32 环境配置文档（只需关注 STM32 + VS Code + GCC 路线）：
  https://xrobot.work/docs/env_setup/env-setup-stm32
## 本任务目标
- 在 Windows 上安装 STM32CubeMX 和 VS Code。
- 在 VS Code 中安装并启用 ST 官方插件 “STM32CubeIDE for Visual Studio Code”。
- 使用 STM32CubeMX 生成一个基于 CMake + GCC 的 STM32 工程，并在 VS Code 中用插件完成工具链配置，成功编译工程。
- 对于使用 DAPLink 的用户：了解后续需要配合 OpenOCD 使用，本任务只需保证基本工程能在 VS Code 中编译，通过插件拉起调试入口即可。
## 前提条件
- 操作系统为 Windows。
- 已完成前面任务：
  - 准备好 STM32 开发板和调试器（ST-LINK / J-LINK / DAPLink 等）。
  - 安装好 Python 3，并通过 pip 或 pipx 安装了 libxr 和 xrobot。
## 步骤 1：安装基础软件
1. 安装 STM32CubeMX：
   - 从 ST 官网下载 STM32CubeMX，按向导完成安装。
2. 安装 VS Code：
   - 从 VS Code 官网下载 Windows 安装包并完成安装，保持默认选项即可。
3. 安装 Git（如尚未安装）：
   - 从 https://git-scm.com/ 下载并安装 Git，后续某些步骤会用到 Git。
## 步骤 2：安装 VS Code 插件
1. 打开 VS Code，进入扩展（Extensions）面板。
2. 搜索并安装插件：
   - 名称：STM32CubeIDE for Visual Studio Code
   - 发布者：STMicroelectronics
3. 安装完成后重启 VS Code，确保插件正常启用。
## 步骤 3：在 STM32CubeMX 中创建 CMake + GCC 工程
1. 打开 STM32CubeMX，创建一个新的 STM32 工程。
2. 选择与你的开发板相匹配的 MCU 或开发板型号。
3. 在配置阶段：
   - 打开 SWD 调试接口，以便后续可以通过 ST-LINK / J-LINK / DAPLink 进行调试。
   - 适当启用一个简单外设（例如一个 LED 引脚或一个串口），用于后续最基本的测试即可。
4. 在 Project Manager 中：
   - 将工程类型配置为 CMake 工程。
   - 编译器/链接器选择 GCC。
5. 选择工程名称和保存路径，生成代码，使 STM32CubeMX 在本地生成完整的 CMake 工程。
## 步骤 4：在 VS Code 中用插件打开并配置工程
1. 打开 VS Code，使用“打开文件夹”功能打开刚刚生成的 STM32 工程目录。
2. 使用 “STM32CubeIDE for Visual Studio Code” 插件提供的入口，将该工程识别为 STM32Cube 工程。
3. 按照插件提示完成初始配置：
   - 插件会自动为工程配置 CMake 构建和 GCC 工具链。
   - 如需下载额外工具链，插件会给出提示并引导完成下载，无需手动设置 PATH。
## 步骤 5：验证构建与基础调试入口
1. 在 VS Code 中，通过插件提供的“构建/编译”命令，对当前工程执行一次完整编译：
   - 构建成功即可，暂时不关心具体功能是否已经正常工作。
2. 如条件允许，可以简单测试一次调试启动（按下 F5）：
   - 使用 ST-LINK / J-LINK 的用户，可直接在插件中选择对应调试器类型启动调试会话。
   - 使用 DAPLink 的用户，需要先在系统中配置好 OpenOCD 与 DAPLink（具体配置可参考前述 DAPLink + OpenOCD 教程视频），然后在插件中选择合适的调试配置。
3. 本任务只要求：工程可以成功编译，调试入口能够被插件正常拉起。后续关于中断配置、示例代码和 HardFault 处理会在专门章节中展开，不要求在本节解决。
## 本节暂不涉及的内容
- 不需要在此时集成或使用 LibXR、CodeGenerator 或 XRobot。
- 不需要配置 Clang 或其它复杂的工具链模式，仅使用插件自动配置的 GCC 即可。
- 不需要在本节深入 OpenOCD 配置细节，只需知道：若使用 DAPLink，后续需要配合 OpenOCD，相关操作可以参考专门视频和后续任务。
## 完成标准
- 已能在 Windows 上启动 STM32CubeMX 和 VS Code。
- 已在 VS Code 中安装并启用 “STM32CubeIDE for Visual Studio Code” 插件。
- 已使用 STM32CubeMX 创建一个 CMake + GCC 的 STM32 工程，并在 VS Code 中通过插件成功完成一次编译。
- 如已连接调试器，则能通过插件拉起一次调试会话（无论是 ST-LINK / J-LINK 还是 DAPLink + OpenOCD），确认环境整体流程打通。
