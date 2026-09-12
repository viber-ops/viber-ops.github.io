---
layout: ../../../layouts/Docs.astro
title: 配置与 Vault
description: 保存 YAML 或 JSON，把共用密码放到 Vault，并了解修改什么时候被应用采用。
source: docs/design.md
---

## 管理配置

本篇假设你已完成[本地体验](/docs/configra/quickstart/)，或已有可以登录的服务。

先创建环境（Environment），再在配置（Configs）页面保存应用的 YAML 或 JSON。端口、日志级别等普通参数直接写入配置；共用密码放进 Vault，再写一个引用。

下面的 `postgres.internal` 只是示例地址，要换成应用实际使用的数据库地址。两个引用要求 `platform.database` 已有对应字段，并为当前环境填写了值：

```yaml
server:
  port: 8080
  log_level: info
database:
  host: postgres.internal
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

保存前先确认选中的环境，避免把测试参数改到生产环境。保存后查看历史，比较本次修改。复制配置到其他环境时，还要为引用的 Vault 字段准备那个环境的值；复制配置不会自动复制所有密码。

## 使用 Vault 字段

- **Text**：用户名、普通标识等文本值。
- **Secret**：密码、访问凭据等需要显式展示的值。
- **File**：证书或其他需要保持原始字节的文件，通过独立 File 接口读取。

敏感值默认隐藏，需要时再点击显示。读取会生成 Access（访问）事件，但发送失败时记录可能丢失。不要把它当作每次读取都必定有记录的保证，也不要把真实密码放入截图或工单。

![Vault 工作台中的字段与环境变体](/assets/configra/vault-light.png)

_上图为演示数据，引用与版本信息可见，敏感值保持隐藏。_

## 变更如何到达应用

**保存成功，不等于应用已经使用了新值。** 后续读取会返回新内容；应用如何发现和采用变化，取决于它的读取方式：

| 读取方式                       | 你需要做什么                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| Go 直接读取                    | 再次请求、解析并应用                                             |
| Viper Watch                    | 开启 Watch，在回调中处理应用状态切换                             |
| CSI 挂载                       | 开启驱动轮换，并确保应用会重读文件                               |
| 原生 Secret / ConfigMap volume | 等待 Kubernetes 更新，应用重读文件；不要用需要自动刷新的 subPath |
| envFrom                        | 替换 Pod，让新进程读取新环境变量                                 |

## 历史与回退

历史用于查看和比较已保存版本。回退时把确认过的旧内容保存为新的当前版本，再检查应用是否成功读取并采用。

Config 引用默认指向 Vault 的当前值。因此，仅恢复旧的 Config 文本，不会自动恢复它当时用到的 Vault 敏感值。需要协调相关字段变更，并验证最终解析结果。

## 大小与失败

标准机器读取的 Config / File 内容上限为 5 MiB；Kubernetes 集成限制更小。引用缺失、格式无效或权限不足时，应修正来源，不要通过关闭 TLS 校验来排障。

Vault Namespace 只用于分组，不会缩小 Token 的环境读取权限。
