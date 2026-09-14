---
id: serialized-service
title: SerializedService
sidebar_position: 5
---

# SerializedService

`SerializedService` coalesces events in one atomic state word and allows only one caller at a time to execute the handler. It is useful when several entry points can advance the same backend state machine, such as request submission, DMA completion and device events.

## Invoke

```cpp
#include "serialized_service.hpp"

LibXR::SerializedService service;
constexpr uint32_t RX_EVENT = 1U << 0;
constexpr uint32_t TX_EVENT = 1U << 1;

service.Invoke(RX_EVENT | TX_EVENT, false,
    [](uint32_t events, bool in_isr) noexcept
    {
      if (events & RX_EVENT)
      {
        // Advance receive state.
      }
      if (events & TX_EVENT)
      {
        // Advance transmit state.
      }
      (void)in_isr;
    });
```

`Invoke(events, in_isr, handler)` publishes low-31-bit events and attempts to claim execution. It returns `true` when this call ran the handler. `false` means another caller already owns execution and will observe the published event.

Events arriving while the handler runs are processed in another drain round before ownership is released.

## Publish

```cpp
service.Publish(TX_EVENT);
```

`Publish()` records events without invoking a handler. Use it when an executor is already active or a later `Invoke()` is guaranteed.

## Event semantics

A bit means “recheck this class of state.” Repeated occurrences of one bit coalesce before processing, so handlers inspect the actual queues, registers or backend state to determine the amount of work.

The high bit stores internal ownership; user events occupy the lower 31 bits.

All entry points for one service should use the same processing logic. A losing `Invoke()` does not retain its handler for later execution.
