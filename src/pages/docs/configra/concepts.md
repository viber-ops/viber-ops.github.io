---
layout: ../../../layouts/Docs.astro
title: 核心概念
description: 先弄清 Environment、Config、Vault 与两种身份，避免把组织结构误当成权限边界。
source: CONTEXT.md
---

## 配置与值

| 概念            | 含义                                      | 示例                               |
| --------------- | ----------------------------------------- | ---------------------------------- |
| Environment     | 配置所属环境，也是机器 Token 的授权范围   | `production`                       |
| Config          | 一个环境下的 YAML / JSON 配置文档         | `payment`                          |
| Vault Namespace | Vault Item 的组织标识，不是权限隔离域     | `platform`                         |
| Vault Item      | 由 `(namespace, item)` 唯一标识的字段集合 | `platform.database`                |
| Field           | Text、Secret 或 File 类型的字段           | `username`、`password`、`tls_cert` |
| Variant         | Vault 中针对环境提供的一组字段值          | production 的数据库凭据            |
| Resolved Config | 已解析 Text / Secret 引用的最终文档       | 应用实际收到的 YAML                |

## 引用规则

```yaml
database:
  password: '{vault.platform.database.password}'
```

引用固定为 `{vault.<namespace>.<item>.<field>}`，并且必须占据完整 YAML / JSON 标量。`"password={vault...}"` 这样的字符串插值不受支持，也不支持省略 Namespace 或使用 `@vN` 锁定历史字段版本。

引用按 Config 的 Environment 解析到当前值。File 字段需要单独读取，不能当作 Text / Secret 内嵌到配置中。

## 两种身份

**人访问 Management**：通过 OIDC 登录，角色来自配置的可信 Claim。Admin 执行管理操作，Viewer 只读；角色范围覆盖整个工作区。

**机器访问 API**：使用 Environment-scoped Token，默认配合已注册且有效的 mTLS 客户端证书。只有 Token 显式允许的情况下才能使用 Token-only 读取；服务器 HTTPS 验证始终不能省略。

## 版本与 ETag

Config 和 Vault 维护各自的历史版本。一次配置读取返回配置版本、所用 Vault 版本和 ETag，后续带上 ETag 读取可在未变化时获得 `304`。

单份 Resolved Config 的读取内部保持一致；一次 CSI 挂载或同步涉及多个对象时，不代表这些对象共享同一个数据库快照。

## 两种证书

- **服务器 HTTPS 证书**：让客户端验证它连接的确实是 Configra API。由独立 CA 或公共 PKI 签发。
- **客户端 mTLS 证书**：让 Configra 验证调用方机器。可以由工作台管理的 CA 签发。

不要将工作台下载的客户端 CA 当成服务器的根证书。Master Key 则是服务解密状态所需的外部启动密钥，既不是 HTTPS 私钥，也不是 API Token。
