---
id: gpio
title: GPIO
sidebar_position: 1
---

# GPIO (General Purpose Input/Output)

`LibXR::GPIO` provides a cross-platform abstract interface for general purpose input/output (GPIO), supporting multiple input/output modes and interrupt callback mechanisms. Users can inherit this interface to implement platform-specific GPIO control logic.

## Interface Overview

### Configuration Enums

```cpp
enum class Direction : uint8_t {
  INPUT,                 // Input mode
  OUTPUT_PUSH_PULL,      // Push-pull output
  OUTPUT_OPEN_DRAIN,     // Open-drain output
  FALL_INTERRUPT,        // Falling edge interrupt
  RISING_INTERRUPT,      // Rising edge interrupt
  FALL_RISING_INTERRUPT  // Both-edge interrupt
};

enum class Pull : uint8_t {
  NONE,  // No pull
  UP,    // Pull-up
  DOWN   // Pull-down
};
```

### Configuration Structure

```cpp
struct Configuration {
  Direction direction;  // Pin direction
  Pull pull;            // Pull configuration
};
```

### Callback Type

```cpp
using Callback = LibXR::Callback<>;
```

### Construction and Configuration

```cpp
GPIO();  // Default constructor
virtual ErrorCode SetConfig(Configuration config) = 0;
```

### Pin Control

```cpp
virtual bool Read() = 0;              // Read pin level
virtual void Write(bool value) = 0;   // Write pin level
```

### Interrupt Control

```cpp
virtual ErrorCode EnableInterrupt() = 0;   // Enable interrupt
virtual ErrorCode DisableInterrupt() = 0;  // Disable interrupt
```

### Register Event Callback

```cpp
using Callback = LibXR::Callback<>;
ErrorCode RegisterCallback(Callback callback); // Register interrupt handler
```

`RegisterCallback()` only stores the callback in `callback_` and returns `ErrorCode::OK`. Receiving interrupt callbacks also requires an interrupt direction set through `SetConfig()` and a call to `EnableInterrupt()`.

## Feature Summary

- Supports multiple configuration modes: input, output, interrupt;  
- Provides a type-safe configuration structure;  
- Event handling uses a unified callback interface, callable in ISR or task context;  
- Platform implementations must fully define all virtual functions;  
- Can be integrated with other LibXR modules such as Topic, Timer, etc.
