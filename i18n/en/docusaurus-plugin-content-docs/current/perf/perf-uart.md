---
id: perf-uart
title: UART Performance Testing
sidebar_position: 1
---

# UART Performance Testing

A common question about this framework is whether its abstraction over low-level drivers causes significant performance loss.

Using LibXR instead of vendor SDKs (e.g., HAL, ESP-IDF) and managing DMA directly can add slight overhead, but the loss is minimal. The following sections include test results for your own analysis.

## Test Environment

The UART driver is one of the most complex parts of LibXR. The testing environment is as follows:

* STM32F103C8, Cortex-M3 @ 72MHz  
* CH32V307VC, RISC-V @ 144MHz  
* STM32F407IG, Cortex-M4 @ 168MHz  
* In Debug mode, only user code is compiled with `-Og` optimization; HAL, FreeRTOS, USB, and other libraries use `-O2`. In Release mode, all are optimized with `-O3`.
* The TX and RX pins of USART1 are connected with jumper wires; data bits: 8, stop bit: 1, no flow control, no parity.
* After receiving data, each entire packet is checked with CRC. Every second, the number of successful transmissions, failed transmissions, and total CRC errors is counted.

## Test Code

Synchronous transmission and reception each use a separate thread. Although context switching introduces some performance overhead, the impact is minimal. For maximum performance, asynchronous transmission and reception can be used.

```cpp
  constexpr size_t BUFFER_SIZE = 32;
  constexpr size_t BAUDRATE = 2000000;

  static uint8_t read_buffer[BUFFER_SIZE], write_buffer[BUFFER_SIZE];
  static uint32_t count_read = 0, count_write = 0, count_error = 0;

  for (uint32_t i = 0; i < sizeof(write_buffer); i++) {
    write_buffer[i] = i;
  }

  STDIO::write_ = uart_cdc.write_port_;

  void (*fun)(void *) = [](void *) {
    LibXR::STDIO::Printf<"read count: %d, write count: %d, error count: %d\r\n">(
        count_read, count_write, count_error);
    LibXR::STDIO::Printf<"speed: %d BAUD\r\n">(
        count_read * 10 * sizeof(write_buffer));
    count_read = 0;
    count_write = 0;
  };

  auto print_task =
      LibXR::Timer::CreateTask(fun, reinterpret_cast<void *>(0), 1000);
  LibXR::Timer::Add(print_task);
  LibXR::Timer::Start(print_task);

  void (*thread_read)(LibXR::UART *) = [](LibXR::UART *uart) {
    LibXR::Semaphore sem(0);
    LibXR::ReadOperation op(sem);
    while (true) {
      uart->Read(read_buffer, op);
      if (LibXR::CRC8::Verify(read_buffer, sizeof(read_buffer))) {
        count_read++;
      } else {
        count_error++;
      }
    }
  };

  void (*thread_write)(LibXR::UART *) = [](LibXR::UART *uart) {
    LibXR::Semaphore sem(1);
    LibXR::WriteOperation op(sem);

    uart->SetConfig({BAUDRATE, LibXR::UART::Parity::NO_PARITY, 8, 1});

    while (true) {
      write_buffer[0]++;
      write_buffer[sizeof(write_buffer) - 1] = LibXR::CRC8::Calculate(
          write_buffer, sizeof(write_buffer) - sizeof(uint8_t));

      uart->Write(write_buffer, op);
      count_write++;
    }
  };

  LibXR::Thread read_thread, write_thread;

  read_thread.Create(reinterpret_cast<LibXR::UART *>(&usart1), thread_read,
                     "read_thread", 2048,
                     static_cast<LibXR::Thread::Priority>(4));

  write_thread.Create(reinterpret_cast<LibXR::UART *>(&usart1), thread_write,
                      "write_thread", 2048,
                      static_cast<LibXR::Thread::Priority>(3));

  while (true) {
    LibXR::Thread::Sleep(UINT32_MAX);
  }
```

## Speed Test Results

### STM32F1, -Og, 32-byte packets, 2M baud

32 bytes is close to the actual size of a typical UART data packet. At a baud rate of 2 Mbps, this configuration can approach the theoretical maximum throughput of the serial port.

```bash
read count: 6000, write count: 5999, error count: 0
speed: 1920000 BAUD
read count: 6000, write count: 6000, error count: 0
speed: 1920000 BAUD
read count: 5999, write count: 6000, error count: 0
speed: 1919680 BAUD
read count: 6000, write count: 5999, error count: 0
speed: 1920000 BAUD
read count: 6000, write count: 6000, error count: 0
speed: 1920000 BAUD
read count: 5999, write count: 6000, error count: 0
speed: 1919680 BAUD
```

### STM32F1, -O3, 32-byte packets, 2M baud

There is no significant difference under O3 optimization.

```bash
read count: 6000, write count: 5999, error count: 0
speed: 1920000 BAUD
read count: 5999, write count: 6000, error count: 0
speed: 1919680 BAUD
read count: 6000, write count: 6000, error count: 0
speed: 1920000 BAUD
read count: 6000, write count: 5999, error count: 0
speed: 1920000 BAUD
read count: 5999, write count: 6000, error count: 0
speed: 1919680 BAUD
read count: 6000, write count: 6000, error count: 0
speed: 1920000 BAUD
```

### STM32F1, -Og, 128-byte packets, 4M baud

Larger data packets and higher baud rate.

```bash
read count: 3061, write count: 3061, error count: 0
speed: 3918080 BAUD
read count: 3062, write count: 3062, error count: 0
speed: 3919360 BAUD
read count: 3062, write count: 3062, error count: 0
speed: 3919360 BAUD
read count: 3061, write count: 3061, error count: 0
speed: 3918080 BAUD
read count: 3062, write count: 3062, error count: 0
speed: 3919360 BAUD
read count: 3063, write count: 3062, error count: 0
speed: 3920640 BAUD
```

### CH32V307, -Og, 64-byte packets, 9M baud

At a baud rate of 9 Mbps, the theoretical maximum throughput can still be achieved.

```bash
read count: 14000, write count: 14000, error count: 0
speed: 8960000 BAUD
read count: 14000, write count: 14000, error count: 0
speed: 8960000 BAUD
read count: 14000, write count: 14000, error count: 0
speed: 8960000 BAUD
read count: 14000, write count: 14000, error count: 0
speed: 8960000 BAUD
read count: 14000, write count: 14000, error count: 0
speed: 8960000 BAUD
read count: 14000, write count: 14000, error count: 0
speed: 8960000 BAUD
```

## System Call Analysis

When the speed is already near the theoretical maximum, further benchmarking becomes meaningless. Here, STM32F4 and SystemView are used to visualize the system calls during transmission and reception. The transmission and reception processes themselves are completely lock-free; all system calls are related only to the semaphores required for thread wakeup and synchronization.

### Lower Baud Rates

At lower baud rates, multiple packets are concatenated together, making it impossible to trigger the IDLE interrupt. The write thread is periodically woken up, while the read thread is woken up only when the buffer is half or fully filled by an interrupt.

![Low Speed](/img/perf_uart_low_speed.png)

### Higher Baud Rates

At higher baud rates, the transmit and receive threads are alternately woken up.

![High Speed](/img/perf_uart_high_speed.png)

## Summary

After abstracting low-level UART drivers, LibXR introduces minimal performance overhead. On the STM32F103 (72MHz, no FPU or Cache), it achieves up to **~4 Mbps** real throughput with **0 errors**, even under multithreaded FreeRTOS conditions.
