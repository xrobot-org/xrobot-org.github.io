---
id: database
title: Flash Database
sidebar_position: 5
---

# Database Flash Storage

LibXR provides two lightweight embedded key-value database implementations: `DatabaseRawSequential` and `DatabaseRaw<MinWriteSize>`.
Both inherit from the abstract interface class `Database`, and are designed for embedded Flash or other sequential-write storage media. They support primary-backup redundancy, power failure protection, type-safe encapsulation, and adaptation to different storage alignment constraints.

---

## Main Features

- Main and backup blocks store the data redundantly; each block carries a version header and a write-complete marker, which startup uses to check the main block and restore it from the backup when it is damaged;
- Provides a unified interface `Database` and template wrapper `Database::Key<T>`, enabling type-safe read/write;
- Two implementation modes:
  - `DatabaseRawSequential`: sequential write, suitable for Flash that does not support reverse overwrite;
  - `DatabaseRaw<MinWriteSize>`: for Flash backends constrained by minimum write-unit semantics, with the minimum write size expressed in the template parameter and the constructor taking the underlying `Flash` object plus a recycle threshold;
- After a key value changes, the database implementation saves it automatically; `Restore()` clears the database and returns it to the initial state.

---

## Usage Example

### Create a Database Object

The example uses `LinuxBinaryFileFlash<Size>` on Linux to emulate Flash with a file (`#include "linux_flash.hpp"`, in `driver/linux/`); the three arguments are the file path, the minimum erase unit, and the minimum write unit.

```cpp
LinuxBinaryFileFlash<2048> flash("/tmp/flash.bin", 512, 8);
DatabaseRawSequential db(flash);
```

Or use `DatabaseRaw<MinWriteSize>`:

```cpp
LinuxBinaryFileFlash<2048> flash2("/tmp/flash2.bin", 512, 16);
DatabaseRaw<16> db(flash2, 128);
```

`DatabaseRawSequential(flash, max_buffer_size = 256)` allocates a RAM buffer of `max_buffer_size` bytes, at most half of the Flash size; for `DatabaseRaw<MinWriteSize>(flash, recycle_threshold = 128)`, the template argument is at least the Flash minimum write unit, and more than `recycle_threshold` invalidated keys at startup or during a key lookup triggers recycling.

### Define Type-Safe Keys

```cpp
int value = 42;
Database::Key<int> key(db, "my_key", value);

// Write new value
key = 123;

// Load value back into variable
key.Load();
printf("value = %d\n", static_cast<int>(key));
```

---

## Type-Safe Wrapper: Key

The template class `Database::Key<T>` provides type-safe key-value encapsulation. It attempts to load the key's value from the database during construction; if the key doesn't exist, it adds a new one.

```cpp
struct Config { uint32_t baudrate; uint8_t mode; };
Database::Key<Config> cfg(db, "uart_cfg", {9600, 1});

// Write config
cfg = {115200, 0};

// Load config
cfg.Load();
```

- `T` should be trivially copyable, such as primitives, arrays, and structs made of them;
- Assignment `key = value` automatically updates the database;
- Use `key.Load()` to explicitly refresh content from the database.
- A key's data size is fixed when it is first written. Binding the same name later with a type of a different size makes `Load()` and `Set()` return `ErrorCode::FAILED`; the variable takes the initial value given to the constructor, and the stored value is kept.

---

## Common Interfaces

| Method/Operation | Description |
|------------------|-------------|
| `Key<T>(db, name, init)` | Bind a key; if the key does not exist, write `init` to the database |
| `Key<T>(db, name)` | Same, with an all-zero initial value |
| `Key<T>::Set(T)` / `operator=(T)` | Set the value and write it to the database; returns `ErrorCode` |
| `Key<T>::Save()` | Write the current variable value to the database |
| `Key<T>::Load()` | Load the stored value into the variable |
| `Key<T>::operator T()` | Return the current variable value (does not load from the database) |
| `DatabaseRawSequential::Restore()` | Clear the sequential database and reinitialize it |
| `DatabaseRaw<MinWriteSize>::Restore()` | Clear the raw database and reinitialize it |
| `DatabaseRaw<MinWriteSize>::Recycle()` | Compact the storage and reclaim space held by invalidated keys |

---

## Overview of Operation Mechanism

Despite differences in underlying mechanisms, all implementations follow the same design principles:

- Alternate writes between primary and backup blocks to ensure recoverability;
- Key-value pairs are stored as raw name-value records, and a fixed marker at the end of a block shows that the block was written completely;
- `Init()` automatically detects valid blocks and attempts recovery;
- `Restore()` actively clears primary and backup data to initialize an empty database;
- Each derived class handles page alignment and space management internally — users do not need to worry about it.

---

## Notes

- Prefer using the `Database::Key<T>` wrapper for read/write operations;
- Constructing a `Key` whose key does not exist writes the initial value; later writes happen on `key = val`, `key.Set(val)`, or `key.Save()`, and Flash is not written when the value equals the stored content;
- All key-value data types must be POD and copy-storable;
- `Set()` returns `ErrorCode::FAILED` when the key does not exist or its size differs from the stored key, and `DatabaseRaw` returns `ErrorCode::FULL` when space is still insufficient after recycling; a failed add while constructing a `Key`, or a failed Flash read, write, or erase, stops at `REQUIRE`;
- To clear the database explicitly, call `Restore()` of the concrete implementation class.

---

## Application Scenarios

- Parameter storage for embedded devices;
- Persistent storage of state checkpoints;
- Configuration persistence across multiple modules;
- Key-value storage on memory-constrained devices;

---

## Example Tests

Tests are in [`test/automatic/middleware/database/`](https://github.com/xrobot-org/libxr/tree/master/test/automatic/middleware/database) of the LibXR repository: `database/test_database.cpp` checks `Key` reads, writes, and error codes; `raw_sequential/` checks repeated updates, reopening, and Flash failures; `raw/` also covers size mismatches and damaged-block recovery.
