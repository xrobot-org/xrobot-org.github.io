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

`xrobot gen -c` 为指定配置生成 `User/xrobot_main.hpp`，即选中该产品。头文件开头记录了配置和生成时读取的每个文件；`xrobot gen`（不带 `-c`）和 `xrobot setup` 沿用当前选择，没有生成过时使用 `User/xrobot.yaml`。

---

## 格式

```yaml
constexpr_namespace: BoardConfig        # 默认 ProjectConstexpr
constexpr_includes:
  - RMMotor.hpp
constexprs:
  YawFeedbackId:
    type: uint16_t
    value: '522'
modules:
  - module: xrobot-org/BlinkLED
    id: blink_led
    args:
      - led: LED_B
      - blink_cycle: '250'
  - module: QDU-Robomaster/RMMotor
    id: motor_yaw
    args:
      - can_bus: can2
      - param:
          model: RMMotor::Model::MOTOR_GM6020
          reverse: 'false'
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

值是 C++ 文本，按原样写入生成代码：

```yaml
- blink_cycle: '250'
- topic_name: '"bmi088_gyro"'          # C++ 字符串字面量要带引号
- mode: CMD::Mode::CMD_OP_CTRL
- rotation: '{0.707, 0.0, 0.0, 0.707}'
```

- `null`、`~` 和空值表示"未填写"，生成时报错；空指针写 `nullptr`。
- 值内不能写 C++ 注释（用 YAML 的 `#` 注释），整数不能以 `0` 开头（C++ 会按八进制解析）。
- 不支持 YAML 锚点、别名和标签；共享的值写在 `constexprs` 中。

### 依赖参数

没有默认值的引用或指针参数是依赖参数，值可以是：

- 入口源文件中 `XR_REGISTER` 注册的名字；
- 排在前面的实例 `id`；
- `&名字`（参数是指针时）；
- `nullptr`（参数是指针时）。

可选依赖在模块中声明为没有默认值的指针参数，配置中写 `nullptr` 即不使用。名字错误时给出同类型的候选：

```text
User/xrobot.yaml: status_led.args.led: LED_X is neither an XR_REGISTER name nor an earlier instance id; candidates of type LibXR::GPIO&: LED_R
```

### 结构体与类

参数类型是模块头文件中定义的结构体或类时，写成映射：

- 聚合体：按声明顺序写出全部字段；
- 有构造函数的类：按顺序写出某个构造函数的全部参数。

字段可以嵌套映射。对这类类型，位置列表和位置花括号（`{1, 2, 3}`）会被拒绝，指定初始化器（`{.a = 1, .b = 2}`）按映射检查。其他类型（如 LibXR 或标准库类型）可以写任意 C++ 表达式，包括花括号。

模块新版本增减字段或参数后运行 `xrobot sync`：新增的写入源码默认值，删除的去掉，已有的值保持不变。`xrobot setup --update` 会自动执行这一步。

### 常量

`constexprs` 中的每项生成 `inline constexpr <type> <名字> = <value>;`，位于 `constexpr_namespace` 命名空间中，配置里用 `命名空间::名字` 引用。常量之间可以互相引用；类型所需的头文件写在 `constexpr_includes`。

### settings

`settings` 只有 `monitor_sleep_ms`：主循环每轮调用完 `OnMonitor()` 后休眠的毫秒数，默认 1000。

---

## 编辑命令

以下命令保留注释，并按 `xrobot format` 的规范格式写入；不带 `-c` 时编辑当前选中的产品。

```bash
xrobot instance add owner/Repo [--id ID]      # 按构造函数写出全部参数及默认值
xrobot instance set ID args.led '"LED_B"'     # VALUE 是 JSON
xrobot instance set ID args.param.reverse '"true"'
xrobot instance set ID template_args[0] '"float"'
xrobot instance rename ID NEW_ID              # 同时改写本配置中对它的引用
xrobot instance remove ID
xrobot sync [-c CONFIG]...
xrobot format [--check] [-c CONFIG]...
```

`set` 的路径是 `id`、`template_args[n]` 或 `args.<参数>[.<字段>|[n]]...`；`args` 本身可以整体替换为一个列表，用于换用另一个构造函数。`--if-match <sha256>` 在文件已被修改时拒绝写入（值为按 LF 规范化后文件内容的 SHA-256）。

`xrobot describe` 以 JSON 输出生成器读取和检查的全部内容：配置列表与当前产品、头文件是否过期、工具版本、锁定的模块、构造函数签名、映射需要的字段、注册名与类型、每个参数可绑定的名字以及诊断信息。VS Code 插件基于它显示和编辑配置。

---

## 错误定位

配置错误报告 `<配置>: <实例>.args.<参数>: 原因`。生成的代码带 `#line` 指令，C++ 编译错误会指向 YAML 中对应的行。
