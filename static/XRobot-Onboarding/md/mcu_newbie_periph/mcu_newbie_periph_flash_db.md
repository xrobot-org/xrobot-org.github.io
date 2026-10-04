## 参考资料
- STM32 Flash 数据库代码生成说明（重点看 flash_map.hpp 和使用示例）：
  https://xrobot.work/docs/code_gen/stm32/stm32-code-gen-flash
- Database 闪存数据库中间件文档：
  https://xrobot.work/docs/basic_coding/middleware/database
- LibXR C++ API 索引（查 STM32Flash / Database / Key 等类的具体接口）：
  https://xrobot.work/libxr/
- 视频（可选）：【LibXR STM32 C++ 代码生成工具 第四节-Flash数据库】
  https://www.bilibili.com/video/BV1UQGCzSE74
## 本任务目标
- 利用 CodeGenerator 已生成的 flash_map.hpp，在 app_main() 中创建一个 STM32Flash 对象。
- 基于 STM32Flash 创建一个 Flash 数据库（DatabaseRaw 或 DatabaseRawSequential），并定义至少 1 个键值。
- 实现一个最小示例：记录“开机次数”或一个简单配置参数，让它在复位后依然保留（存到 Flash，而不是丢在 RAM 里）。
## 一、前置条件与整体思路
开始之前，建议已经具备：
- 一个可以正常编译、下载、运行的 LibXR STM32 工程：
  - 已经接入 app_main()。
  - 至少实现过 LED 闪烁或串口输出。
- 已经运行过一次 libxr stm32 setup（或等价流程），工程中出现了 User/flash_map.hpp。
- 最好已经有一条可靠的串口输出路径，方便把数据库里的值打印出来做验证。
整体思路：
1. 利用 flash_map.hpp 里自动生成的扇区表，构造 STM32Flash 对象。
2. 在 STM32Flash 之上创建一个 Database 对象。
3. 定义一个 Database::Key<T>，在 app_main() 中读写这个键，验证“写入后复位仍然存在”。
## 二、认识 flash_map.hpp：Flash 扇区映射表
1. 打开 User/flash_map.hpp，可以看到类似内容：
   - MCU 型号说明。
   - 包含 main.h 和 stm32_flash.hpp。
   - constexpr LibXR::FlashRegion FLASH_REGIONS[] = {...};
   - constexpr size_t FLASH_REGION_NUMBER = sizeof(FLASH_REGIONS) / sizeof(LibXR::FlashRegion);
2. 概念：
   - FlashRegion：表示 Flash 中一段地址相接、大小相同的扇区（起始地址 + 扇区大小 + 扇区个数）。
   - FLASH_REGIONS：按地址顺序把整片 Flash 的各段放在一个数组里。
   - FLASH_REGION_NUMBER：段数。
3. 这个文件是自动生成的：
   - 不需要手动修改。
   - 只需要在 app_main.cpp 里直接使用 FLASH_REGIONS 和 FLASH_REGION_NUMBER 即可。
## 三、在 app_main() 中创建 STM32Flash 对象
1. 打开 User/app_main.cpp。
2. 确认已经包含 flash_map.hpp，如无则添加：#include "flash_map.hpp"。
3. 在 app_main() 中、各外设对象附近添加：
   - STM32Flash flash(FLASH_REGIONS, FLASH_REGION_NUMBER);
   - 第 1 个参数：扇区表；第 2 个参数：表的段数；
   - 可选第 3 个参数是“数据库存储区的起始地址”，须正好是某个扇区的起点；不写时默认使用最后两个扇区作为数据库区域。
## 四、选择数据库类型：DatabaseRaw vs DatabaseRawSequential
1. 如果是 STM32F1 / F4 等常见型号：
   - 使用 DatabaseRaw<4>：写入粒度 4 字节。
   - 示例：LibXR::DatabaseRaw<4> database(flash);
2. 如果是 STM32G4 / L4 等不支持“逆序写入”的型号：
   - 使用 DatabaseRawSequential：LibXR::DatabaseRawSequential database(flash, 128);
3. 建议把 database 和 flash 写在一起，方便在 app_main() 中使用。
## 五、定义一个键：用 Flash 记住“开机次数”
1. 在 app_main() 中、database 附近定义键：
   - LibXR::Database::Key<uint32_t> boot_count(database, "boot_count", 0u);
2. 在 app_main() 初始化阶段（主循环之前）：
   - boot_count.Load();  // 从 Flash 加载当前值，若不存在则使用默认值 0。
   - uint32_t current = static_cast<uint32_t>(boot_count);
   - boot_count.Set(current + 1);  // 每次上电或复位时自增并写回 Flash。
3. 可选：通过串口打印当前开机次数：
   - LibXR::STDIO::Printf("Boot count = %lu\r\n", (unsigned long)static_cast<uint32_t>(boot_count));
## 六、构建、下载并验证 Flash 数据库
1. 构建工程，确认 STM32Flash / Database / Key 相关代码无编译错误。
2. 下载程序到开发板并运行，打开串口或终端。
3. 观察输出：
   - 第一次运行：Boot count = 1（或 0 → 1）。
   - 按复位键再次运行：Boot count 递增为 2、3...
说明：
- 复位 / 重新上电不会擦除数据库扇区，值会累积。
- 若重新下载固件且执行“全擦除”，数据库会被清空，计数从默认值重新开始。
## 七、可选延伸：用终端命令读写数据库键值
- 如果已经开启 Terminal + RamFS，可以：
  - 在 RamFS 中创建一个可执行文件。
  - 在里面读写 boot_count，并把结果打印出来。
  - 通过终端命令触发执行，查看键值变化。
## 完成标准
- 在 app_main.cpp 中正确创建 STM32Flash 对象和 Database 对象（DatabaseRaw<4> 或 DatabaseRawSequential）。
- 定义了至少一个 Database::Key<T>，并在 app_main() 中完成“加载 → 修改 → Set 写回”的基本流程。
- 通过串口输出等方式，成功观察到某个值在复位后仍然保持；对于“开机计数”的示例，数值应随复位次数递增。
- 能说明：
  - flash_map.hpp 是自动生成的扇区映射表。
  - STM32Flash 封装了对这些扇区的访问。
  - Database 负责在 Flash 上做键值存储。
  - Database::Key<T> 让你用“变量 + Set()”的方式读写键值，实际数据保存在 Flash 中。
