---
layout: ../../../layouts/Docs.astro
title: 安全边界与发布状态
description: 能力、验证证据和未完成事项分开呈现，便于决定是否适合你的部署。
source: docs/security-architecture-review.md
---

## 发布状态

**v0.1.0-rc.1 是预发布，不是生产稳定版。** 标签来自已审查的功能分支，不代表 draft PR 已合并。这里不承诺吞吐、可用性 SLA 或独立安全认证。

该分支已有核心与 SDK race 测试、数据库/容器集成、41 项浏览器回归，以及真实 Kubernetes / CSI 轮换验证的记录。详情与具体范围见[源码中的审查报告](https://github.com/viber-ops/configra/blob/v0.1.0-rc.1/docs/security-architecture-review.md)。测试结果不能取代实际生产基础设施验收。

## 明确的信任边界

- Token 按 **Environment** 授权。同环境的 Token 能读取相同 Config / Vault 值，独立证书和 Kubernetes Namespace 不会变成单资源授权。
- Admin / Viewer 是工作区级角色，不是项目级或租户级权限。
- CA 签名私钥加密存入数据库。数据库与 Master Key 同时失守时，这一保护不再成立。
- 吊销凭据会阻止未来读取，但不能删除客户端已保存的配置或 Kubernetes 中已同步的内容。
- CSI provider 是具有 hostPath socket 的可信节点扩展；同步控制器具备应用 Namespace 的 Secret 读写能力。

不互信的应用或租户应使用独立信任域 / 部署，或等待更细粒度的服务端授权实现，不要用命名约定代替隔离。

## 已采用的保护

HTTPS 验证、默认 mTLS、Token 有效期与吊销检查保护机器读取；OIDC 与 Admin 权限保护管理操作。Vault 和 CA 私钥使用认证加密。客户端私钥不持久化，首次私钥导出不会出现在重放响应或 Audit 载荷中。

Kubernetes 对象路径、响应大小和跨 Namespace 引用受到限制。原生控制器只覆盖自己拥有的对象，拉取失败保留最后一次成功数据。

这些机制依赖正确的部署、证书分发和 Master Key 管理，不等同于“没有安全风险”。

## 仍未完成的事项

| 事项                   | 当前状态与影响                                                              |
| ---------------------- | --------------------------------------------------------------------------- |
| 1000 QPS 性能门禁      | 共享 Docker 主机上的预热未通过，正式测量段没有运行；不能作为已达标容量宣传  |
| 网关拒绝审计           | 畸形 JSON、缺失 operation ID、Viewer 禁止写入等早期拒绝未全部写入持久 Audit |
| 大规模资源列表         | 部分后端列表仍返回完整集合；前端分页不等于数据库分页                        |
| Master Key 轮换        | 未实现自动轮换、HSM 或 KMS 托管                                             |
| 多租户隔离             | 未提供按 Config / Vault 条目的细粒度授权                                    |
| 自动应用重启与续期部署 | 不自动替应用重启进程或部署续期证书                                          |

Access 通过 NATS 尽力而为投递。已持久化的 Audit 使用 outbox，但不能将其描述成“所有请求零丢失审计”。

## 负责任地反馈问题

公开 Issue 只用于非敏感问题。不要把有效 Token、真实密钥、生产配置或可直接利用的私密细节发到公开仓库。发现敏感漏洞时，先联系仓库维护者建立非公开渠道，再提供必要的最小复现信息。
