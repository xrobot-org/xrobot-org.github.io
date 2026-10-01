---
id: con-guide-coding-style-python
title: Python Code Style
sidebar_position: 5.5
---

# Python Code Style

This page summarizes the code style of the Python repositories, such as XRobot, LibXR_CppCodeGenerator and xr-syntax. It corresponds to the C++ rules in [Code Style](./coding_style.md). The rejected examples are code that actually appeared in the repositories.

## Python version

- Python 3.10 and later are supported. `pyproject.toml` declares `requires-python = ">=3.10"`, and CI covers 3.10 up to the latest stable release.
- The minimum version follows the Python shipped with the oldest Ubuntu LTS still in support, and changes only with a major release.
- Python 3.10 syntax may be used, such as `X | None`, `list[str]` and `match`.

## Naming

- Packages and module files use `snake_case`.

Rejected:

```text
xrobot/GenerateMain.py
libxr/GeneratorCodeSTM32.py
```

Accepted:

```text
xr_syntax/cpp/lexer.py
xrobot/generate_main.py
```

- Classes use `PascalCase`; functions, methods and variables use `snake_case`; constants are uppercase.

```python
class ConfigError(ValueError):
    ...

MANIFEST_VERSION = 2

def load_config(path: Path) -> dict:
    ...
```

- Names used only inside a module start with `_`.

```python
def _header_relative(path: Path, header: Path) -> str:
    ...
```

## Modules and imports

- Imports inside a package are absolute.

```python
from xrobot.config import ConfigError, load_config
```

- Imports are grouped as standard library, third-party and project, sorted within each group; `ruff` checks the order.

```python
import re
from pathlib import Path

import yaml

from xrobot.config import ConfigError
```

- A command-line entry imports the modules a command needs only when that command runs, to keep start-up short; other modules import at the top of the file.

```python
def cmd_gen(args: argparse.Namespace) -> None:
    from xrobot.generate_main import generate
    ...
```

## Layout

- Layout is left to `ruff format`: double quotes and a line length of 100, the same as the existing xr-syntax configuration.
- Unrelated code is not reformatted by hand; changes made by the formatter go into their own commit.

## Declarations and definitions

- Public functions and methods carry type annotations.

Rejected:

```python
def find_root(start='.'):
    start = Path(start).resolve()
```

Accepted:

```python
def find_root(start: str | Path = ".") -> Path:
    """从 start 向上查找含有 Modules/modules.yaml 的目录。
    Find the nearest directory at or above start that contains Modules/modules.yaml.
    """
    start = Path(start).resolve()
```

- Strings are formatted with f-strings.

Rejected:

```python
return '%d %s%s' % (number, noun, '' if number == 1 else 's')
```

Accepted:

```python
return f"{number} {noun}{'' if number == 1 else 's'}"
```

- Paths use `pathlib.Path`; text is read and written with `encoding="utf-8"`.

```python
text = path.read_text(encoding="utf-8")
```

- External commands receive their arguments as a list and do not go through a shell.

Rejected:

```python
result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
```

Accepted:

```python
result = subprocess.run(["git", "-C", str(path), "rev-parse", "HEAD"],
                        capture_output=True, text=True, encoding="utf-8")
```

## Comments

- Every module, class and function has a docstring: Chinese on the first line, English on the second, corresponding to `@brief 中文 / English` in the LibXR headers.

```python
def _has_chinese(text: str | None) -> bool:
    """判断文本是否包含中文。
    Return whether text contains Chinese characters.
    """
    return bool(text and _CHINESE.search(text))
```

- When parameters, return values or exceptions are not clear from the names and types, they are described in `Args:`, `Returns:` and `Raises:` sections, which correspond to Doxygen's `@param` and `@return`; each entry is also bilingual.

```python
def selected_config(self) -> Path:
    """当前头文件对应的配置；没有头文件时为 User/xrobot.yaml。
    The configuration the current header was generated for; User/xrobot.yaml without a header.

    Raises:
        ProjectError: 头文件记录的配置已不存在。
            The configuration named by the header no longer exists.
    """
```

- Line comments explain semantics and boundary conditions, not the history of attempts, and avoid colloquial wording; like docstrings, they have a Chinese line and an English line.

```python
# 编辑器仍需要其他配置来重新选择。
# Editors still need the other configurations to select one.
selected = project.header_selection()
```

- A test in each repository checks that docstrings are complete and contain Chinese.

## Error handling

- Each tool defines its own exception types derived from `ValueError`. Messages start with `<file>:<line>` or `<config>: <location>` and say what to do.

```python
class ConfigError(ValueError):
    """带有 <配置>: <位置> 前缀的配置错误。
    A configuration error that already carries its <config>: <path> prefix.
    """

raise ConfigError(f"{source}:{line}: YAML anchors and aliases are not allowed; reference "
                  "instances by id and share values through constexprs")
```

- The command-line entry catches these exceptions, prints a single line and exits with status 1.
- Only the expected exception types are caught; a broad `Exception` does not swallow errors. Catching to roll back and then re-raising is the exception.

Rejected:

```python
def _shell_join(args: Sequence[str]) -> str:
    try:
        import shlex
        return " ".join(shlex.quote(arg) for arg in args)
    except Exception:
        return " ".join(args)
```

Accepted (roll back, then re-raise):

```python
try:
    ...
except Exception:
    for identity in reversed(applied):
        ...  # 恢复已检出的模块 / restore the Modules already checked out
    raise
```

- `# noqa` is written only on the line that needs the exception, with the rule code; rules are not disabled for a whole file or in the configuration.

```python
from xrobot.config import ConfigError  # noqa: F401
```

## Test code

- XRobot and LibXR_CppCodeGenerator use `unittest`, xr-syntax uses `pytest`; each repository keeps its framework.
- Tests that need a compiler select it through the `CXX` environment variable and are skipped when none is found.
- Test code follows the same naming and layout as the main code.
- Where tests go, what they check and how to confirm that every test is needed: see [Testing](./testing.md).

## ruff

- `ruff` is configured in `pyproject.toml`:

```toml
[tool.ruff]
line-length = 100
target-version = "py310"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]
ignore = ["E501"]
```

- `ruff format` controls the line length; long strings that still exceed it after formatting are not reported separately, so `E501` is ignored.

- The CI checks are:

```bash
ruff format --check .
ruff check .
```
