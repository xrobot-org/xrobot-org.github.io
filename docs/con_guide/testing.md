---
id: con-guide-testing
title: 测试规范
sidebar_position: 5.7
---

# 测试规范

这里整理 LibXR（C++）以及 XRobot、LibXR_CppCodeGenerator、xr-syntax（Python）的测试写法。测试代码与主代码遵守同一套[编码规范](./coding_style.md)和 [Python 编码规范](./coding_style_python.md)，本页只写测试特有的约定。

## 测什么

- 测试检查可观察的结果：返回值、命令输出、报错信息、生成的文件、编译和运行结果。不检查私有函数的中间结果和调用顺序；调用次数本身就是要求时除外，例如 xr-syntax 的 builder 只在 `build()` 时解析一次。
- 一个测试检查一件行为，测试名说明这件行为。命令行测试可以按一个使用场景连续执行几条命令，检查命令是否接到了实现上；每条命令的细节在实现它的模块的测试中检查。
- 每个测试都要有作用：去掉它，就会有某个错误不再被任何测试发现。只换了输入、经过同一段代码、断言同样结果的测试合并成一个。检查方法见[消融](#消融)。
- 修复错误时添加的测试，在修复前的代码上必须失败。
- 报错信息和短输出整段比较。报错中的临时路径和 commit 由测试用 f-string 拼出；git 等外部程序自己的输出随版本变化，只比较相关片段。生成的头文件、JSON 等长输出只比较相关的片段，或与基准文件逐字节比较。

反例（只检查报错里的一个词，报错的其余内容写错了也发现不了）：

```python
with self.assertRaisesRegex(ValueError, "ambiguous"):
    constructor_for(model, [{"value": "Read()"}], {}, "Foo", {})
```

正例：

```python
with self.assertRaisesMessage(
    ValueError, "Foo: constructor is ambiguous for the supplied names and explicit types"
):
    constructor_for(model, [{"value": "Read()"}], {}, "Foo", {})
```

`assertRaisesMessage` 由测试基类 `fixtures.TestCase` 提供，逐字比较报错文本；命令行测试用 `fails(..., message=...)` 比较标准错误。

## 放在哪里

Python 仓库：

- `tests/test_<模块>.py` 对应 `src/<包>/<模块>.py`。命令行的参数解析、输出格式和退出码放在 `test_cli.py`；由命令触发、在其他模块中实现的行为，放在那个模块的测试文件中。
- 多个测试文件共用的辅助放在 `tests/fixtures.py`（pytest 仓库放在 `conftest.py`），只在一个文件中使用的留在该文件。
- 逐字节比较的基准文件放在 `tests/data/<名字>/`，同一目录中保存生成它们的输入；生成结果有意改变时用仓库提供的脚本刷新（LibXR_CppCodeGenerator 的 `tests/reference_projects.py`），再逐行检查差异。`.gitattributes` 对这些文件关闭换行转换。
- 测试类按行为分组，类名是名词短语（`AddInstance`、`LockFile`），继承 `fixtures.TestCase` 或它的子类；测试方法名以 `test_` 开头，其余部分是一句说明行为的话（`test_a_missing_lock_is_reported`）。

LibXR：

- `test/automatic/` 按被测接口组织，源文件路径去掉扩展名就是测试目录，例如 `src/core/libxr_pipe.hpp` 对应 `automatic/core/libxr_pipe/`。需要具体系统或外设的测试放在 `test/manual/`。
- 结果用 `TEST_ASSERT` 检查；新测试在 `automatic/CMakeLists.txt` 中列出源文件，并接入 `main.cpp` 或已有入口。详见仓库的 [test/README.md](https://github.com/xrobot-org/libxr/blob/master/test/README.md)。

## 注释

- Python 测试文件开头的 docstring 中文一行、英文一行，说明这个文件测什么；测试类同样有一行中英 docstring。测试方法由方法名说明，不另写 docstring。辅助函数、测试基类和 fixtures 与主代码一样写中英 docstring，仓库的 docstring 测试同时检查 `tests/`。
- 输入为什么这样构造、预期结果从哪里来，这类不能一眼看出的内容写中英注释。
- LibXR 测试文件在头部注释说明测什么和特殊的运行前提；正文注释解释关键步骤和预期结果，直观的赋值和断言不逐行解释。

## 环境

- 测试不依赖网络、本机路径、用户的 git 配置和执行顺序，文件写在临时目录中。
- 测试中的 git 仓库由测试自己创建，并固定作者和提交配置（XRobot 的 `fixtures.run_git`）。
- 需要 C++ 编译器的 Python 测试通过环境变量 `CXX` 选择编译器，找不到时跳过；CI 在 Linux 上分别用 g++ 和 clang++ 运行。
- 同一类编译检查尽量放进一次编译，减少编译次数。

## 消融

测试整理完或新增一批测试后，用覆盖率和变异测试确认每个测试都有作用：

1. 用 coverage 的 `dynamic_context = test_function` 记录每个测试执行过的行。
2. 对被执行的行做一处小改动：比较运算取反、条件取反、`and`/`or` 互换、修改常量或字符串、删除 `raise` 或一次调用、把返回值改成 `None`。每个改动只运行执行过这一行的测试，记录哪些测试失败。改动按语法树位置定位，所以在已提交版本的副本（`git archive`）上运行，不在正在修改的工作区上运行；运行时设置 `PYTHONDONTWRITEBYTECODE=1`，否则同一文件的两个改动大小相同、又在同一秒内写入时，Python 会沿用上一个改动的 `.pyc`。
3. 一个测试能发现的改动，其他测试也都能发现时，它是删除或合并的候选。逐个确认它没有检查其他测试不检查的内容（例如完整的报错文字、编译结果）之后再删除。
4. 没有任何测试能发现的改动，说明缺少测试或缺少断言，需要补上；确实不影响结果的改动（例如只改变缓存、并发数或垃圾回收参数）记录下来。测试在英文环境下运行，看不到 `tr()` 中的中文文本；中文输出由专门的测试按语言抽查，不逐条比较。
