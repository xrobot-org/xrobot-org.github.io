---
id: xrusb-id
title: VID/PID and Serial Number Policy
sidebar_position: 4
---

# VID/PID and Serial Number Policy

XRUSB has been allocated PID 0x6199 under OpenMoko’s VID 0x1D50 via the community USB PID registry, and this VID/PID is used for example code and general-purpose development board firmware.

Under the following conditions, any firmware based on the XRUSB stack may reuse this VID/PID without purchasing an additional PID:

1. Different devices and vendors must be distinguished by the USB Serial Number.
2. The vendor prefix part of the Serial must be requested from the project maintainers and explicitly added to this document (there is no fee for this).
3. The Serial format is:

   ```text
   <VendorPrefix>-<ProductPrefix>-<UID_HEX>
   ```

   Detailed requirements are described below.

> Devices such as CMSIS-DAP that intentionally use specific identification strings for compatibility with existing host toolchains do not follow the default rules on this page. In those cases, follow the corresponding device-class page.

## Serial Rules

### 1. Vendor Prefix

- The vendor prefix identifies who is using this VID/PID.
  - The prefix length must be at least 6 characters.
  - The prefix must consist only of visible ASCII characters, no spaces or control characters are allowed.
  - There is no restriction on letter case, but it is recommended to stick to a single style for a given prefix: all-uppercase, all-lowercase, or Capitalized.
- Recommendations:
  - Use a name or abbreviation that clearly represents the team / company / school, for example: `XRobot`, `QDU-Future`, etc.
  - Very short or meaningless prefixes (e.g. a single letter like `X`, `A`, etc.) are not recommended.

### 2. Product / Project Prefix

- Defined by the vendor, used to distinguish different products or project lines.
- Must also only use visible ASCII characters; recommended length is 1–16 characters.
- Examples: `CDC`, `IMU`, `MainCtrl`, `RobotArm`, etc.

### 3. UID_HEX

- Read the raw bytes from the chip’s hardware UID and convert them to a hexadecimal string.
- It is recommended to use the full UID:
  - For example, many STM32 / CH32 parts have a 96-bit UID (12 bytes), which corresponds to 24 hex characters.
- Code supplies only the prefix: the third language-pack string is `<VendorPrefix>-<ProductPrefix>-`, and the UID is passed as `{addr, size}`, the last argument of the device constructor. The stack converts the raw UID bytes to an uppercase hex string and appends it to the prefix. UID addresses:
  - STM32: `{reinterpret_cast<void*>(UID_BASE), 12}`
  - CH32V2/V3: `{reinterpret_cast<void*>(0x1FFFF7E8), 12}`

> For the same physical device, the Serial should remain unchanged across firmware updates / reflashes.  
> In practice this usually means always deriving the Serial from the same hardware UID.

### 4. Examples

With the above rules, valid Serial examples include:

```text
XRobot-CDC-0123456789ABCDEF01234567
QDU-Future-MainCtrl-89ABCDEF0123456701234567
```

Where:

- `XRobot` / `QDU-Future` are vendor prefixes that have been requested and registered in this document;
- `CDC` / `MainCtrl` are product / project prefixes;
- The trailing part is `UID_HEX`.

## Allowed Usage

Under the rules of this document, VID/PID = 1D50:6199 may be reused for any commercial or personal project.
The XRUSB project does not provide any guarantees regarding compatibility, driver behavior, or how different operating systems treat this VID/PID.

Although any `(VID, PID, Serial)` combination that respects these rules should be globally unique,  
for large-scale commercial products it is still recommended to obtain an independent VID/PID,  
in order to have better control and brand independence.

## How to Request a Vendor Prefix

Vendor prefixes can be requested in any of the following ways (free of charge):

1. Open a GitHub issue in the repository, describing the requested prefix and its intended use;
2. Fork the repository, edit this document to add the requested vendor prefix under Assigned Prefixes, and submit a Pull Request;
3. Contact the maintainers via the project’s email / community / chat group (see the project homepage for details).

Once approved, the vendor prefix is added to the list below and the shared VID/PID may be used under the rules of this document.

## Assigned Prefixes

### XRobot Project Team

- `XRUSB-DEMO`: Used for XRUSB demos / examples  
- `XRobot`: Used for products released by XRobot  

### Qingdao University RoboMaster Future Team

- `QDU-Future`: Used for robot main controller
