---
layout: ../../../layouts/Docs.astro
title: CA 与客户端证书
description: 在工作台生成客户端 CA、持续签发、轮换与吊销证书，减少手工证书操作。
source: docs/managed-certificates.md
---

## 创建 CA

用 OIDC Admin 身份进入 Administration，创建一个用于机器客户端认证的 CA。默认有效期为 5 年，上限 10 年。

创建成功的首次响应提供备份 ZIP，包含 CA 公共证书与私钥。需要备份时，必须在关闭导出窗口前保存到受控位置；之后只能再次下载公共证书，不能再次导出私钥。

Configra 在 MySQL 中加密保留 CA 签名私钥，因此即使没有下载备份，也能持续在线签发。加密依赖部署时外部提供的 Master Key。

## 签发客户端证书

选择 CA，为一个工作负载签发独立客户端证书。默认有效期 90 天，上限 1 年，且不能超过 CA 的到期时间。密钥使用 ECDSA P-256，私钥为 PKCS#8 格式。

保存首次 ZIP 中的 `client.crt` 和 `client.key`，通过部署系统安全地交给应用。客户端私钥不会保存在 Configra 服务端。

首次响应或 ZIP 丢失后，不能通过重试恢复私钥导出。应吊销该凭据并重新签发。创建请求的幂等重放仅返回元数据，即使请求落到不同 Management 副本也不会再次返回私钥。

![Administration 中的 CA 管理界面](/assets/configra/authorities.png)

## 轮换与吊销

推荐在证书到期前签发替代凭据，部署后验证新连接，再吊销旧凭据。Go SDK 支持 `GetClientCertificate` 回调配合证书原子替换；替换后关闭空闲连接，触发下一次 TLS 握手。

吊销客户端证书不可撤销。吊销 CA 会同时阻止其下客户端继续授权读取，包括用导出的 CA 私钥离线签发、再导入的证书。API 对每个读取请求检查证书和签发者状态，已有 TLS 连接不能绕过吊销。

吊销只阻止后续读取，不能收回已经交付给应用、挂载到 Pod 或同步到 Secret 中的明文字节。

## Kubernetes 中的持久性

CA 状态保存在 MySQL，不在 Pod 内存或临时文件中。所有 Management / API 副本必须使用同一数据库与 Master Key。API 副本每 5 秒刷新公共 CA 信任池，新 CA 建立后可能需要等待传播。

备份数据库与单独受保护的 Master Key。丢失 Master Key 后，数据库中的 CA 私钥密文无法用于继续签发。不要把 Master Key 和数据库备份放进同一个权限域或同一份归档。

## 不负责什么

这套 CA 是 **客户端 mTLS CA**，不替代服务器 HTTPS 证书，也不是通用企业 PKI、HSM 或自动化证书轮换系统。证书续期部署、到期告警和组织恢复策略仍需要运维安排。
