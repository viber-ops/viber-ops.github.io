---
layout: ../../../layouts/Docs.astro
title: 名词说明
description: 用一份数据库配置，解释界面中的环境、配置、Vault 和访问凭据。
source: CONTEXT.md
---

第一次使用只需要分清三件事：**环境**区分开发和生产，**配置**保存应用要读的文件，**Vault**保存配置中引用的值。

## 配置与值

以 `payment` 应用连接数据库为例：

| 界面名称 | 用途 | 示例 |
| --- | --- | --- |
| Environment（环境） | 区分在哪套环境使用 | `development`、`production` |
| Config（配置） | 保存一份 YAML / JSON | `payment` |
| Vault Namespace（命名空间） | 给 Vault 条目分组，不是权限设置 | `platform` |
| Vault Item（条目） | 把相关字段放在一起 | `database` |
| Field（字段） | 保存一个文本、密码或文件 | `username`、`password` |
| Variant（变体） | 给一个或多个环境设置一组字段值 | 开发环境的一组数据库账号和密码 |
| Resolved Config（解析后的配置） | 把引用替换为实际值后的完整文件 | 应用最终收到的 YAML |

条目由 Namespace 和 Item key 一起确定，例如 `platform.database`。不同 Namespace 可以有同名条目。

## 引用规则

配置中不直接写密码，而是写它在 Vault 中的位置：

```yaml
database:
  password: '{vault.platform.database.password}'
```

这表示“使用 `platform` 分组下 `database` 条目的 `password` 字段”。读取 `development` 配置时，会使用绑定到开发环境的值；读取 `production` 时则使用生产环境的值。

引用必须写成完整的 `{vault.<namespace>.<item>.<field>}`，占据整个字符串值。不能省略 Namespace，也不能写成 `password={vault...}` 来拼接字符串。引用不支持 `@vN` 这样的历史版本后缀。

File 字段通过单独的读取接口获取，不能直接嵌入这份 YAML。详见[配置与 Vault](/docs/configra/configuration/)。

## 人和应用怎么登录

- **人打开网页**：通过已有登录系统登录。Configra 使用 OIDC 协议连接这个系统；管理员配置哪些用户是 Admin（管理员）或 Viewer（只读用户）。Viewer 不能修改数据，也不能查看密码或解析后的敏感内容。
- **应用读取配置**：使用管理员创建的 Token，默认还要出示客户端证书。证书证明调用方身份，Token 决定可以读取哪些环境。网页登录密码不能当作 Token 使用。

两类权限都不是单条配置级权限：Admin / Viewer 覆盖整个工作区，Token 按整个环境授权。

## 版本与 ETag

每次保存变更会留下版本历史。应用读取时，除了内容，还会收到配置版本、用到的 Vault 版本和一个内容标识 ETag。

应用下次可以带上 ETag。内容未变化时，服务器返回 `304`，表示“不需要重新下载”，不是错误。SDK 的定时刷新会处理这个过程。

一份配置的解析结果保持内部一致，但同时读取多份配置，不保证它们来自同一个时间点。

## 两种证书和主密钥

| 名称 | 谁用来验证谁 | 是否交给应用 |
| --- | --- | --- |
| API 服务器 HTTPS 证书 | 应用确认连接的是正确的服务器 | 内部 CA 签发时，把服务器 CA 公共证书交给应用 |
| 客户端证书与私钥 | Configra 验证调用方 | 是，每个应用使用自己的证书和私钥 |
| CA 签名私钥 | 服务用来签发客户端证书 | 否，不要分发给应用 |
| Master Key（主密钥） | 服务用来解密数据库中的敏感值和 CA 私钥 | 否，只由 Configra 服务使用并单独备份 |

客户端 CA 不是服务器 CA。两者用错会导致连接失败，不应通过关闭 HTTPS 验证来绕过。需要创建凭据时，再看[证书管理](/docs/configra/certificates/)。
