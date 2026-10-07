---
id: code-gen-pins
title: Pin Layout (libxr pins)
sidebar_position: 4
---

# Pin Layout (libxr pins)

`libxr pins` prints the package and pin layout of a model: the position, name and selectable signals of every pin. The data comes from the vendors' pin data: ST's STM32_open_pin_data for STM32, the device data of TI SysConfig for MSPM0, and the `hpm_iomux.h` and `hpm_soc_ip.h` of the HPM SDK plus the pin tables of the HPM5300 datasheet for HPM.

---

## Usage

```bash
libxr pins STM32H723VGT6
libxr pins MSPM0G3507 --package LQFP-64 --format json
libxr pins MSPM0G3507SPMR
libxr pins HPM5301
libxr pins -d path/to/project
```

The model is a positional argument. The package of an MSPM0 comes from the package code in the model suffix first (`PM` of `MSPM0G3507SPMR`); when it cannot be told, give it with `--package` (`LQFP-64`, `PM` and the like all work). The model of an HPM is the SoC name; when the SoC has several packages, give it with `--package`.

With `-d` naming a project directory, the printed layout overlays the signals the project has selected and their `libxr_config.yaml` settings. An STM32 project reads the `.ioc` file, an MSPM0 project reads the `.syscfg` at the root (the package comes from the SysConfig project), and an HPM project reads the `.hpmpc` under `boards/` and the pinmux functions `main.c` calls outside preprocessor conditions (the package comes from the `.hpmpc`). The settings are read from the file `--libxr-config` names, by default `User/libxr_config.yaml` in the project.

---

## Output

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

`source` records where the data comes from and its version; `peripherals` lists the pins every signal can sit on, per peripheral.

---

## Project Overlay

With `-d` the output gains a `project` section: `directory` and `source` record the project directory and the project file read, `libxr_config` and `sysconfig_file` the settings file and the SysConfig project read (the `sysconfig_file` of an HPM project is its `.hpmpc`); `assignments` lists the selected signals pin by pin, with the object name of a GPIO pin in the generated code as `label`; and `peripherals` lists per peripheral the pins it occupies, for an MSPM0 project its parameters in SysConfig (`sysconfig`), and its settings entries in `libxr_config.yaml` (`config`). The following is taken from bsp-mspm0g3507-mini:

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

A `matched` of `false` means the signal does not agree with what the pin can multiplex; it is given as it is. `config` is the list of the instance's settings entries in `libxr_config.yaml`: `present` tells whether the entry is already in the file, and `params` are the settings written; one PWM instance has one entry per channel. The GPIO renames of an HPM project are a whole section mapping: the `section: GPIO` entry has the `key` `null`, and its `params` map pin names to new names, a `null` value keeping the default name.

---

## Options

| Option     | Description                 |
| ---------- | --------------------------- |
| `model` | the model (default: the one of the project given with `-d`) |
| `-d`, `--directory` | the project directory: overlay the signals it has selected and their settings |
| `-c`, `--libxr-config` | the libxr_config.yaml to read the settings from (default: `User/libxr_config.yaml` in the project) |
| `-p`, `--package` | the package, for a model that does not name it (MSPM0: `LQFP-64`, `PM`, ...; HPM: `QFN48`, ...); with `-d` it comes from the SysConfig or Pinmux Tool project |
| `-f`, `--format` | the output format: `yaml` (default) or `json` |
| `--verbose` | enable debug logging |

## Reference

* [LibXR command-line tool and documentation](https://pypi.org/project/libxr/)
