## 参考资料
- STM32 代码生成 · GPIO 示例：https://xrobot-org.github.io/docs/code_gen/stm32/stm32-code-gen-gpio
- LibXR GPIO 抽象接口说明：https://xrobot-org.github.io/docs/basic_coding/driver/gpio
- 视频（可选）：【STM32 + VS Code】花式点灯（GPIO、外部中断与 PWM）- XRobot 官方教程 1.1 节
  https://www.bilibili.com/video/BV1kaWhzNE2t
本任务只做最基础的“点灯”，外部中断和 PWM 会在后续章节单独说明。
## 本任务目标
- 在已经集成 LibXR 的 STM32 工程中，不使用 XRobot，只依靠 LibXR 生成的 GPIO 封装，让开发板上的一个 LED 周期性闪烁。
- 建立基本印象：一个 STM32GPIO 对象对应一个实际引脚，写 true/false 控制亮灭，延时用 LibXR::Thread::Sleep 控制节奏。
## 前置条件
- 已完成「认识生成后的 LibXR 工程并接入 app_main()」，当前工程可以正常构建和下载。
- 在 STM32CubeMX 的 .ioc 中，已经为某个实际连在 LED 上的引脚配置了输出模式（例如配置为 GPIO_Output），并在修改 .ioc 后重新跑过一次代码生成工具（如 libxr stm32 setup）。
- User/app_main.cpp 中可以找到由 LibXR 为该引脚生成的 STM32GPIO 对象。
## 步骤 1：确认 LED 对应的 GPIO 对象
1. 在 STM32CubeMX 中打开 .ioc，确认：
   - 至少有一个引脚被配置为输出模式，并连接到真实存在的 LED（板载 LED 或你接出的 LED）。
   - 引脚名称（例如 PA5）和实际硬件连线一致。
2. 在 VS Code 中打开 User/app_main.cpp，找到 GPIO 初始化那一段：
   - 普通输入输出引脚通常类似：STM32GPIO gpioA0(GPIOA, GPIO_PIN_0);
   - 实际工程中多为带语义名的对象，例如：STM32GPIO LED_B(LED_B_GPIO_Port, LED_B_Pin);
   - 本任务只用这种“普通输入输出”的 STM32GPIO 对象（不带 EXTI 参数的构造函数）。
3. 记下你准备用来点灯的对象名称，例如 LED_B 或 gpioA0，后续代码将直接操作这个对象。
## 步骤 2：在 app_main() 中找到用户代码区块
1. 在 app_main.cpp 中定位 app_main() 函数。
2. 向下滚动，找到靠近主循环的 User Code 区块，一般类似：
   - /* User Code Begin 3 */
   - ...
   - /* User Code End 3 */
3. 确认你要写逻辑的 while(1) 循环位于这个 User Code 区块内部：
   - 如果已经有 while(1)，准备在循环内部填点灯代码。
   - 如果没有 while(1)，可以在 User Code 区块中自己写一个 while(1) 作为应用主循环。
## 步骤 3：用 STM32GPIO + LibXR::Thread::Sleep 写出闪烁逻辑
1. 在上一步确定的 User Code 区块里，使用前面识别出的 GPIO 对象（下面用 led 代称）：
   - 在 while(1) 循环内，按如下思路编写逻辑：
     - led.Write(true);
     - LibXR::Thread::Sleep(若干毫秒);
     - led.Write(false);
     - 再 Sleep 一次。
     - 循环重复。
2. 延时统一使用 LibXR::Thread::Sleep(...)：
   - 例如 LibXR::Thread::Sleep(500); 表示延时约 500 ms。
3. 不同开发板上的 LED 极性可能不同：
   - 如果发现 true 时灯灭、false 时灯亮，可以在代码中反过来写，或适当调整判断逻辑。
## 步骤 4：构建、下载并验证现象
1. 在 VS Code 中通过 STM32 插件构建工程：
   - 确认刚才添加的点灯代码没有导致编译错误或链接错误。
2. 构建通过后，使用你已经配置好的调试／下载方式（ST-LINK、J-LINK 或 DAPLink 等）把程序写入开发板。
3. 让程序运行，观察 LED：
   - 如果一明一灭、有明确节奏，说明 GPIO 对象和 Sleep 调用工作正常。
   - 如果始终不亮或常亮：
     - 回头检查 .ioc 中引脚配置是否正确。
     - 确认你操作的是正确的 STM32GPIO 对象。
     - 视情况反转 true/false 的含义重新尝试。
## 完成标准
- 工程可以正常构建并成功下载到开发板。
- 至少有一个 LED 能按照你设定的周期闪烁，现象稳定可复现。
- 你清楚：
  - 这个 LED 对应的 STM32GPIO 对象在 app_main.cpp 里的定义位置。
  - 你在 app_main() 的哪个 User Code 区块里写了点灯逻辑。
  - 延时是通过 LibXR::Thread::Sleep 控制的，后续要做更复杂的 GPIO 行为时可以在此基础上扩展。
