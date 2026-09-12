---
layout: ../../../layouts/Docs.astro
title: 部署 Configra 服务
description: 在 Kubernetes 中部署 Configra 服务，逐项准备数据库、登录系统、证书和主密钥。
source: deploy/kubernetes/README.md
---

这篇面向负责部署和维护服务的人，不是一键安装脚本。需要一个可用的 Kubernetes 集群、部署权限和下方的外部依赖。只是想试用网页，请先看[本地体验](/docs/configra/quickstart/)。

下面说明部署顺序和需要替换的设置。仓库 YAML 是示例，域名、镜像和凭据不能原样照搬。

## 先了解两个进程

`configra management` 供人使用：打开网页、登录、修改配置和查看日志。`configra api` 供应用使用：读取配置和文件。两者分别运行，共用同一个 MySQL 数据库和 Master Key（用于解密数据库内容的主密钥）。

| 依赖              | 保存或提供什么                            | 部署要求                                                       |
| ----------------- | ----------------------------------------- | -------------------------------------------------------------- |
| MySQL 8.0.22      | 配置、密码、登录会话、Token、CA 和待发送的审计记录 | 仓库验证及恢复工具固定此版本；更换版本前需独立兼容性和安全评估 |
| NATS              | 发送访问日志，发送失败时可能丢失                | 配置服务器、TLS 和凭据                                         |
| ClickHouse        | Access / Audit 日志                       | Management 需要可用的日志存储                                  |
| OIDC Provider     | 网页用户登录，并提供用户角色                  | 注册真实客户端及回调地址                                       |
| Master Key        | 解密持久状态和 CA 签名私钥                | 外部提供、单独备份、所有副本一致                               |
| 服务端 HTTPS 证书 | Management 与 API 服务器身份              | 域名匹配，私钥外置                                             |

发布包不会自动安装这些依赖。OIDC 是 Configra 与登录系统连接的协议；需要在登录系统里注册应用，并配置回调地址和角色映射。不要把开发账号和固定密码带入正式环境。

## 准备启动需要的 Secret

仓库 `deploy/kubernetes/base` 包含一个 Management Deployment 和一个可独立扩展的 API Deployment。在部署前，通过自己的密钥分发系统创建以下 Kubernetes Secrets：

| Secret                    | 数据键                                              |
| ------------------------- | --------------------------------------------------- |
| `configra-runtime`        | `mysql-dsn`、`clickhouse-dsn`、`oidc-client-secret` |
| `configra-management-tls` | `tls.crt`、`tls.key`                                |
| `configra-api-tls`        | `tls.crt`、`tls.key`                                |
| `configra-master-key`     | `master-key`：一个 base64 编码的 32 字节随机密钥    |
| `configra-nats`           | `nats.creds`、`ca.pem`                              |

这些 Secret 存在于 Configra 服务的命名空间，不是应用读取配置时使用的 `configra-credentials`。

Master Key 只在首次部署时生成一次，之后恢复和重启都使用原来的那一份。Secret 的 Kubernetes 编码与 Master Key 内容本身的 base64 不是同一层：用 `kubectl create secret --from-file` 时，文件应包含 base64 文本，kubectl 会完成 API 数据层编码。不要重复解码或随 Pod 重启重新生成它。

**Configra 不通过自己的 provider 获取这些启动数据。** 因为 Configra 必须先拿到它们才能启动，不能等启动后再向自己索取。

## 修改部署配置

registry 是你保存容器镜像的仓库；overlay 是 Kustomize 的部署定制目录。先从发布标签构建镜像，推送到自己的镜像仓库，再在定制目录替换镜像、域名、OIDC、NATS 和命名空间。

下面只展示构建和渲染检查。`registry.example.com` 必须替换，`kubectl kustomize` 只打印 YAML，不会部署；确认输出后才对自己的定制目录执行 `kubectl apply -k`：

```sh
docker build -t registry.example.com/configra:0.1.0-rc.2 .
kubectl kustomize deploy/kubernetes/base
# 修改并检查自己的 overlay 后，再 kubectl apply -k 对应目录。
```

不要假定示例镜像可以直接拉取。原始示例的监听端口是 Management 8443、API 9443，Kubernetes Service 对外端口为 443。

## 入口与 TLS

Management 可以经由常规 HTTPS Ingress。机器 API 需要 **TCP / TLS passthrough**，让原始客户端证书到达 Configra。也就是让 TLS 连接直接到达 Configra，由它核验客户端证书。若 Ingress 提前解密并终止这段连接，仅转发一个证书 Header 不能代替验证。

客户端使用的 API 地址必须与服务器证书中的域名匹配。创建工作台客户端 CA 不会改变 API 服务器 HTTPS 证书；已有外部客户端 CA 可以通过 `tls.client_ca_file` 额外保留。

## 首次启动与升级顺序

先启动 Management，检查 `/health/ready`，确认 Admin 可以登录并创建环境、Token 和客户端证书，再启动 API 并接入应用。

升级 schema v1 到 v2 时，同样先升级 Management。它会先通过 Crypto Sentinel（数据库内的加密校验记录）确认 Master Key 正确，再在数据库锁保护下更新结构；之后才升级 API。不要因 Master Key 错误而把恢复数据库当成新安装重新初始化。

Management 的嵌入版本化静态资源需要协调发布，默认 base 保留受控替换策略。数据库高可用、NetworkPolicy、备份保留、入口限流与恢复演练需要按你的基础设施落实，不由一套通用 YAML 自动保证。
