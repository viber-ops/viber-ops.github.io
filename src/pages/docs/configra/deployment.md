---
layout: ../../../layouts/Docs.astro
title: 部署 Configra 服务
description: Configra 自身运行在 Kubernetes 中，管理面与读取面分离，启动密钥保持外置。
source: deploy/kubernetes/README.md
---

## 运行拓扑

`configra management` 提供浏览器工作台、OIDC 登录、状态变更和日志处理；`configra api` 提供面向机器的读取接口。两种模式分别运行，使用相同 MySQL 数据库和 Master Key。

| 依赖              | 保存或提供什么                            | 部署要求                                                       |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------- |
| MySQL 8.0.22      | 配置、Vault、会话、Token、CA、事务 outbox | 仓库验证及恢复工具固定此版本；更换版本前需独立兼容性和安全评估 |
| NATS              | 尽力而为的 Access 事件传递                | 配置服务器、TLS 和凭据                                         |
| ClickHouse        | Access / Audit 日志                       | Management 需要可用的日志存储                                  |
| OIDC Provider     | 人类用户登录与角色 Claim                  | 注册真实客户端及回调地址                                       |
| Master Key        | 解密持久状态和 CA 签名私钥                | 外部提供、单独备份、所有副本一致                               |
| 服务端 HTTPS 证书 | Management 与 API 服务器身份              | 域名匹配，私钥外置                                             |

发布包并不自动安装这些生产依赖。尤其不要将仓库的开发账号与固定密码带入生产环境。

## 外部启动 Secrets

仓库 `deploy/kubernetes/base` 包含一个 Management Deployment 和一个可独立扩展的 API Deployment。在部署前，通过自己的密钥分发系统创建以下 Kubernetes Secrets：

| Secret                    | 数据键                                              |
| ------------------------- | --------------------------------------------------- |
| `configra-runtime`        | `mysql-dsn`、`clickhouse-dsn`、`oidc-client-secret` |
| `configra-management-tls` | `tls.crt`、`tls.key`                                |
| `configra-api-tls`        | `tls.crt`、`tls.key`                                |
| `configra-master-key`     | `master-key`：一个 base64 编码的 32 字节随机密钥    |
| `configra-nats`           | `nats.creds`、`ca.pem`                              |

Secret 的 Kubernetes 编码与 Master Key 内容本身的 base64 不是同一层：用 `kubectl create secret --from-file` 时，文件应包含 base64 文本，kubectl 会完成 API 数据层编码。不要重复解码或随 Pod 重启重新生成它。

**Configra 不通过自己的 provider 获取这些启动数据。** 否则在服务尚未运行或数据库恢复时，会形成无法自举的依赖循环。

## 配置 overlay

从标签源码构建镜像并推送到自己的 registry。修改 Kustomize overlay 中的镜像、域名、OIDC、NATS 和 Namespace，再渲染检查：

```sh
docker build -t registry.example.com/configra:0.1.0-rc.1 .
kubectl kustomize deploy/kubernetes/base
# 修改并检查自己的 overlay 后，再 kubectl apply -k 对应目录。
```

不要假定示例镜像可以直接拉取。原始示例的监听端口是 Management 8443、API 9443，Kubernetes Service 对外端口为 443。

## 入口与 TLS

Management 可以经由常规 HTTPS Ingress。机器 API 需要 **TCP / TLS passthrough**，让原始客户端证书到达 Configra。普通的 TLS 终止 Ingress 不能靠转发一个证书 Header 代替这段 mTLS 验证。

客户端使用的 API 地址必须与服务器证书中的域名匹配。创建工作台客户端 CA 不会改变 API 服务器 HTTPS 证书；已有外部客户端 CA 可以通过 `tls.client_ca_file` 额外保留。

## 首次启动与升级顺序

先启动 Management，检查 `/health/ready`，完成 OIDC Admin 登录并创建环境、Token 和客户端证书，再部署 API 与应用消费者。

升级 schema v1 到 v2 时，同样先升级 Management。它会在数据库锁下验证 Crypto Sentinel 并执行增量迁移，然后再升级 API。不要因 Master Key 错误而把恢复数据库当成新安装重新初始化。

Management 的嵌入版本化静态资源需要协调发布，默认 base 保留受控替换策略。数据库高可用、NetworkPolicy、备份保留、入口限流与恢复演练需要按你的基础设施落实，不由一套通用 YAML 自动保证。
