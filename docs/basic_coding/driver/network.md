---
id: network
title: 网络接口与 Wi-Fi
sidebar_position: 14
---

# 网络接口与 Wi-Fi

`NetworkInterface` 定义网络接口的启停、连接状态和地址查询；`WifiClient` 在此基础上增加 Wi-Fi 连接与扫描。

## IP 与 MAC 地址

`net/net.hpp` 提供 IPv4 与 MAC 地址的原始表示：

```cpp
#include "net/net.hpp"

LibXR::IPAddressRaw ip{{192, 168, 1, 20}};
char ip_text[LibXR::IPADDR_STRLEN]{};
ip.ToString(ip_text);

LibXR::MACAddressRaw mac{{0x02, 0x00, 0x00, 0x00, 0x00, 0x01}};
char mac_text[LibXR::MACADDR_STRLEN]{};
mac.ToString(mac_text);
```

`IPAddressRaw::FromString()` 与 `MACAddressRaw::FromString()` 负责从字符串读取字段；协议入口如果接收不可信文本，应在调用前校验格式和范围。

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

接口只描述公共网络状态。启用方式、DHCP、重连和底层设备生命周期由具体后端实现。

## WifiClient

`WifiClient::Config` 包含 SSID、密码、安全类型、DHCP 选择，以及可选的企业认证和静态 IP 配置。

```cpp
LibXR::WifiClient::Config config{};
std::snprintf(config.ssid, sizeof(config.ssid), "%s", "MyAP");
std::snprintf(config.password, sizeof(config.password), "%s", "password");
config.security = LibXR::WifiClient::Security::WPA2_PSK;
config.use_dhcp = true;
```

主要接口：

```cpp
virtual WifiError Connect(const Config& config) = 0;
virtual WifiError Disconnect() = 0;
virtual WifiError Scan(ScanResult* out_list,
                       size_t max_count,
                       size_t& out_found) = 0;
virtual int GetRSSI() const = 0;
```

`Scan()` 将结果写入调用方提供的数组，`out_found` 给出实际条目数。`WifiError` 区分连接超时、认证失败、DHCP 失败、SSID 不存在、配置错误和硬件故障等状态。

企业认证与静态 IP 配置通过指针挂到 `Config` 上，在后端使用这些字段期间保留对应配置对象和字符串。
