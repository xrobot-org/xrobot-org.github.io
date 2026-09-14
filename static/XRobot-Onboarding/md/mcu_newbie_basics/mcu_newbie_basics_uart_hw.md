## 参考资料（本节只用“硬件串口”，先不管 USB / 终端）
- STM32 硬件串口代码生成（CodeGenerator）：https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-uart
- LibXR UART 驱动文档（概念与接口）：https://xrobot.work/docs/basic_coding/driver/uart
- I/O 操作模型概念（为什么每次 I/O 都要绑定完成行为）：https://xrobot.work/docs/concept
- Operation 抽象（Operation / ReadOperation / WriteOperation）：https://xrobot.work/docs/basic_coding/core/core-op
- ReadPort / WritePort 抽象：https://xrobot.work/docs/basic_coding/core/core-rw
- 原始数据封装 RawData / ConstRawData：https://xrobot.work/docs/basic_coding/core/core-rawdata
- LibXR C++ API 参考文档（查某个类 / 函数的具体接口定义时使用）：https://xrobot.work/libxr/
本节只做“硬件串口 + 简单文本输出”，先不启用 USB CDC、终端和 STDIO::Printf。
## 本任务目标
- 在已有的 LibXR STM32 工程中，把一组硬件串口（例如 USART1）配置完整，并通过 CodeGenerator 生成对应的 STM32UART 对象。
- 理解一件事：在 LibXR 中，任何 I/O 操作都需要带上一个 Operation（例如 WriteOperation），在发起时就决定“完成后怎么处理”。
- 在 app_main() 中，通过 STM32UART 周期性向 PC 串口工具发送一行简单文本（例如 "Hello from LibXR"），验证串口和 I/O 操作模型的基本用法。
## 前置条件
- 已有一个可以在 VS Code 中正常编译、下载的 LibXR STM32 工程：
  - main()（或 FreeRTOS 线程入口）中已经调用 app_main()；
  - 至少有一个 LED 闪烁示例已经跑通。
- 开发板已连接到电脑，PC 端有任意串口调试工具（例如 PuTTY、Termite、串口监视器等）。
## 一、在 STM32CubeMX 中配置硬件串口（只做 USART，不管 USB）
1. 选择一路硬件串口：
   - 打开当前工程的 .ioc。
   - 选择一组可用的串口实例（例如 USART1），将其模式设置为 Asynchronous。
   - 将 TX / RX 引脚映射到实际有连线的引脚（开发板丝印上通常会标出 TX / RX）。
2. 启用中断和 DMA：
   - 在 NVIC 配置中启用该串口的全局中断（例如 USART1 global interrupt）。
   - 在 DMA 配置中：
     - 为该串口配置发送（TX）和接收（RX）的 DMA 通道。
     - 保持默认模式即可。
   - 保存 .ioc 并重新生成 STM32 代码。
## 二、重新运行 CodeGenerator，找到 STM32UART 对象
1. 在工程根目录重新生成 LibXR 相关代码：
   - 回到 VS Code，确认当前打开的是 STM32 工程根目录（包含 .ioc 和 CMakeLists.txt 的那一层）。
   - 打开终端，在根目录执行一次完整的代码生成流程，例如：xr_cubemx_cfg -d .。
   - 生成结束后重新构建工程，确保仍然可以通过编译。
2. 在 app_main.cpp 中找到硬件串口对象：
   - 打开 User/app_main.cpp，搜索 "STM32UART"。
   - 应当能看到类似下面的定义（名称可能不同）：STM32UART usart1(&huart1, usart1_rx_buf, usart1_tx_buf, 5);
   - 构造参数可以这样理解：
     - &huart1：CubeMX 生成的 HAL 串口句柄。
     - usart1_rx_buf / usart1_tx_buf：CodeGenerator 为 DMA 分配的接收 / 发送缓冲区。
     - 最后一个参数是发送请求队列长度（tx_queue_size），控制同时可以排队的写操作数量。
## 三、本节只需要记住的几个类型
1. STM32UART：
   - 针对 STM32 平台的 UART 驱动类，实现了 LibXR::UART 接口。
   - 负责协调 HAL 串口句柄、DMA 缓冲区和 LibXR 的 I/O 抽象（ReadPort / WritePort）。
2. ReadPort / WritePort（只建立印象）：
   - STM32UART 内部持有 ReadPort / WritePort：
     - ReadPort 负责收数据。
     - WritePort 负责发数据。
   - 每次读写时，都会搭配一个 Operation（ReadOperation / WriteOperation）说明“完成后怎么处理”。
3. RawData / ConstRawData（长度从哪里来）：
   - RawData 和 ConstRawData 用来把“一段内存的起始地址 + 字节数”打包在一起：
     - RawData 用于可读写数据。
     - ConstRawData 用于只读数据。
   - LibXR 的读写接口通常写成类似形式：
     - 读：Read(RawData data, ReadOperation &op)
     - 写：Write(ConstRawData data, WriteOperation &op)
   - 当你准备了一段待发送的数据时，例如：uint8_t msg[] = "Hello from LibXR\r\n"; 可以构造一个 ConstRawData data(msg)。构造函数会自动记录 msg 的起始地址和有效长度（不包含结尾的 \0）。
4. WriteOperation：
   - 表示“写操作完成后如何处理”的选择。
   - 本节先记住两种用法：
     - 默认构造（不带参数）：发起写操作但不关心结果，可视为“发出请求后不再等待”。
     - 使用信号量构造：发起写操作，并让当前任务在信号量上等待，直到写操作完成或超时。
5. 信号量（Semaphore）：
   - 可以简单理解为一个“等事件”的计数器：
     - 写操作开始时，当前任务在信号量上阻塞等待。
     - 底层驱动在确认发送完成后“释放”信号量。
     - 阻塞的任务被唤醒，继续执行。
   - LibXR 在所有支持的平台上都提供自己的信号量抽象。
6. LibXR::Thread::Sleep：
   - 与前面点灯时使用的一致，用于在主循环中控制节奏。
## 四、在 app_main() 里通过串口周期性发送文本
1. 从最简单的完成行为开始：
   - 先使用默认构造的 WriteOperation：
     - 不绑定信号量，不绑定回调。
     - 写操作发出后，程序不会等待发送完毕，只是把数据放入发送队列，由底层驱动在后台发送。
2. 在 app_main() 的 User Code 区域中添加发送逻辑：
   - 打开 User/app_main.cpp，找到 app_main() 函数中最后一个 while(1) 所在的 User Code 区块。
   - 在该循环内添加类似逻辑：
     - 准备要发送的文本：
       - uint8_t msg[] = "Hello from LibXR\r\n";
     - 构造数据对象和操作对象：
       - ConstRawData data(msg);
       - WriteOperation op;  // 默认构造，表示不关心完成结果
     - 调用 usart1.Write(data, op); 发起发送。
     - 调用 LibXR::Thread::Sleep(1000); 控制发送间隔（例如 1 秒一次）。
   - 重新编译并下载程序。
   - 打开 PC 串口调试工具，选择正确的串口号和波特率，观察是否有周期输出。
3. 使用信号量的阻塞写（可选）：
   - 创建一个 LibXR::Semaphore 对象。
   - 用该信号量和一个超时时间构造 WriteOperation。
   - 在主循环中使用这个 WriteOperation 调用 usart1.Write(data, op_block)。
   - 当前任务会在信号量上等待，直到写操作完成或超时，再继续执行后续逻辑。
   - 对比两种方式：
     - 默认 WriteOperation：只要队列未满，写操作立即返回，节奏主要由 Sleep 控制。
     - 带信号量的 WriteOperation：主循环还要等待本次写操作完成，再进入下一轮。
## 五、（选做）尝试做一个最简单的串口回显
- 在 app_main() 中准备接收缓冲区。
- 使用 ReadOperation 发起一次读取请求（阻塞或回调模式）。
- 读取完成后，把收到的数据再通过 Write 发送回串口。
- 在 PC 串口工具中键入字符，如果能被原样回显，说明收发路径已经打通。
## 完成标准
- 已在 .ioc 中为至少一路硬件串口配置了 Asynchronous 模式、NVIC 中断和 TX/RX DMA，并重新生成 STM32 代码。
- 通过 CodeGenerator 重新生成工程后，能在 app_main.cpp 中找到对应的 STM32UART 对象，并能说清每个构造参数的含义（特别是最后一个参数是发送请求队列长度）。
- 在 app_main() 的 User Code 区域中，实现了周期性向串口发送文本的逻辑，在 PC 串口工具中能看到稳定输出。
- 能用自己的话描述：
  - 为什么 LibXR 在进行串口写操作时总是需要一个 WriteOperation。
  - 本示例中默认构造的 WriteOperation 表示什么样的完成行为。
  - 如果改用带信号量的 WriteOperation，会对主循环行为产生什么变化。
- （选做）完成一个最简单的“串口回显”实验：PC 端发什么，板子通过同一串口原样发回。
