---
id: flag
title: Flag
sidebar_position: 1
---

# Flag

`LibXR::Flag` provides a very lightweight set of boolean state utilities. It is suitable for simple states such as “busy or idle”, “request pending”, or “event has occurred”.

`Flag` consists of three parts:

- `Flag::Atomic`: atomic flag for shared state across threads / cores / ISRs
- `Flag::Plain`: non-atomic flag for local or externally synchronized use
- `Flag::ScopedRestore<FlagT>`: RAII helper that changes a flag on scope entry and restores the previous value on scope exit

`Flag` only stores and exchanges a boolean value; mutual exclusion uses [Mutex](../system/mutex.md).

---

## 1. `Flag::Atomic`

`Flag::Atomic` stores state with `std::atomic<uint32_t>` and provides these common APIs:

- `Set()`
- `Clear()`
- `IsSet()`
- `TestAndSet()`
- `TestAndClear()`
- `Exchange(bool)`

Copy construction and copy assignment are disabled.

Typical uses:

- shared “new data / sending / retry needed” markers between ISR and thread contexts
- one-bit state sharing between threads

---

## 2. `Flag::Plain`

`Flag::Plain` provides almost the same API shape as `Flag::Atomic`, but stores state as a normal `bool`.

Characteristics:

- no atomic semantics
- not suitable for concurrent access
- suitable for single-threaded code, or cases already protected by a higher-level lock / critical section

If a flag is only used locally or all accesses are already synchronized elsewhere, `Flag::Plain` is often the simpler choice.

---

## 3. `Flag::ScopedRestore<FlagT>`

`ScopedRestore` is an RAII helper:

- on construction it calls `flag.Exchange(set_value)` and stores the old value
- on destruction it restores the old value automatically

It requires `FlagT` to provide at least:

```cpp
bool Exchange(bool set_value);
```

Typical uses:

- temporarily marking a function as “in progress” and restoring the previous state automatically
- avoiding manual cleanup on early `return`

---

## 4. Example

```cpp
#include <libxr.hpp>

LibXR::Flag::Atomic tx_busy;

if (!tx_busy.TestAndSet())
{
  // first entry into the transmit path
  tx_busy.Clear();
}

LibXR::Flag::Plain in_callback;

{
  LibXR::Flag::ScopedRestore<LibXR::Flag::Plain> guard(in_callback, true);
  // in_callback is true inside this scope
}
// previous value is restored here
```

---

## 5. Selection guidance

- Shared across threads / ISR: prefer `Flag::Atomic`
- Local single-thread state: prefer `Flag::Plain`
- Need “set on entry, restore on exit”: use `ScopedRestore`

Mutual exclusion uses [Mutex](../system/mutex.md) or another synchronization primitive.
