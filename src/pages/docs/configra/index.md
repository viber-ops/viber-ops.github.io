---
layout: ../../../layouts/Docs.astro
title: 认识 Configra
description: 面向研发与运维的自托管配置服务，集中管理应用配置、敏感值与机器访问。
source: README.md
---

Configra 管理按环境区分的 YAML / JSON 配置，以及可被配置引用的 Vault 字段。应用通过 HTTPS API、Go SDK 或 Kubernetes 集成获取已经解析好的内容，不需要在客户端拼接密钥引用。

## 它解决什么问题

当配置散落在代码仓库、部署脚本和多个集群中，修改同一个值容易遗漏，交接也很难知道哪个版本正在使用。Configra 提供共同的管理界面、配置历史和访问记录，把“维护来源”和“应用消费”分开。

- **研发**：读取最终配置，按业务逻辑验证并应用变更。
- **运维**：管理环境、版本、访问 Token、CA 和客户端证书。
- **平台团队**：通过 CSI 或原生 Secret / ConfigMap 接入现有 Pod。

## 选择你的接入路径

| 你的应用                     | 推荐起点                                                           | 更新如何生效                                        |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- |
| 可以修改 Go 代码             | [Go SDK](/docs/configra/go-sdk/)                                   | 应用接收新快照并执行自己的重载逻辑                  |
| 只读取配置文件               | [CSI 文件挂载](/docs/configra/kubernetes/#csi-文件挂载)            | 驱动轮换文件，应用重新读取                          |
| 已使用 envFrom 或原生 volume | [原生同步](/docs/configra/kubernetes/#原生-secret--configmap-同步) | volume 按 Kubernetes 机制刷新；环境变量需要替换 Pod |
| 先看看管理体验               | [本地体验](/docs/configra/quickstart/)                             | 启动开发栈并通过浏览器管理                          |

## 服务如何组成

同一个 `configra` 二进制有两种运行模式：**Management** 提供 Web UI、OIDC 登录和管理操作；**API** 面向机器提供配置读取。两者共享 MySQL 和外部 Master Key，可分别部署为 Kubernetes Deployment。

MySQL 保存事务状态，NATS 传递尽力而为的访问事件，ClickHouse 保存 Access / Audit 日志。Go SDK 与 Kubernetes 集成是消费者，不是 Configra 自身启动所需的配置来源。

## 使用前先了解边界

当前发布为 `v0.1.0-rc.1`。它适合可信团队评估和试用，不代表已经完成生产验收。

机器 Token 的权限是 **Environment 范围**，不是单个 Config 或 Vault Namespace 范围。UI 中的 Admin / Viewer 也是工作区级角色。需要互不信任的租户隔离时，不应把 Namespace 当成安全边界。

下一步可以[运行本地体验](/docs/configra/quickstart/)，或先阅读[安全边界](/docs/configra/security/)。
