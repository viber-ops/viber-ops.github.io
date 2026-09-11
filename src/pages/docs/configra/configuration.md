---
layout: ../../../layouts/Docs.astro
title: 配置与 Vault
description: 从结构化配置到共享敏感值，用明确的引用关系管理不同环境。
source: docs/design.md
---

## 管理配置

先创建 Environment，再在 Configs 中为应用创建 YAML 或 JSON 文档。日常非敏感参数可以直接保存在 Config；共用凭据则放进 Vault 后引用。

```yaml
server:
  port: 8080
  log_level: info
database:
  host: postgres.internal
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

保存前确认当前 Environment，保存后通过历史与比较功能检查变更。克隆配置到其他环境后，需要确认引用的 Vault Item 在目标环境存在对应值；不要假定克隆会完成所有凭据迁移。

## 使用 Vault 字段

- **Text**：用户名、普通标识等文本值。
- **Secret**：密码、访问凭据等需要显式展示的值。
- **File**：证书或其他需要保持原始字节的文件，通过独立 File 接口读取。

界面默认隐藏敏感值，显式展示会产生 Access 事件。截图和工单中同样不要暴露真实值。访问日志是尽力而为的投递，不应把“界面能看到记录”等同于零丢失的合规保证。

![Vault 工作台中的字段与环境变体](/assets/configra/vault-light.png)

_上图为演示数据，引用与版本信息可见，敏感值保持隐藏。_

## 变更如何到达应用

修改 Config 或其引用的 Vault 值，不等于应用立刻采用新配置。后续读取将获得新的内容或 ETag；消费者需要执行对应的刷新机制。

| 消费方式                       | 你需要做什么                                                     |
| ------------------------------ | ---------------------------------------------------------------- |
| Go 直接读取                    | 再次请求、解析并应用                                             |
| Viper Watch                    | 开启 Watch，在回调中处理应用状态切换                             |
| CSI 挂载                       | 开启驱动轮换，并确保应用会重读文件                               |
| 原生 Secret / ConfigMap volume | 等待 Kubernetes 更新，应用重读文件；不要用需要自动刷新的 subPath |
| envFrom                        | 替换 Pod，让新进程读取新环境变量                                 |

## 历史与回退

历史用于查看和比较已保存版本。回退时应把确认过的内容保存为新的当前版本，再检查消费者是否成功读取和应用。

Config 引用默认指向 Vault 的当前值。因此，仅恢复旧的 Config 文本，不会自动恢复它当时用到的 Vault 敏感值。需要协调相关字段变更，并验证最终解析结果。

## 大小与失败

标准机器读取的 Config / File 内容上限为 5 MiB；Kubernetes 集成限制更小。引用缺失、格式无效或权限不足时，应修正来源，不要通过关闭 TLS 校验来排障。

共享的 Vault Namespace 只用于组织。把条目从一个 Namespace 移到另一个 Namespace，不会自动获得更窄的 Token 权限。
