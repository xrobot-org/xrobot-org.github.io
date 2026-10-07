---
id: code-gen-pins
title: 引脚布局（libxr pins）
sidebar_position: 4
---

# 引脚布局（libxr pins）

`libxr pins` 打印一个型号的封装与引脚布局：每个引脚的位置、名称和可选的信号。数据来自各厂商的引脚数据：STM32 为 ST 的 STM32_open_pin_data，MSPM0 为 TI SysConfig 的器件数据，HPM 为 HPM SDK 的 `hpm_iomux.h`、`hpm_soc_ip.h` 和 HPM5300 数据手册的引脚表。

---

## 用法

```bash
libxr pins STM32H723VGT6
libxr pins MSPM0G3507 --package LQFP-64 --format json
libxr pins MSPM0G3507SPMR
libxr pins HPM5301
libxr pins -d path/to/project
```

型号作为位置参数给出。MSPM0 的封装优先取型号后缀中的封装代码（`MSPM0G3507SPMR` 的 `PM`），判断不了时用 `--package` 给出（`LQFP-64`、`PM` 等写法都可以）；HPM 的型号即 SoC 名，封装有多个时用 `--package` 给出。

`-d` 给出工程目录时，打印的布局叠加工程已选的信号及其 `libxr_config.yaml` 设置。STM32 工程读 `.ioc` 文件，MSPM0 工程读根目录的 `.syscfg`（封装取自 SysConfig 工程），HPM 工程读 `boards/` 下的 `.hpmpc` 和 `main.c` 在预处理条件之外调用的 pinmux 函数（封装取自 `.hpmpc`）。设置从 `--libxr-config` 指定的文件读取，默认为工程中的 `User/libxr_config.yaml`。

---

## 输出

```yaml
$ libxr pins MSPM0G3507 --package LQFP-64
model: MSPM0G3507
platform: mspm0
part: MSPM0G3507
package: LQFP-64(PM)
pin_count: 64
source:
  vendor: Texas Instruments
  dataset: SysConfig dist/deviceData
  version: 1.28.1+4785
  license: TI limited license (TI devices only)
peripherals:
  ADC0:
    kind: ADC
    signals:
      '0':
      - PA27
      '1':
      - PA26
# ...
```

`source` 记录数据的来源和版本；`peripherals` 按外设列出每个信号的可用引脚。

---

## 工程叠加

给出 `-d` 时，输出多一个 `project` 段：`directory`、`source` 记录工程目录和读取的工程文件，`libxr_config`、`sysconfig_file` 是读取的设置文件和 SysConfig 工程（HPM 工程的 `sysconfig_file` 是 `.hpmpc`）；`assignments` 逐引脚列出工程选中的信号，GPIO 引脚带有生成代码中的对象名 `label`；`peripherals` 按外设列出占用的引脚、MSPM0 工程中该外设在 SysConfig 中的参数（`sysconfig`），以及它在 `libxr_config.yaml` 中的设置项（`config`）。以下取自 bsp-mspm0g3507-mini：

```yaml
$ libxr pins -d .
# ...
project:
  directory: .
  source: mspm0g3507_minidb48.syscfg
  libxr_config: User\libxr_config.yaml
  sysconfig_file: mspm0g3507_minidb48.syscfg
  assignments:
    # ...
    PB8:
      signal: PB8
      peripheral: GPIOB
      kind: GPIO
      function: P8
      matched: true
      label: LED1
    # ...
  peripherals:
    # ...
    TIMA1:
      kind: TIMA
      pins:
        CCP0: PA28
        CCP1: PA31
      sysconfig:
        module: PWM
        name: PWM_TIMA1
        params: {}
      config:
      - section: PWM
        key: pwm_tima1_c0
        present: true
        params:
          frequency: null
      - section: PWM
        key: pwm_tima1_c1
        present: true
        params:
          frequency: null
    # ...
```

`matched` 为 `false` 时，信号与该引脚可复用的信号不符，按原样列出。`config` 是该实例在 `libxr_config.yaml` 中的设置项列表：`present` 表示这一项是否已在文件中，`params` 是已写的设置；一个 PWM 实例的每个通道各占一项。HPM 工程的 GPIO 改名是 `GPIO` 段下的整段映射：`section: GPIO` 的项 `key` 为 `null`，`params` 是引脚名到新名字的映射，值为 `null` 时保留默认名。

---

## 参数

| 参数       | 说明                        |
| ---------- | --------------------------- |
| `model` | 型号（默认：`-d` 给出的工程的型号） |
| `-d`, `--directory` | 工程目录：叠加它已选的信号和设置 |
| `-c`, `--libxr-config` | 读取设置的 libxr_config.yaml（默认：工程中的 `User/libxr_config.yaml`） |
| `-p`, `--package` | 封装，型号名不包含封装时给出（MSPM0：`LQFP-64`、`PM` 等；HPM：`QFN48` 等）；用 `-d` 时取自 SysConfig 或 Pinmux Tool 工程 |
| `-f`, `--format` | 输出格式：`yaml`（默认）或 `json` |
| `--verbose` | 输出调试日志 |

## 参考

* [LibXR 命令行工具以及文档](https://pypi.org/project/libxr/)
