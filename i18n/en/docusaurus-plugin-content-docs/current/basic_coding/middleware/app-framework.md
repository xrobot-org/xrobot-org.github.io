---
id: app-framework
title: Application Framework
sidebar_position: 1
---

# Application Framework

The `Application` framework is one of the core middleware components in LibXR. It is responsible for managing device registration and application module scheduling, serving as the foundation for system integration and runtime control in XRobot.

## Module Composition

- **HardwareContainer**: A hardware container class that supports device object registration, lookup, and alias management.
- **Application**: An abstract base class for application modules, requiring the implementation of the `OnMonitor()` method.
- **ApplicationManager**: A module scheduler used to manage multiple Application instances and perform periodic tasks.

---

## HardwareContainer: Device Registration and Lookup

```cpp
HardwareContainer container(
  Entry<UART>{uart1, {"uart1", "console"}},
  Entry<GPIO>{gpio1, {"gpio1", "LED"}}
);
```

Features:

- Multiple alias registration: the same object can be registered with multiple aliases.
- Type-safe lookup: supports template-based lookup using `Find<T>("alias")`.
- Assert on lookup failure: `FindOrExit<T>({...})` exits with an error if not found.

---

## Application / ApplicationManager: Unified Application Module Management

```cpp
class MyApp : public Application {
 public:
  void OnMonitor() override {
    // User-defined periodic task logic
  }
};

MyApp app;
LibXR::ApplicationManager manager;
manager.Register(app);
manager.MonitorAll();  // Periodically calls OnMonitor() of all modules
```

Features:

- Register any number of modules;
- Use a lock-free structure `LockFreeList` to store modules;
- Suitable for implementing periodic task scheduling, module state polling, etc.

---

## Integration with XRobot

The XRobot system's auto-generation tools will automatically generate registration code for each module, uniformly invoking `HardwareContainer` and `ApplicationManager` to construct device registration and main loop scheduling.

This lets all modules be registered modularly and run independently of the platform.

---

For more examples and usage, refer to `xrobot_main.cpp` or the template-generated code.
