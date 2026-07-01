---
id: event
title: Event System
sidebar_position: 3
---

# Event System

The `Event` class is a core middleware in LibXR designed for event-driven mechanisms. It supports event registration, triggering, interrupt-safe invocation, and event bridging.

## Module Features

- Register multiple callbacks based on **event IDs**;
- Supports **triggering in thread/interrupt contexts**;
- Use `GetList()` for **interrupt-safe event triggering**;
- Supports **event bridging**, allowing event forwarding across modules;
- Internally implemented using **red-black tree + lock-free list** for efficient and thread-safe storage.

---

## Quick Start

### Register an Event Callback

```cpp
int counter = 0;
LibXR::Event evt;
auto cb = LibXR::Event::Callback::Create(
    [](bool, int *cnt, uint32_t event) {
        (*cnt)++;
        ASSERT(event == 0x10);
    },
    &counter);

evt.Register(0x10, cb);
```

### Trigger Event

```cpp
evt.Active(0x10);  // Trigger in normal thread context
```

### Trigger from Interrupt Context (requires pre-caching list)

```cpp
// Obtain event list outside of callback
auto list = evt.GetList(0x1234);
// Trigger inside callback/ISR
evt.ActiveFromCallback(list, 0x1234, true);
```

### Event Binding

```cpp
evt_dst.Bind(evt_src, 0xA, 0xB);  // Triggers evt_dst with event 0xB when evt_src triggers 0xA
```

---

## Class Definition Overview

- `Event::Register(event, cb)`: Register a callback;
- `Event::Active(event)`: Trigger from thread context;
- `Event::ActiveFromCallback(list, event, in_isr)`: Trigger safely from callback/ISR paths;
- `Event::GetList(event)`: Retrieve and cache event list;
- `Event::Bind(src, id_src, id_dst)`: Set up event bridging;
- Internally uses `RBTree<uint32_t>` to manage event mappings, and `LockFreeList` to store callbacks.

---

## Example: Test Event Binding and Triggering

```cpp
int arg = 0;
auto cb = Event::Callback::Create([](bool, int* a, uint32_t e) {
  *a += 1;
}, &arg);

Event e1, e2;
e1.Register(0x1234, cb);
e2.Register(0x4321, cb);
e2.Bind(e1, 0x1234, 0x4321);
e1.Active(0x1234);  // arg += 2
```

---

## Application Scenarios

- Button/sensor interrupt event triggering;
- State notification in multi-task cooperation;
- Build event-message systems in combination with Topic/Message.

---

For more information, refer to the `event.hpp` source file.
