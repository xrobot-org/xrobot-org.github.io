---
id: con-guide-coding-style-python
title: Python 编码规范
sidebar_position: 5.5
---

# Python 编码规范

这里整理 XRobot、LibXR_CppCodeGenerator、xr-syntax 等 Python 仓库的代码写法，与[编码规范](./coding_style.md)中的 C++ 写法对应。反例取自仓库中实际出现过的代码。

## Python 版本

- 支持 Python 3.10 及以上版本，`pyproject.toml` 中写 `requires-python = ">=3.10"`，CI 覆盖 3.10 到当前最新的正式版本。
- 版本下限跟随仍在支持期内、最早的 Ubuntu LTS 自带的 Python 版本，只在大版本发布时调整。
- 可以使用 3.10 的语法，例如 `X | None`、`list[str]` 和 `match`。

## 命名

- 包和模块文件使用 `snake_case`。

反例：

```text
xrobot/GenerateMain.py
libxr/GeneratorCodeSTM32.py
```

正例：

```text
xr_syntax/cpp/lexer.py
xrobot/generate_main.py
```

- 类使用 `PascalCase`；函数、方法、变量使用 `snake_case`；常量使用全大写。

```python
class ConfigError(ValueError):
    ...

MANIFEST_VERSION = 2

def load_config(path: Path) -> dict:
    ...
```

- 只在模块内部使用的名称以 `_` 开头。

```python
def _header_relative(path: Path, header: Path) -> str:
    ...
```

## 模块与导入

- 包内使用绝对导入。

```python
from xrobot.config import ConfigError, load_config
```

- 导入按标准库、第三方库、本项目分组，组内按字母排序，由 `ruff` 检查。

```python
import re
from pathlib import Path

import yaml

from xrobot.config import ConfigError
```

- 命令行入口只在执行某个命令时导入它用到的模块，以缩短启动时间；其他模块在文件开头导入。

```python
def cmd_gen(args: argparse.Namespace) -> None:
    from xrobot.generate_main import generate
    ...
```

## 版式

- 版式交给 `ruff format` 处理：双引号，行宽 100，与 xr-syntax 现有配置一致。
- 不为了统一版式手工改动无关代码；格式化工具的改动单独提交。

## 声明与定义

- 公开的函数和方法写类型标注。

反例：

```python
def find_root(start='.'):
    start = Path(start).resolve()
```

正例：

```python
def find_root(start: str | Path = ".") -> Path:
    """从 start 向上查找含有 Modules/modules.yaml 的目录。
    Find the nearest directory at or above start that contains Modules/modules.yaml.
    """
    start = Path(start).resolve()
```

- 字符串格式化使用 f-string。

反例：

```python
return '%d %s%s' % (number, noun, '' if number == 1 else 's')
```

正例：

```python
return f"{number} {noun}{'' if number == 1 else 's'}"
```

- 路径使用 `pathlib.Path`；读写文本时写明 `encoding="utf-8"`。

```python
text = path.read_text(encoding="utf-8")
```

- 调用外部命令时以列表传参，不经过 shell。

反例：

```python
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
```

正例：

```python
result = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"],
                        capture_output=True, text=True, encoding="utf-8")
```

## 注释

- 每个模块、类、函数都有 docstring：第一行中文，第二行英文，与 LibXR 头文件中的 `@brief 中文 / English` 对应。

```python
def _has_chinese(text: str | None) -> bool:
    """判断文本是否包含中文。
    Return whether text contains Chinese characters.
    """
    return bool(text and _CHINESE.search(text))
```

- 参数、返回值或异常不能从名字和类型看出时，按 `Args:`、`Returns:`、`Raises:` 分段说明，对应 Doxygen 的 `@param`、`@return`；每一项同样中英双语。

```python
def selected_config(self) -> Path:
    """当前头文件对应的配置；没有头文件时为 User/xrobot.yaml。
    The configuration the current header was generated for; User/xrobot.yaml without a header.

    Raises:
        ProjectError: 头文件记录的配置已不存在。
            The configuration named by the header no longer exists.
    """
```

- 行内注释说明语义和边界条件，不记录试错过程，不写口语化句子；与 docstring 一样，中文一行、英文一行。

```python
# 编辑器仍需要其他配置来重新选择。
# Editors still need the other configurations to select one.
selected = project.header_selection()
```

- 仓库中的测试检查 docstring 是否齐全且包含中文。

## 错误处理

- 每个工具定义自己的异常类型，继承 `ValueError`；错误信息以 `<文件>:<行>` 或 `<配置>: <位置>` 开头，并说明需要做什么。

```python
class ConfigError(ValueError):
    """带有 <配置>: <位置> 前缀的配置错误。
    A configuration error that already carries its <config>: <path> prefix.
    """

raise ConfigError(f"{source}:{line}: YAML anchors and aliases are not allowed; reference "
                  "instances by id and share values through constexprs")
```

- 命令行入口捕获这些异常，只输出一行错误信息，退出码为 1。
- 只捕获预期的异常类型，不用宽泛的 `Exception` 吞掉错误。捕获后先回滚再重新抛出的情况除外。

反例：

```python
def _shell_join(args: Sequence[str]) -> str:
    try:
        import shlex
        return " ".join(shlex.quote(arg) for arg in args)
    except Exception:
        return " ".join(args)
```

正例（回滚后重新抛出）：

```python
try:
    ...
except Exception:
    for identity in reversed(applied):
        ...  # 恢复已检出的模块 / restore the Modules already checked out
    raise
```

- `# noqa` 只写在需要例外的那一行上，并注明规则编号，不在文件或配置中整体关闭规则。

```python
from xrobot.config import ConfigError  # noqa: F401
```

## 测试代码

- XRobot 与 LibXR_CppCodeGenerator 使用 `unittest`，xr-syntax 使用 `pytest`；各仓库沿用现有框架。
- 需要编译器的测试通过环境变量 `CXX` 选择编译器，找不到编译器时跳过。
- 测试代码的命名和版式与主代码一致。
- 测试放在哪里、测什么、怎样确认每个测试都有作用，见[测试规范](./testing.md)。

## ruff

- `pyproject.toml` 中配置 `ruff`：

```toml
[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
ignore = ["E501"]
```

- 行宽由 `ruff format` 控制；格式化后仍超出的长字符串不另行报错，因此忽略 `E501`。

- CI 中的检查命令：

```bash
ruff format --check .
ruff check .
```
