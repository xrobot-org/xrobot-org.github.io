---
id: proj-man-config
title: 应用配置
sidebar_position: 2
---

# 应用配置

应用配置描述一个产品：按顺序构造哪些模块实例、每个构造参数的值。`User/` 下除 `User/libxr_config.yaml` 以外的每个 `*.yaml`（含子目录）都是应用配置，`xrobot setup` 会检查全部配置。

---

## 选择产品

```bash
xrobot gen -c User/RobotConfig/hero.yaml
```

`xrobot gen -c` 为指定配置生成 `User/xrobot_main.hpp`，即选中该产品。头文件开头记录了配置和生成时读取的每个文件；`xrobot gen`（不带 `-c`）和 `xrobot setup` 沿用当前选择，没有生成过时使用 `User/xrobot.yaml`。选中的配置被删除或改名后，这些命令报错，需要用 `xrobot gen -c` 重新选择。

---

## 格式

```yaml
constexpr_namespace: BoardConfig        # 默认 ProjectConstexpr
constexpr_includes:
  - RMMotor.hpp
constexprs:
  YawFeedbackId:
    type: uint16_t
    value: 522
modules:
  - module: xrobot-org/BlinkLED
    id: blink_led
    args:
      - led: LED_B
      - blink_cycle: 250
  - module: QDU-Robomaster/RMMotor
    id: motor_yaw
    args:
      - can_bus: can2
      - param:
          model: RMMotor::Model::MOTOR_GM6020
          reverse: false
          feedback_id: BoardConfig::YawFeedbackId
settings:
  monitor_sleep_ms: 1000
```

顶层只允许 `modules`、`settings`、`constexprs`、`constexpr_namespace`、`constexpr_includes`。

每个实例：

| 键 | 含义 |
| --- | --- |
| `module` | 模块 `owner/Repo`，必须在 `xrobot.lock` 中 |
| `id` | 实例名，即生成的 C++ 对象名 |
| `template_args` | 模板实参列表，C++ 文本（模块是类模板时） |
| `args` | 构造参数列表，每项 `- 参数名: 值` |

- 实例按列表顺序构造，也按此顺序调用 `OnMonitor()`。只能引用排在前面的实例。
- `args` 必须按顺序写出某一个公有构造函数的全部参数；参数名决定使用哪个构造函数（重载时再按显式类型区分）。
- `id` 必须是 C++ 标识符，不能是关键字、宏名、`std`/`LibXR` 等保留名，不能以 `xr_`、`XR_`、`xrobot_` 开头，不能与注册名或模块类名相同（用小写名，如 `bmi088`）。
- `standalone: false` 的库模块不能实例化。

---

## 值

不加引号或用单引号的值是 C++ 代码，按原样写入生成代码；双引号的值是 C++ 字符串：

```yaml
- blink_cycle: 250
- mode: CMD::Mode::CMD_OP_CTRL
- topic_name: "bmi088_gyro"
- rotation: '{0.707, 0.0, 0.0, 0.707}'
- referee: '&ref'
```

`topic_name` 在生成代码中是 `"bmi088_gyro"`，其余各项与写法相同。YAML 不能直接写出的代码放在单引号中，例如以 `{`、`[`、`&`、`*` 开头的文本；单引号中的文本不做转换，`''` 表示一个单引号。双引号中的转义按 YAML 规则处理后写成 C++ 字符串字面量。

`xrobot format` 和编辑命令按同一规则写值：代码在 YAML 允许时不加引号，否则加单引号；字符串用双引号。块格式和流格式（`[...]`、`{...}`）保持原样，流格式中含逗号的代码也加单引号。

- `null`、`~` 和空值表示"未填写"，生成时报错；空指针写 `nullptr`。
- 值内不能写 C++ 注释（用 YAML 的 `#` 注释），整数不能以 `0` 开头（C++ 会按八进制解析）。
- 不支持 YAML 锚点、别名和标签；共享的值写在 `constexprs` 中。

### 依赖参数

没有默认值的引用或指针参数是依赖参数，值可以是：

- 入口源文件中 `XR_REGISTER` 注册的名字；
- 排在前面的实例 `id`；
- `'&名字'`（参数是指针时）；
- `nullptr`（参数是指针时）。

可选依赖在模块中声明为没有默认值的指针参数，配置中写 `nullptr` 即不使用。名字错误时给出同类型的候选：

```text
User/xrobot.yaml: status_led.args.led: LED_X is neither an XR_REGISTER name nor an earlier instance id; candidates of type LibXR::GPIO&: LED_R
```

### 结构体与类

参数类型是模块头文件中定义的结构体或类时，写成映射：

- 聚合体：按声明顺序写出全部字段；
- 有构造函数的类：按顺序写出某个构造函数的全部参数。

模块头文件指已锁定模块根目录下的 `*.hpp`，以及它们用 `#include "..."` 引入、位于模块目录内的头文件。字段可以嵌套映射。对这类类型，位置列表和位置花括号（`{1, 2, 3}`）会被拒绝，指定初始化器（`{.a = 1, .b = 2}`）按映射检查。其他类型（如 LibXR 或标准库类型）可以写任意 C++ 表达式，包括花括号；参数默认值用指定初始化器写出了字段时，也可以写成映射，按默认值中的字段名检查。

以 LibXR 的 `PID<float>::Param` 为例，模块把默认值写成 `{.k = 1.0f, .p = 0.0f, .i = 0.0f, .d = 0.0f, .i_limit = 0.0f, .out_limit = 0.0f, .cycle = false}` 时，`xrobot instance add` 写出映射，映射需列出默认值中的全部字段，`xrobot gen` 检查字段名，`xrobot instance set` 可以单独修改其中一项。同一个值也可以写成一行指定初始化器，只写与默认成员初始化不同的字段，由编译器检查：

```yaml
- pid_param:            # 映射 / mapping
    k: 1.0
    p: 30.0
    i: 0.0
    d: 1.0
    i_limit: 0.0
    out_limit: 0.0
    cycle: true
- pid_param: '{.p = 30.0, .d = 1.0, .cycle = true}'   # 一行指定初始化器 / designated initializer
```

模块新版本增减字段或参数后运行 `xrobot sync`：新增的写入源码默认值，删除的去掉，已有的值保持不变。`xrobot setup --update` 会自动执行这一步。

### 常量

`constexprs` 中的每项生成 `inline constexpr <type> <名字> = <value>;`，位于 `constexpr_namespace` 命名空间中，配置里用 `命名空间::名字` 引用。常量之间可以互相引用；类型所需的头文件写在 `constexpr_includes`。

### settings

`settings` 只有 `monitor_sleep_ms`：主循环每轮调用完 `OnMonitor()` 后休眠的毫秒数，默认 1000。

---

## 编辑命令

以下命令保留注释，并按 `xrobot format` 的规范格式写入；不带 `-c` 时编辑当前选中的产品。

```bash
xrobot instance add owner/Repo [--id ID] [--template-arg VALUE]...
                                              # 按构造函数写出全部参数及默认值
xrobot instance set ID args.led LED_B
xrobot instance set ID args.param.reverse true
xrobot instance set ID args.topic_name '"bmi088_gyro"'
xrobot instance set ID template_args[0] float
xrobot instance rename ID NEW_ID              # 同时改写本配置中对它的引用
xrobot instance remove ID
xrobot sync [-c CONFIG]...
xrobot format [--check] [-c CONFIG]...
```

`set` 的值按配置中值的规则读取：不加引号或用单引号的是 C++ 代码，双引号的是 C++ 字符串。加 `--json` 时值按 JSON 读取，JSON 字符串是 C++ 文本，VS Code 插件用这种方式写入。路径是 `template_args[n]` 或 `args.<参数>[.<字段>|[n]]...`，实例 id 用 `rename` 修改，它同时改写对该实例的引用；`args` 本身可以整体替换为一个列表，用于换用另一个构造函数。`--if-match <sha256>` 在文件已被修改时拒绝写入（值为按 LF 规范化后文件内容的 SHA-256）。

`xrobot describe` 以 JSON 输出生成器读取和检查的全部内容：配置列表与当前产品、头文件是否过期、工具版本、锁定的模块、构造函数签名、映射需要的字段、注册名与类型、每个参数可绑定的名字以及诊断信息。VS Code 插件基于它显示和编辑配置。

---

## 错误定位

配置错误报告 `<配置>: <实例>.args.<参数>: 原因`。生成的代码带 `#line` 指令，C++ 编译错误会指向 YAML 中对应的行。
