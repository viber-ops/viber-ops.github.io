---
layout: ../../../layouts/Docs.astro
title: 认识 Configra
description: Configra 是什么、适合谁用，以及第一次应该从哪里开始。
source: README.md
---

Configra 是一个需要自己部署的配置管理服务。你在网页里管理应用配置、数据库密码和证书，应用再从 Configra 读取需要的内容。

例如，支付服务在开发环境和生产环境使用不同的数据库密码。你可以在 Configra 里分别保存这两组值，让应用按环境读取，不必把密码写进代码仓库。

## 先从哪里开始

如果只是想看看能不能解决你的问题，先按[本地体验](/docs/configra/quickstart/)启动网页、创建一份配置。暂时不需要准备 Kubernetes 集群，也不需要先学证书签发。

已有 Configra 服务、准备接入应用时，再选择下面的方式：

| 你的应用怎么读配置 | 阅读哪一篇 | 配置更新后还要做什么 |
| --- | --- | --- |
| Go 程序直接请求配置 | [Go SDK](/docs/configra/go-sdk/) | 在程序里校验并应用新配置 |
| Kubernetes 中的程序读取文件 | [CSI 文件挂载](/docs/configra/kubernetes/#csi-文件挂载) | 开启文件更新，并让程序重新读文件 |
| 已使用 Secret / ConfigMap | [同步到 Kubernetes](/docs/configra/kubernetes/#原生-secret--configmap-同步) | 文件需要重新读取；环境变量需要重新创建 Pod |

## 网页里管理什么

- **环境（Environment）**：例如开发、测试、生产，用来区分同一应用的配置。
- **配置（Config）**：应用要读取的 YAML 或 JSON 文件。
- **Vault**：保存可被多份配置引用的值，例如数据库账号、密码和证书文件。这里是 Configra 自己的功能，不是另一个需要部署的 HashiCorp Vault。
- **访问凭据**：决定哪个应用可以读取哪个环境，包括 Token 和客户端证书。

不认识界面里的英文名称时，可以查[名词说明](/docs/configra/concepts/)。

## 部署时需要什么

Configra 有两个进程：`management` 提供网页和管理操作，`api` 供应用读取配置。只启动网页，不会同时启动读取接口。

它们共用 MySQL 和一个用于加解密的主密钥（Master Key）。正式部署还需要登录系统、NATS 消息服务、ClickHouse 日志数据库和 HTTPS 证书。[部署指南](/docs/configra/deployment/)逐项说明这些依赖；本地体验会准备演示用的版本。

## 使用前要知道

当前服务版本是 **v0.1.0-rc.2 预发布**，适合评估和试用，尚未完成生产验收。

一个 Token 获得某个环境的权限后，可以读取该环境下的所有配置和 Vault 值，不能只授权单个条目。网页里的管理员和只读用户也是整个工作区的角色。如果几个团队或应用不能互相访问数据，不要仅靠文件夹或命名来隔离，应使用独立部署或其他符合要求的方案。

[查看目前的限制](/docs/configra/security/) · [开始本地体验](/docs/configra/quickstart/)
