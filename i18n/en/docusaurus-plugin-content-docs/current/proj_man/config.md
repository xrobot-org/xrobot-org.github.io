---
id: proj-man-config
title: Application Configuration
sidebar_position: 2
---

# Application Configuration

A configuration describes one product: which Module instances are constructed, in which order, and the value of every constructor parameter. Every `*.yaml` under `User/` (including subdirectories) except `User/libxr_config.yaml` is a configuration, and `xrobot setup` checks all of them.

---

## Selecting a Product

```bash
xrobot gen -c User/RobotConfig/debug.yaml
```

`xrobot gen -c` generates `User/xrobot_main.hpp` for that configuration, which selects that configuration. The header's last lines record the configuration and every file generation read. `xrobot gen` without `-c` and `xrobot setup` keep the current selection, or use `User/xrobot.yaml` when nothing was generated yet. If the selected configuration has been deleted or renamed, these commands report an error and a configuration has to be selected again with `xrobot gen -c`.

---

## Format

```yaml
constexpr_namespace: BoardConfig        # default: ProjectConstexpr
constexpr_includes:
  - <cstdint>
constexprs:
  BlinkCycle:
    type: uint32_t
    value: 250
modules:
  - module: xrobot-org/BlinkLED
    id: blink_led
    args:
      - led: LED_B
      - blink_cycle: BoardConfig::BlinkCycle
  - module: xrobot-org/MadgwickAHRS
    id: ahrs
    args:
      - ramfs: ramfs
      - param:
          beta: 0.033
          gyro_topic_name: "bmi088_gyro"
          accl_topic_name: "bmi088_accl"
          quaternion_topic_name: "ahrs_quaternion"
          euler_topic_name: "ahrs_euler"
          task_stack_depth: 1536
settings:
  monitor_sleep_ms: 1000
```

Top-level keys are limited to `modules`, `settings`, `constexprs`, `constexpr_namespace` and `constexpr_includes`.

Each instance:

| Key | Meaning |
| --- | --- |
| `module` | The Module `owner/Repo`; it must be in `xrobot.lock` |
| `id` | Instance name, the name of the generated C++ object |
| `template_args` | Template arguments as C++ text (for class templates) |
| `args` | Constructor arguments, each `- name: value` |

- Instances are constructed, and their `OnMonitor()` called, in list order. An instance can only refer to earlier instances.
- `args` names every parameter of one public constructor, in order; the names select the constructor (overloads with equal names are told apart by explicit types).
- `id` must be a C++ identifier that is not a keyword, a macro name or a reserved name such as `std`/`LibXR`; it must not start with `xr_`, `XR_` or `xrobot_`, and must not equal a registered name or a Module class name (use a lower-case id such as `bmi088`).
- Libraries with `standalone: false` cannot be instantiated.

---

## Values

A value without quotes or in single quotes is C++ code, written into the generated code as-is; a double-quoted value is a C++ string:

```yaml
- blink_cycle: 250
- gyro_freq: BMI088::GyroFreq::GYRO_2000HZ_BW532HZ
- topic_name: "bmi088_gyro"
- rotation: '{0.707, 0.0, 0.0, 0.707}'
- ramfs: '&ramfs'
```

In the generated code `topic_name` is `"bmi088_gyro"`; the other values are as written. Code that YAML cannot take without quotes goes in single quotes, for example text starting with `{`, `[`, `&` or `*`; text in single quotes is not changed, and `''` stands for one single quote. Escapes in double quotes are resolved by YAML, and the result is written as a C++ string literal.

`xrobot format` and the edit commands write values by the same rule: code without quotes where YAML allows it and in single quotes otherwise, strings in double quotes. Block and flow style (`[...]`, `{...}`) are kept; inside flow style, code containing a comma is also single-quoted.

- `null`, `~` and an empty value mean "not filled in" and generation refuses them; write `nullptr` for a null pointer.
- A value cannot contain C++ comments (use a YAML `#` comment), and an integer cannot start with `0` (C++ would read it as octal).
- YAML anchors, aliases and tags are rejected; share values through `constexprs`.

### Dependency Parameters

A reference or pointer parameter without a default is a dependency. Its value is one of:

- a name registered with `XR_REGISTER` in the entry source;
- the `id` of an earlier instance;
- `'&name'` or `name` (for a pointer parameter; both pass the object's address);
- `nullptr` (for a pointer parameter).

An optional dependency is declared by the Module as a pointer parameter without a default; `nullptr` leaves it unused. A wrong name is reported with the candidates of the right type:

```text
User/xrobot.yaml: status_led.args.led: LED_X is neither an XR_REGISTER name nor an earlier instance id; candidates of type LibXR::GPIO&: LED_R
```

### Structs and Classes

When a parameter's type is a struct or class defined in a Module header, write a mapping:

- an aggregate lists all its fields in declaration order;
- a class with constructors lists all parameters of one constructor, in order.

Module headers are the `*.hpp` in the root folder of a locked Module and the headers inside the Module folder that they bring in with `#include "..."`. Mappings can nest. For such types, positional lists and positional braces (`{1, 2, 3}`) are rejected; designated initializers (`{.a = 1, .b = 2}`) are checked like mappings. Other types (for example LibXR or standard library types) accept any C++ expression, including braces; when the parameter's default names the fields with a designated initializer, a mapping is accepted too and checked against those field names.

Take LibXR's `PID<float>::Param`: when a Module writes the default as `{.k = 1.0f, .p = 0.0f, .i = 0.0f, .d = 0.0f, .i_limit = 0.0f, .out_limit = 0.0f, .cycle = false}`, `xrobot instance add` writes a mapping. The mapping lists every field of the default, `xrobot gen` checks the field names, and `xrobot instance set` can change one field. The same value can also be written as a one-line designated initializer that names only the fields that differ from their default member initializers; the compiler checks it:

```yaml
- pid_param:            # mapping
    k: 1.0
    p: 30.0
    i: 0.0
    d: 1.0
    i_limit: 0.0
    out_limit: 0.0
    cycle: true
- pid_param: '{.p = 30.0, .d = 1.0, .cycle = true}'   # designated initializer
```

After a new Module version adds or removes fields or parameters, run `xrobot sync`: new ones are written with their source defaults, removed ones are dropped, and existing values are kept. `xrobot setup --update` does this automatically.

### Constants

Each entry in `constexprs` becomes `inline constexpr <type> <name> = <value>;` in the `constexpr_namespace` namespace; configurations refer to it as `Namespace::name`. Constants may use each other; headers their types need go in `constexpr_includes`.

### settings

`settings` has one key, `monitor_sleep_ms`: the milliseconds the main loop sleeps after each round of `OnMonitor()` calls (default 1000).

---

## Editing Commands

These commands keep comments and write the canonical layout that `xrobot format` enforces. Without `-c`, `instance` edits the selected configuration, and `sync` and `format` process every configuration.

```bash
xrobot instance add owner/Repo [--id ID] [--template-arg VALUE]...
                                              # writes every parameter with its default
xrobot instance set ID args.led LED_B
xrobot instance set ID args.param.beta 0.05f
xrobot instance set ID args.topic_name '"bmi088_gyro"'
xrobot instance set ID template_args[0] float
xrobot instance rename ID NEW_ID              # also renames references in the same config
xrobot instance remove ID
xrobot sync [-c CONFIG]...
xrobot format [--check] [-c CONFIG]...
```

The `set` value is read like a value in the config: C++ code without quotes or in single quotes, a C++ string in double quotes. Windows PowerShell 5.1 drops the double quotes from an argument it passes to `xrobot`, so there the string in the example is written `'\"bmi088_gyro\"'`. With `--json` the value is JSON whose strings are C++ text; the VS Code extension writes values this way. The path is `template_args[n]` or `args.<param>[.<field>|[n]]...`; an instance id is changed with `rename`, which also rewrites the references to it; `args` itself can be replaced by a whole list to switch to another constructor. `--if-match <sha256>` refuses the write if the file changed since it was read (the SHA-256 of the LF-normalized file).

`xrobot describe` prints, as JSON, everything generation reads and checks: the configurations and the selected one, header freshness, tool pins, locked Modules, constructor signatures, the fields a mapping must name, registrations with their types, the names each parameter can bind to, and diagnostics. The VS Code extension renders and edits configurations from it.

---

## Locating Errors

Configuration errors are reported as `<config>: <instance>.args.<param>: reason`. The generated code carries `#line` directives, so C++ compiler errors point to the corresponding YAML line (`xrobot gen --no-line-directives` leaves them out).
