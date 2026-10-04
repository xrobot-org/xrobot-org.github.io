---
id: core-coding
title: Core API
sidebar_position: 1
---

# Core API

This chapter covers the LibXR core headers: data types, error handling, callbacks, read/write ports, timestamps and terminal formatting.

## Overview

- [`libxr_def`](./core-def.md): Common macro definitions, error codes, and basic constants  
- [`libxr_assert`](./core-assert.md): Assertion mechanism and fatal error callbacks  
- [`libxr_cb`](./core-cb.md): Type-safe callback mechanism  
- [`libxr_type`](./core-type.md): Raw data encapsulation and type identification  
- [`libxr_mem`](./core-mem.md): Memory copy, clear, and compare helpers
- [`libxr_string`](./core-string.md): Retained runtime-built strings (`RuntimeStringView`)
- [`libxr_color`](./core-color.md): Terminal output formatting and ANSI control  
- [`print`](./core-print.md): Compile-time formatting output and sink and bounded-buffer wrappers
- [`libxr_time`](./core-time.md): Microsecond/millisecond-level timestamps and time differences  
- [`libxr_rw`](./core-rw.md): General read/write interfaces and operation encapsulation  
- [`Operation`](./core-op.md): Asynchronous completion-feedback model
- [`Pipe`](./core-pipe.md): Unidirectional pipe built on a shared byte queue
