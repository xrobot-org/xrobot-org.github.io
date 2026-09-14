## 本任务目标
- 把本章出现的几块内容（更多外设、USB 串口与 I/O 抽象、终端 + RamFS、Flash 数据库）放在一张“脑内总图”里，而不是四个互不相干的小 demo。
- 明确一套可重复使用的套路：
  - 想加一个能力时，应该先改哪里（CubeMX / 配置 / 代码）。
  - 应该看哪类文档。
  - 以及如何在 app_main() 的 User Code 里做最小验证。
## 一、你已经接触过哪些“新东西”？
- 更多外设封装（ADC / SPI / I2C / PWM / CAN 等）：
  - CubeMX：配置外设、IO、DMA、中断。
  - LibXR STM32XXX 封装类：STM32ADC、STM32SPI、STM32I2C 等。
  - 抽象层：basic_coding/driver/ 下的 ADC、SPI、I2C 等基类。
- USB 串口与统一 I/O 抽象：
  - 硬件串口：STM32UART + DMA + 中断。
  - USB CDC：XRUSB + CDCUart。
  - 统一层：ReadPort / WritePort + Operation，RawData / ConstRawData 封装缓冲区。
- 终端（Terminal）+ RamFS：
  - 终端：命令行解释器，跑在某个 ReadPort / WritePort 上。
  - RamFS：内存文件系统，保存可执行文件、配置、设备节点等。
- Flash 数据库（Database）：
  - 底层：STM32Flash（使用 flash_map.hpp 的扇区布局）。
  - 中间：DatabaseRaw / DatabaseRawSequential。
  - 上层：Database::Key<T> 这种类型安全键。
## 二、共同套路：配置 → 生成 → 找对象 → User Code 里试用
1. 改配置（CubeMX / YAML）：
- 外设：CubeMX 里打开对应外设（GPIO / ADC / SPI / I2C / UART / USB / CAN 等），打开中断 / DMA。
- 中间件 / 高级行为：在 .config.yaml / libxr_config.yaml 中配置终端、USB、Flash 数据库等行为。
2. 重新生成（CodeGenerator）：
- 在工程根目录跑 xr_cubemx_cfg -d .，刷新 .config.yaml、app_main.cpp、flash_map.hpp 等。
3. 找对象（app_main.cpp / flash_map.hpp）：
- 在 app_main.cpp 中搜索 STM32ADC / STM32SPI / STM32I2C / STM32UART / CDCUart / Terminal / RamFS / Database 等对象。
- 在 flash_map.hpp 中确认 Flash 扇区布局。
4. 在 User Code 里写最小实验：
- GPIO：点灯 / 读按键。
- UART / USB：打印一行字符串。
- SPI / I2C：读 WHO_AM_I。
- Terminal：输入一条命令有回显。
- Database：写一个计数或配置，复位后仍然保留。
## 三、如何给“新外设 / 新中间件”开路？
1. 先问：“这是外设还是中间件？”
- 外设：先看 code_gen/stm32 + basic_coding/driver。
- 中间件（终端 / 数据库 / 事件 / 日志等）：先看 basic_coding/middleware。
2. 再问：“配置在哪改？”
- STM32 引脚、时钟、DMA、中断 → CubeMX。
- LibXR 行为（buffer、队列长度、是否启用终端 / USB / Database 等） → YAML 配置。
3. 最后问：“能不能先做一个最小 demo？”
- ADC：读一次并打印一个数。
- I2C：读一个寄存器值。
- UART / USB：打印一行字符串。
- Terminal：输入一条命令有回显。
- Database：写一个值，复位后读回来。
## 四、文档和 API 的使用习惯
建议固定一个查资料顺序：
1. 当前路线里的任务说明：
   - 优先看当前节的说明和示例，通常已经筛过重点。
2. XRobot / LibXR 文档：
   - code_gen/stm32/...：看“CubeMX + YAML 怎么生成代码”。
   - basic_coding/driver/...：看“外设抽象类有哪些接口”。
   - basic_coding/middleware/...：看“终端、数据库、事件等中间件行为和用法”。
3. C++ API 索引：https://xrobot.work/libxr/
   - 搜索类名（STM32UART、STM32Flash、Database、Terminal、RamFS 等），看函数签名与注释。
4. GitHub README 与示例：
   - 不确定某仓库负责什么时，看 README 即可；
   - 有时能找到最小用法片段直接参考。
## 五、心理建设：你不需要一次记住所有 API
这一章出现的新名词很多（SPI / I2C / RawData / Operation / Terminal / RamFS / Database...），记不住是正常的：
- 不需要背所有类名和函数名。
- 关键是：
  - 大概知道它们“干什么”。
  - 知道“要用的时候去哪查、查哪类文档”。
只要这两点清楚，反复查几次后，自然会变成熟面孔。
## 完成标准
- 能用自己的话回答：
  - 如果要新增一个外设（比如 I2C + 某个传感器），打算先在哪改配置，然后在哪跑生成，最后在 app_main() 的哪个区域实验？
  - 外设相关问题，应先看 code_gen/stm32 还是 basic_coding/driver？
  - 终端 / RamFS / Database 这类“中间件”，大概负责哪一层的工作？
- 接受这样一个事实：
  - 不可能一次性记住 LibXR 的所有 API。
  - 但你已经有了一套可重复使用的套路：
    - 改配置 → 重新生成 → 找对象 → 在 User Code 里做最小实验 → 看不懂就回文档 / API 查。
