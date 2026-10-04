---
id: con-guide-testing
title: Testing
sidebar_position: 5.7
---

# Testing

This page collects how tests are written for LibXR (C++) and for XRobot, LibXR_CppCodeGenerator and xr-syntax (Python). Test code follows the same [Code Style](./coding_style.md) and [Python Code Style](./coding_style_python.md) as the main code; this page covers only what is specific to tests. The tests and checks each repository runs in CI, and the commands to run locally before submitting, are listed in [How to Contribute](./how2con.md#verification).

## What to check

- Tests check observable results: return values, command output, error messages, generated files, compilation and run results. They do not check intermediate results of private functions or the order of calls, except when the number of calls is itself the requirement, for example that the xr-syntax builder parses only once, in `build()`.
- One test checks one behavior, and its name states that behavior. A command-line test may run several commands of one usage scenario to check that each command reaches its implementation; the details of each command are checked in the tests of the module that implements it.
- Every test must be needed: removing it lets some mistake go unnoticed by all other tests. Tests that only change the input, run the same code and assert the same result are merged into one. See [Ablation](#ablation) for how to check this.
- A test added with a bug fix must fail on the code before the fix.
- Error messages and short output are compared in full. Temporary paths and commits inside a message are built by the test with f-strings; the output of external programs such as git changes between versions, so only the relevant part of it is compared. Long output such as generated headers or JSON is compared by its relevant parts, or byte for byte against a reference file.

Rejected (checks one word of the message; the rest of the message could be wrong):

```python
with self.assertRaisesRegex(ValueError, "ambiguous"):
    constructor_for(model, [{"value": "Read()"}], {}, "Foo", {})
```

Accepted:

```python
with self.assertRaisesMessage(
    ValueError, "Foo: constructor is ambiguous for the supplied names and explicit types"
):
    constructor_for(model, [{"value": "Read()"}], {}, "Foo", {})
```

`assertRaisesMessage` comes from the test base class `fixtures.TestCase` and compares the error text exactly; command-line tests compare stderr with `fails(..., message=...)`.

## Where tests go

Python repositories:

- `tests/test_<module>.py` belongs to `src/<package>/<module>.py`. Argument parsing, output format and exit codes of the command line go to `test_cli.py`; behavior that a command triggers but another module implements goes to that module's test file.
- Helpers shared by several test files live in `tests/fixtures.py` (`conftest.py` in pytest repositories); a helper used by one file stays in that file.
- In the `unittest` repositories (XRobot, LibXR_CppCodeGenerator), test classes group behavior and are named with noun phrases (`AddInstance`, `LockFile`), deriving from `fixtures.TestCase` or one of its subclasses. Test method names start with `test_` and the rest is a sentence stating the behavior (`test_a_missing_lock_is_reported`). The tests of xr-syntax are module-level functions whose names follow the same rule.

LibXR:

- `test/automatic/` follows the interface under test: the source path without its extension is the test directory, for example `src/core/libxr_pipe.hpp` belongs to `automatic/core/libxr_pipe/`. Tests that need a particular system or peripheral go to `test/manual/`.
- Results are checked with `TEST_ASSERT`; a new test lists its source in `automatic/CMakeLists.txt` and is called from `main.cpp` or an existing entry. See the repository's [test/README.md](https://github.com/xrobot-org/libxr/blob/master/test/README.md).

## Comments

- A Python test file starts with a docstring of one Chinese and one English line stating what the file tests; each test class has a one-line bilingual docstring too. Test methods are described by their names and have no docstring. Helper functions, test base classes and fixtures have bilingual docstrings like the main code, and the docstring check of each repository covers `tests/` as well (`tests/test_docstrings.py` in XRobot and LibXR_CppCodeGenerator, `tools/check_bilingual_docs.py` run by CI in xr-syntax).
- What cannot be seen at a glance, such as why an input is built a certain way or where an expected result comes from, gets a bilingual comment.
- A LibXR test file starts with a comment stating what it tests and any special setup; comments in the body explain important steps and expected results, not obvious assignments and assertions.

## Environment

- Tests depend on no network, machine paths, user git configuration or execution order, and write files into temporary directories.
- Git repositories in tests are created by the tests themselves with a fixed author and commit configuration (XRobot's `fixtures.run_git`).
- Python tests that need a C++ compiler select it through the `CXX` environment variable and are skipped without one; CI runs them on Linux with both g++ and clang++.
- Compilation checks of the same kind are combined into one compilation where possible.

## Ablation

After tests are reorganized or a batch of tests is added, coverage and mutation testing confirm that every test is needed. The check is done by hand in the following steps:

1. Record the lines each test executes with coverage's `dynamic_context = test_function`.
2. Make one small change to an executed line: invert a comparison or a condition, swap `and`/`or`, change a constant or a string, remove a `raise` or a call, or return `None`. For each change, run only the tests that executed that line and record which fail. Changes are located by syntax-tree position, so they run on a copy of a committed version (`git archive`), never on a working tree that is being edited; set `PYTHONDONTWRITEBYTECODE=1`, or Python reuses the `.pyc` of the previous change when two changes of one file have the same size and are written within the same second.
3. A test whose detected changes are all detected by other tests as well is a candidate for removal or merging. Remove it only after confirming that it checks nothing the others do not check (for example the full error text or a compilation result).
4. A change no test detects means a missing test or a missing assertion, which is then added; changes that do not affect results (for example to a cache, a thread count or garbage-collection settings) are recorded. Tests run in English and cannot see the Chinese text inside `tr()`; dedicated tests sample the Chinese output per language instead of comparing every message.
