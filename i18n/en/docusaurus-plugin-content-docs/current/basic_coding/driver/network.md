---
id: network
title: Network and Wi-Fi
sidebar_position: 14
---

# Network and Wi-Fi

`NetworkInterface` defines enablement, link state and address queries. `WifiClient` extends it with Wi-Fi connection and scanning.

## IP and MAC addresses

`net/net.hpp` provides raw IPv4 and MAC representations:

```cpp
#include "net/net.hpp"

LibXR::IPAddressRaw ip{{192, 168, 1, 20}};
char ip_text[LibXR::IPADDR_STRLEN]{};
ip.ToString(ip_text);

LibXR::MACAddressRaw mac{{0x02, 0x00, 0x00, 0x00, 0x00, 0x01}};
char mac_text[LibXR::MACADDR_STRLEN]{};
mac.ToString(mac_text);
```

`IPAddressRaw::FromString()` and `MACAddressRaw::FromString()` parse their respective fields. Validate syntax and ranges before passing untrusted protocol input to these helpers.

## NetworkInterface

```cpp
class NetworkInterface
{
 public:
  virtual bool Enable() = 0;
  virtual void Disable() = 0;
  virtual bool IsConnected() const = 0;
  virtual IPAddressRaw GetIPAddress() const = 0;
  virtual MACAddressRaw GetMACAddress() const = 0;
};
```

The common interface describes network state. Enablement, DHCP, reconnect behavior and device lifetime are implemented by each backend.

## WifiClient

`WifiClient::Config` contains SSID, password, security mode, DHCP selection, and optional enterprise/static-IP configuration.

```cpp
LibXR::WifiClient::Config config{};
std::snprintf(config.ssid, sizeof(config.ssid), "%s", "MyAP");
std::snprintf(config.password, sizeof(config.password), "%s", "password");
config.security = LibXR::WifiClient::Security::WPA2_PSK;
config.use_dhcp = true;
```

Main operations are:

```cpp
virtual WifiError Connect(const Config& config) = 0;
virtual WifiError Disconnect() = 0;
virtual WifiError Scan(ScanResult* out_list,
                       size_t max_count,
                       size_t& out_found) = 0;
virtual int GetRSSI() const = 0;
```

`Scan()` writes into caller-provided storage and returns the valid count in `out_found`. `WifiError` distinguishes timeout, authentication, DHCP, missing SSID, invalid configuration and hardware failures.

Enterprise and static-IP settings are referenced by pointer from `Config`. Keep those configuration objects and strings valid while the backend uses them.
