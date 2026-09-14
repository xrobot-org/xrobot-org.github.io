## 参考资料
- STM32 GPIO 代码生成（CodeGenerator）：https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-gpio
- STM32 PWM 代码生成（CodeGenerator）：https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-pwm
- LibXR GPIO 驱动文档：https://xrobot.work/docs/basic_coding/driver/gpio
- LibXR PWM 驱动文档：https://xrobot.work/docs/basic_coding/driver/pwm
- 视频（可选）：【STM32 + VS Code】花式点灯（GPIO、外部中断与 PWM）- XRobot 官方教程 1.1 节
  https://www.bilibili.com/video/BV1kaWhzNE2t
## 本任务目标
在前一节“LED 闪烁”的基础上，对同一个 LibXR 工程分三步扩展：
1. 先把按键配置成普通输入，通过轮询读取按键状态控制 LED。
2. 再把按键改为外部中断，引脚中断回调里直接翻转 LED。
3. 最后为 LED 配置 PWM 输出，用占空比控制亮度（例如多档亮度或简单“呼吸灯”）。
## 前置条件
- 已完成“在 app_main() 中用 LibXR GPIO 实现第一个 LED 闪烁”，当前工程可以正常编译和下载。
- 工程中已经接入 app_main()，LED 的 STM32GPIO 对象在 app_main.cpp 中可见。
## 一、阶段 1：按键作为普通输入，轮询控制 LED
1. 在 STM32CubeMX 中配置按键引脚：
   - 打开当前 .ioc 工程，选择一个实际接了按键的引脚。
   - 将模式设置为 GPIO Input。
   - 根据硬件电路选择上拉或下拉，例如：
     - 按键一端接地，未按下时希望为高电平，则配置为上拉输入。
2. 重新生成 STM32CubeMX 代码，并重新运行 LibXR 代码生成：
   - 在 STM32 工程根目录运行一遍代码生成流程（例如 xr_cubemx_cfg -d .）。
   - 打开 User/app_main.cpp，找到新生成的按键对象，例如：STM32GPIO USER_KEY(USER_KEY_GPIO_Port, USER_KEY_Pin);
3. 在 app_main() 中使用轮询读取按键：
   - 在 app_main() 的主循环所在 User Code 区块中：
     - 在 while(1) 内，每次循环调用 USER_KEY.Read() 读取电平。
     - 根据接线方式决定是否对读到的布尔值取反（例如上拉输入时，按下为 0，需要取反才表示“按下”）。
     - 在检测到按下时，切换一个本地“LED 状态”变量，并调用 LED 对象的 Write(true/false)。
     - 在循环末尾调用 LibXR::Thread::Sleep(...) 控制轮询周期，同时起到简单去抖的作用。
## 二、阶段 2：为按键启用外部中断，在中断回调里直接翻转 LED
1. 在 STM32CubeMX 中启用按键的 EXTI 功能：
   - 保持前面“输入 + 合理上下拉”的配置不变。
   - 在 EXTI 配置中，为该按键引脚分配一个外部中断通道（例如 EXTI0、EXTI1 等），触发边沿可根据需要选择上升沿、下降沿或双沿。
   - 确认 NVIC 中对应 EXTI 中断通道已启用。
2. 再次生成 STM32CubeMX 代码，并重新运行 LibXR 代码生成：
   - 在工程根目录再跑一次代码生成流程。
   - 打开 User/app_main.cpp，检查按键对象构造方式是否变为类似：STM32GPIO USER_KEY(USER_KEY_GPIO_Port, USER_KEY_Pin, EXTI0_IRQn);
3. 在 app_main() 中为按键注册中断回调并使能中断：
   - 在按键对象定义之后、主循环之前：
     - 调用 USER_KEY.RegisterCallback(...) 注册一个回调。
     - 在回调中直接操作 LED 对象，例如：读取当前状态后写入相反状态，实现“每次中断翻转 LED”。
     - 调用 USER_KEY.EnableInterrupt() 使能中断。
4. 简化主循环逻辑：
   - 主循环仍然使用 while(1) 和 LibXR::Thread::Sleep(...) 保持循环节奏。
   - 此时不再在循环里轮询按键电平，而是完全依赖外部中断回调处理按键事件。
## 三、阶段 3：为 LED 配置 PWM 输出，调节亮度
1. 在 STM32CubeMX 中为 LED 配置 PWM：
   - 选择一个定时器（例如 TIMx），把某个通道配置为 PWM 输出模式。
   - 将该 PWM 通道的输出引脚连接到实际用于点亮 LED 的引脚。
   - 保持默认频率与计数设置即可，后续用占空比调节亮度。
2. 重新生成 STM32CubeMX 代码，并重新运行 LibXR 代码生成：
   - 在 User/app_main.cpp 中，查找与该定时器通道对应的 STM32PWM 对象，例如：STM32PWM pwm_tim1_ch1(&htim1, TIM_CHANNEL_1, false);
3. 在 app_main() 中启用 PWM，并通过 SetDutyCycle 控制亮度：
   - 在主循环之前，对 PWM 对象调用 Enable()。
   - 在主循环中，周期性调整占空比：
     - 例如在 0.0 ~ 1.0 之间递增，再在 1.0 ~ 0.0 之间递减，配合 LibXR::Thread::Sleep(...) 实现一个简单的“亮度渐变”。
     - 或者划分几个固定档位（例如 0.2、0.5、0.8），每次按键中断回调里切换到下一档，并在回调中调用 SetDutyCycle(...) 更新占空比。
4. 与按键中断结合使用（可选）：
   - 按键中断回调不再翻转 LED 开关，而是调整一个“当前亮度档位”，再调用 PWM 对象的 SetDutyCycle(...)。
   - 主循环只负责适当 Sleep 保持程序运行节奏，不再直接操作 LED。
## 完成标准
- 阶段 1：按键作为普通输入，通过轮询 Read() 的方式控制 LED 开关，现象稳定。
- 阶段 2：按键配置为外部中断后，在中断回调里直接翻转 LED，按下立即有变化。
- 阶段 3：为 LED 配置 PWM 后，可以通过 SetDutyCycle(...) 明显改变 LED 亮度，可选地用按键在不同亮度档位之间切换。
- 能够说清：
  - CubeMX 中对 GPIO 输入、EXTI 和 PWM 的三次配置分别带来了哪些 STM32GPIO / STM32PWM 对象变化。
  - 自己在 app_main() 的哪些 User Code 区块中添加了按键逻辑、中断回调和 PWM 亮度控制。
