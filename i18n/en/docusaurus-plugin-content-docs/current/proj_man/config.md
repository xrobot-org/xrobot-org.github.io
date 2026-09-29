---
id: proj-man-config
title: Application Configuration
sidebar_position: 2
---

# Application Configuration

An application configuration describes one product: which Module instances are constructed, in which order, and the value of every constructor parameter. Every `*.yaml` under `User/` (including subdirectories) except `User/libxr_config.yaml` is an application configuration, and `xrobot setup` checks all of them.

---

## Selecting a Product

```bash
xrobot gen -c User/RobotConfig/hero.yaml
```

`xrobot gen -c` generates `User/xrobot_main.hpp` for that configuration, which selects the product. The header's first lines record the configuration and every file generation read. `xrobot gen` without `-c` and `xrobot setup` keep the current selection, or use `User/xrobot.yaml` when nothing was generated yet. If the selected configuration has been deleted or renamed, these commands report an error and a configuration has to be selected again with `xrobot gen -c`.

---

## Format

```yaml
constexpr_namespace: BoardConfig        # default: ProjectConstexpr
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

Values are C++ text, written into the generated code as-is:

```yaml
- blink_cycle: '250'
- topic_name: '"bmi088_gyro"'          # a C++ string literal keeps its quotes
- mode: CMD::Mode::CMD_OP_CTRL
- rotation: '{0.707, 0.0, 0.0, 0.707}'
```

- `null`, `~` and an empty value mean "not filled in" and generation refuses them; write `nullptr` for a null pointer.
- A value cannot contain C++ comments (use a YAML `#` comment), and an integer cannot start with `0` (C++ would read it as octal).
- YAML anchors, aliases and tags are rejected; share values through `constexprs`.

### Dependency Parameters

A reference or pointer parameter without a default is a dependency. Its value is one of:

- a name registered with `XR_REGISTER` in the entry source;
- the `id` of an earlier instance;
- `&name` (for a pointer parameter);
- `nullptr` (for a pointer parameter).

An optional dependency is declared by the Module as a pointer parameter without a default; `nullptr` leaves it unused. A wrong name is reported with the candidates of the right type:

```text
User/xrobot.yaml: status_led.args.led: LED_X is neither an XR_REGISTER name nor an earlier instance id; candidates of type LibXR::GPIO&: LED_R
```

### Structs and Classes

When a parameter's type is a struct or class defined in a Module header, write a mapping:

- an aggregate lists all its fields in declaration order;
- a class with constructors lists all parameters of one constructor, in order.

Mappings can nest. For such types, positional lists and positional braces (`{1, 2, 3}`) are rejected; designated initializers (`{.a = 1, .b = 2}`) are checked like mappings. Other types (for example LibXR or standard library types) accept any C++ expression, including braces.

After a new Module version adds or removes fields or parameters, run `xrobot sync`: new ones are written with their source defaults, removed ones are dropped, and existing values are kept. `xrobot setup --update` does this automatically.

### Constants

Each entry in `constexprs` becomes `inline constexpr <type> <name> = <value>;` in the `constexpr_namespace` namespace; configurations refer to it as `Namespace::name`. Constants may use each other; headers their types need go in `constexpr_includes`.

### settings

`settings` has one key, `monitor_sleep_ms`: the milliseconds the main loop sleeps after each round of `OnMonitor()` calls (default 1000).

---

## Editing Commands

These commands keep comments and write the canonical layout that `xrobot format` enforces. Without `-c` they edit the selected product.

```bash
xrobot instance add owner/Repo [--id ID]      # writes every parameter with its default
xrobot instance set ID args.led '"LED_B"'     # VALUE is JSON
xrobot instance set ID args.param.reverse '"true"'
xrobot instance set ID template_args[0] '"float"'
xrobot instance rename ID NEW_ID              # also renames references in the same config
xrobot instance remove ID
xrobot sync [-c CONFIG]...
xrobot format [--check] [-c CONFIG]...
```

The `set` path is `id`, `template_args[n]` or `args.<param>[.<field>|[n]]...`; `args` itself can be replaced by a whole list to switch to another constructor. `--if-match <sha256>` refuses the write if the file changed since it was read (the SHA-256 of the LF-normalized file).

`xrobot describe` prints, as JSON, everything generation reads and checks: the configurations and the selected product, header freshness, tool pins, locked Modules, constructor signatures, the fields a mapping must name, registrations with their types, the names each parameter can bind to, and diagnostics. The VS Code extension renders and edits configurations from it.

---

## Locating Errors

Configuration errors are reported as `<config>: <instance>.args.<param>: reason`. The generated code carries `#line` directives, so C++ compiler errors point to the corresponding YAML line.
