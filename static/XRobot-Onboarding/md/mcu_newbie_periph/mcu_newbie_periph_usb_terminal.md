## 参考资料
- STM32 串口与终端代码生成（重点看“硬件串口 / USB CDC / 配置文件说明”）：
  https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-uart
- Terminal 终端组件文档：
  https://xrobot.work/docs/basic_coding/middleware/terminal
- RamFS 内存文件系统文档：
  https://xrobot.work/docs/basic_coding/middleware/ramfs
- LibXR C++ API 索引：
  https://jiu-xiao.github.io/libxr/
## 本任务目标
- 在“硬件串口已能正常发送文本”的基础上，通过修改配置文件 + 重新生成工程：
  - 可选：启用 USB CDC 虚拟串口（板子支持的话）。
  - 启用基于某个串口（硬件 UART 或 USB CDC）的 Terminal + RamFS 命令行终端。
- 理解：带有配置文件的小节，初始化代码基本都由 CodeGenerator 自动生成，你主要负责“改对配置 + 看得懂生成出来的代码”。
## 一、先把几个新名词说明白
1. USB CDC / 虚拟串口（Virtual COM Port）：
   - USB CDC：USB Communications Device Class，一种标准的 USB 设备类型。
   - 在 PC 眼里，CDC 设备会表现成一个“虚拟串口”，用串口工具就能直接打开，使用方式和普通串口类似。
2. CDCUart：
   - LibXR::USB::CDCUart：把“USB CDC 端点”包装成类似串口的对象，对上层来说和 STM32UART 很像。
3. Terminal：
   - LibXR::Terminal：一个跑在串口上的“命令行终端”，支持 ls、cd、历史记录、补全等。
4. RamFS：
   - LibXR::RamFS：完全在内存中的一个小文件系统。
5. STDIO：
   - LibXR::STDIO：一个全局的“标准输入输出”接口，可以绑定到某个串口或 CDCUart 上。
6. YAML 配置：
   - .config.yaml / libxr_config.yaml：工程配置文件，串口、USB、终端等行为都在这里描述。
## 二、准备：确认可用的“串口来源”
终端可以绑定到两类来源之一：
1. 硬件串口（STM32UART）：app_main.cpp 中的 STM32UART usart1 等。
2. USB CDC 虚拟串口（如果硬件和工程支持）：启用 USB OTG，生成 CDCUart + USB 设备对象。
如果目前不想折腾 USB，可以只在硬件串口上启用终端。
## 三、修改配置文件：启用 USB（可选）和 terminal_source
1. 启用 USB CDC（可选）：
   - 在 .config.yaml / libxr_config.yaml 中找到 USB 段落，将对应 USB_OTG 的 enable 从 false 改为 true。
   - 保存后重新生成代码，CodeGenerator 会自动补齐 USB 配置并在 app_main.cpp 中添加 CDCUart + USB 设备对象以及 Init()/Start() 调用。
2. 指定终端绑定到哪一路“串口对象”：
   - 在同一配置文件中找到 terminal_source 字段：
     - 使用硬件串口：terminal_source: usart1。
     - 使用 USB CDC：terminal_source: usb_otg_fs_cdc（名字以实际生成的对象为准）。
3. Terminal 运行参数（先保持默认）：
   - Terminal:
     - read_buff_size、max_line_size、max_arg_number、max_history_number。
     - run_as_thread: true。
     - thread_stack_depth、thread_priority 使用默认即可。
## 四、重新生成代码
- 在工程根目录执行一次 xr_cubemx_cfg -d .。
- CodeGenerator 会根据 YAML 自动完成：
  - 若 USB enable: true：生成 CDCUart + USB 设备对象，并在 app_main.cpp 中调用 Init()/Start()。
  - 根据 terminal_source 自动生成 STDIO 绑定、RamFS 和 Terminal 初始化代码，并按配置决定是否以线程方式运行终端。
## 五、在 app_main.cpp 中确认生成结果
1. 检查 USB CDC（如已启用）：
   - 搜索 CDCUart / USB_OTG，可看到 CDCUart 对象、USB 设备对象以及 Init()/Start() 调用。
2. 检查 STDIO 绑定和 Terminal / RamFS：
   - 搜索 Terminal / RamFS，可看到 RamFS 实例、Terminal 实例、Terminal 线程或运行入口。
   - 附近会有 STDIO::read_ / STDIO::write_ 绑定到 terminal_source 对象的代码。
3. 确认 User Code 区域仍然存在，之前写的点灯、串口输出逻辑未被覆盖。
## 六、用串口工具连接并尝试命令行
1. 构建并下载工程，让程序运行。
2. 在 PC 上用 PuTTY / MobaXterm 或任意串口工具：
   - 若 terminal_source: usart1：选对应的串口号 + 波特率。
   - 若 terminal_source: usb_otg_fs_cdc：用 USB 连接板子，选择新出现的虚拟串口号。
3. 连接后尝试输入：
   - ls 查看目录。
   - cd /、cd .. 切换目录。
   - 使用方向键、退格键测试输入编辑和历史记录。
若这些操作都有明确反馈，说明终端正常工作。
## 七、遇到问题时的检查顺序
1. 硬件与 PC 设置：
   - 板子供电是否正常，串口号是否选对，波特率是否一致。
2. CubeMX 与 YAML 配置：
   - USB 外设是否启用，terminal_source 是否为正确的对象名。
3. 代码生成与构建：
   - 修改配置后是否重新执行 xr_cubemx_cfg -d .。
   - 重新生成后是否完整构建工程。
4. 生成代码状态：
   - app_main.cpp 中能否找到 CDCUart / USB 设备对象、STDIO 绑定、RamFS 和 Terminal 初始化代码。
   - 是否误改了非 User Code 区域。
## 完成标准
- 通过修改配置文件（而不是手写初始化代码），成功启用：
  - 至少一个终端来源（硬件串口 usart1 或 USB CDC）。
  - 基于 Terminal + RamFS 的命令行环境。
- 能在 app_main.cpp 中清楚指出：
  - 与 terminal_source 对应的 STDIO 绑定位置。
  - RamFS 和 Terminal 的初始化代码以及线程启动位置。
- 使用串口工具成功连接板子，在终端中可以输入 ls / cd 等基本命令并获得反馈。
- 能说明：USB CDC 和终端相关的大部分初始化是通过“修改 YAML + 重新生成”完成的，自己主要工作是选好终端使用的串口与配置，并在 User Code 区域基于这些生成对象继续扩展逻辑。
