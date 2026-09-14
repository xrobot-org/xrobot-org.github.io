## 本任务目标
- 在“点灯 + 串口”的基础上，整体认识 LibXR 在 STM32 侧还提供了哪些常用外设封装和基础中间件能力。
- 学会根据文档自行选择一个或少量外设 / 组件，在现有工程中做一个小实验，独立尝试相应的 C++ 接口。
- 建立一份“文档索引”的印象：以后遇到某个模块时知道应该优先从哪里查起。
## 前置条件
- 已完成前面“第一个 LibXR 工程（点灯 + 串口）”相关任务：
  - 工程能在 VS Code 中正常编译和下载。
  - app_main() 已经接入。
  - 至少有一个 LED 闪烁和一个串口文本输出示例可以正常运行。
## 一、先大致看一眼：有哪些外设可以自动生成
入口文档：
- STM32 代码生成（总览）：https://xrobot.work/docs/code_gen/stm32
在这页的子页面中，可以看到当前支持的主要外设与功能，例如：
- Flash 数据库
- 时钟基准
- GPIO / ADC / DAC / PWM
- SPI / I2C / CAN 与 CAN FD
- 串口与终端
- 看门狗
- 高速缓存
本步骤建议做的事情：
- 只浏览标题和最前面的概览部分，不必细读细节。
- 对照自己的开发板，先想一想：
  - 手上有没有接传感器（ADC / I2C / SPI）。
  - 是否想要做一个简单的 Flash 参数存储。
  - 是否想先多玩一点 GPIO / 串口以外的外设。
- 初步在心里选出 1–2 个“有硬件条件、也有兴趣”的方向。
## 二、再看抽象接口：同一类外设在 C++ 里长什么样
入口文档：
- 外设驱动（Device Drivers）：https://xrobot.work/docs/basic_coding/driver
这里给出了统一的 C++ 抽象接口，包括：
- GPIO（通用输入输出）。
- UART（串口通信）。
- I2C / SPI / CAN / ADC / PWM 等。
- Flash、Power、Timebase 等基础能力。
本步骤建议做的事情：
- 针对你在上一步选中的外设，在 driver/ 下找到对应的小节，例如：
  - 想继续玩 GPIO，就看 driver/gpio。
  - 想试 I2C，就看 driver/i2c。
  - 想试 SPI，就看 driver/spi。
  - 想试 ADC，就看 driver/adc。
- 只关注几件事：
  - 抽象类的名称（例如 ADC、I2C、SPI、UART 等）。
  - 是否有 Configuration 结构体、SetConfig()、Enable()/Disable() 之类的接口。
  - 最基础的读写或控制方法叫什么（例如 Read()、Write()、SetDutyCycle()）。
遇到某个类或函数名不清楚时，可以在 LibXR C++ API 索引中查：https://jiu-xiao.github.io/libxr/
## 三、选择一个方向，做一个只涉及少量代码的小实验
本任务没有“统一的标准示例代码”，而是鼓励你根据手头硬件和兴趣，在现有工程上做一个小范围尝试。可以参考以下思路任选其一（或自选）：
### 示例方向 1：在现有工程上再增加一个 GPIO 功能
- 例如：新增一个按键输入，只做“读一次电平并通过串口打印”。
- 对照文档：
  - STM32 代码生成 · GPIO：https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-gpio
  - GPIO 驱动接口：https://xrobot.work/docs/basic_coding/driver/gpio
- 自己完成的核心动作：
  - 在 .ioc 中配置一个新引脚为输入，重新生成 STM32 代码并运行一次 CodeGenerator。
  - 在 app_main.cpp 中找到新生成的 STM32GPIO 对象。
  - 在 User Code 区域写几行代码，读一次电平，通过串口打印当前状态，确认输出随按键变化。
### 示例方向 2：简单尝试一个 ADC 通道
- 前提：板子上有可用的 ADC 输入（电位器、分压电路或任意可观察变化的信号）。
- 对照文档：
  - STM32 代码生成 · ADC（在 code_gen/stm32 下）。
  - ADC 驱动接口（在 basic_coding/driver/adc 下）。
- 自己完成的核心动作：
  - 在 .ioc 中启用一个 ADC 通道，重新生成 STM32 代码并运行 CodeGenerator。
  - 在 app_main.cpp 中找到对应的 LibXR ADC 封装对象。
  - 在循环中定期读取一次 ADC 数值，并通过串口打印出来（不追求精确标定，只要数值随输入变化即可）。
### 示例方向 3：用 I2C 或 SPI 读取一个简单传感器寄存器（例如 MPU6050 WHO_AM_I）
- 前提：开发板上接有简单传感器模块（例如基于 MPU6050 的模块），并且已确认其使用 I2C 或 SPI 接口。
- 对照文档：
  - STM32 代码生成 · I2C：https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-i2c
  - STM32 代码生成 · SPI：https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-spi
  - I2C 驱动接口：https://xrobot.work/docs/basic_coding/driver/i2c
  - SPI 驱动接口：https://xrobot.work/docs/basic_coding/driver/spi
- 自己完成的核心动作（以 I2C 为例，SPI 思路类似）：
  1. 在 .ioc 中开启一条 I2C 总线：配置 SCL / SDA 引脚为 I2C 功能，并启用该 I2C 外设。
  2. 重新生成 STM32 代码并运行 CodeGenerator，在 app_main.cpp 中找到对应的 STM32I2C 对象。
  3. 查阅 MPU6050 的资料，确认其 I2C 地址和 WHO_AM_I 寄存器地址。
  4. 在 app_main() 的 User Code 区域中：
     - 按文档说明，使用 STM32I2C 封装的读写接口向传感器写入寄存器地址，再读取 1 字节数据。
     - 将读取到的值通过串口打印出来。
  5. 程序运行后，观察串口输出的 WHO_AM_I 值是否与数据手册一致。
你也可以根据文档自行组合：只要改动范围不大、现有工程能稳定编译运行，并且你确实看过对应文档再动手，即可视为本节实践内容。
## 四、遇到问题时建议的查找顺序
当你在这个小实验中遇到“不会用”或“行为不对”时，可以按下面顺序排查：
1. STM32 代码生成文档（code_gen/stm32 下对应外设）：
   - CubeMX 中需要开启哪些外设、通道、DMA、中断。
   - CodeGenerator 生成了哪些对象（在 app_main.cpp 中叫什么名字）。
2. 外设驱动文档（basic_coding/driver 下对应外设）：
   - 抽象类有哪些基础接口。
   - 启用、配置、读写分别怎么调用。
3. C++ API 索引（https://jiu-xiao.github.io/libxr/）：
   - 查具体类和函数的签名、参数类型和返回值含义。
## 五、完成标准
- 能用自己的话说出：
  - STM32 代码生成文档主要负责说明“.ioc 配完之后，会生成哪些 C++ 对象和配置文件”。
  - 外设驱动文档负责说明“这些对象在 C++ 层面有哪些接口，可以做哪些操作”。
- 在现有 LibXR STM32 工程上，基于文档自选至少一个外设或组件：
  - 在 .ioc 中完成配置并重新生成代码。
  - 通过 CodeGenerator 更新工程后，在 app_main.cpp 中找到对应对象。
  - 在 User Code 区域加入一小段逻辑，成功编译并在板子上看到可观察的效果（如串口输出、LED 变化、传感器寄存器返回值等）。
- 遇到不确定的类型 / 函数时，能够主动去文档和 API 索引中查，而不是只依赖现成示例代码。
