---
id: flash
title: Flash Interface
sidebar_position: 9
---

# Flash (Flash Interface)

`LibXR::Flash` provides a cross-platform flash access interface for block erase and write. Existing backends are `STM32Flash`, `CH32Flash` (on-chip flash), and `LinuxBinaryFileFlash` (file-backed).

## Interface Definition

```cpp
class Flash {
public:
  Flash(size_t min_erase_size, size_t min_write_size, RawData flash_area);

  // Erase the specified region (starting offset and length)
  virtual ErrorCode Erase(size_t offset, size_t size) = 0;

  // Write data to the specified offset
  virtual ErrorCode Write(size_t offset, ConstRawData data) = 0;

  // Read data from the specified offset
  virtual ErrorCode Read(size_t offset, RawData data);

  // Get the minimum erasable block size
  size_t MinEraseSize() const;

  // Get the minimum writable block size
  size_t MinWriteSize() const;

  // Get the size of the flash
  size_t Size() const;
};
```

## Usage Notes

- Backends are typically organized around `MinWriteSize()` / `MinEraseSize()` granularity. Upper-layer layouts should be designed with those limits in mind, but the exact front-door acceptance rules remain backend-specific.
- `flash_area` is the storage region this `Flash` object operates on; `Size()` returns its length;
- `Read()` has a default implementation in the base class that copies from `flash_area`; when `flash_area` is directly addressable, a backend only implements `Erase()` and `Write()`;
- This interface can be used as a foundation for implementing parameter storage, file systems, log management, and more.
