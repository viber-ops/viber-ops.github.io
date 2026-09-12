---
layout: ../../../layouts/Docs.astro
title: 认识 Configra
description: 看同样的 YAML / JSON 引用，如何按开发、测试和生产环境填入不同的值。
source: README.md
---

Configra 是一个自己部署的配置管理服务。你在 YAML / JSON 中引用保存在 Configra Vault 里的值；应用读取时指定环境，Configra 把引用替换为那个环境的实际值，再返回完整配置。

**从开发切到测试或生产，换的是读取环境和得到的值，不需要改字段名或引用里的 key。** 下面用支付服务连接数据库的例子说明。

## 例子：同样的配置，读取不同环境的值

### 1. 先在 Vault 保存三组值

创建 Vault 条目 `platform.database`，也就是 Namespace 为 `platform`、Item key 为 `database`。添加 `host`、`username` 两个 Text 字段和 `password` Secret 字段，再为三个环境分别设置值：

| 环境（Environment） | host | username | password |
| --- | --- | --- | --- |
| `development` | `mysql.dev.example` | `payment_dev` | `demo-dev-only` |
| `testing` | `mysql.test.example` | `payment_test` | `demo-test-only` |
| `production` | `mysql.prod.example` | `payment_prod` | `demo-prod-only` |

这些地址和密码都是演示值，不要用于真实数据库。在界面中，每组值对应一个 Variant，并绑定到表中的环境；三个环境都使用同样的字段 key。

### 2. 配置中只写一套引用

在配置（Configs）中保存下面的 YAML，Config key 使用 `payment`：

```yaml
database:
  host: '{vault.platform.database.host}'
  port: 3306
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

先为 `development` 保存，再把配置克隆到 `testing` 和 `production`。三个环境下的 `payment` 可以使用完全相同的文本；Configra 不会自动给尚未创建的环境复制配置。以后修改某个环境的配置，也不会自动改动其他环境的配置文本。

这里不需要 `password_dev`、`password_test` 这样的字段，也不用把引用改成不同名称。`port: 3306` 是直接写在配置中的普通值，会原样保留。

### 3. 应用指定环境，拿到填好值的配置

读取 `development` 环境的 `payment`，配置内容是：

```yaml
database:
  host: 'mysql.dev.example'
  port: 3306
  username: 'payment_dev'
  password: 'demo-dev-only'
```

改为读取 `testing`，得到：

```yaml
database:
  host: 'mysql.test.example'
  port: 3306
  username: 'payment_test'
  password: 'demo-test-only'
```

改为读取 `production`，得到：

```yaml
database:
  host: 'mysql.prod.example'
  port: 3306
  username: 'payment_prod'
  password: 'demo-prod-only'
```

应用始终读取 `database.host`、`database.username` 和 `database.password`，不用根据环境换 key，也不需要自己解析 `{vault...}`。上面只展示配置正文；Go SDK 中对应 `result.Content`，响应还会带版本等信息。实际密码不要写入日志。

## 如果应用使用 JSON

创建配置时选择 JSON 格式，使用同样的引用规则：

```json
{
  "database": {
    "host": "{vault.platform.database.host}",
    "password": "{vault.platform.database.password}",
    "port": 3306,
    "username": "{vault.platform.database.username}"
  }
}
```

读取生产环境后，应用收到的配置正文是：

```json
{
  "database": {
    "host": "mysql.prod.example",
    "password": "demo-prod-only",
    "port": 3306,
    "username": "payment_prod"
  }
}
```

这是上面 YAML 的另一种写法，不需要把两份都保存。返回正文的格式由保存的 Config 决定，不是读取时自动把 YAML 转成 JSON。引用必须占据整个字符串值；`"password={vault...}"` 这种拼接写法不支持。

## 环境在哪里指定

以已经初始化的 Go Client 为例，下面这次调用读取测试环境：

```go
result, err := client.ReadResolvedConfig(ctx, "testing", "payment", "")
```

把 `testing` 换成 `development` 或 `production` 即可，`payment` 和配置内的 key 不变。实际项目可以从自己的部署设置中取得环境名，再传给 SDK；完整初始化和错误处理见 [Go SDK](/docs/configra/go-sdk/)。

使用 Kubernetes 时，在读取对象里设置 `environment: testing`，`config` 仍为 `payment`。Configra 不会根据集群名、Namespace 或机器上的 `ENV` 变量自动猜环境。无论哪种方式，Token 都必须有对应环境的读取权限；缺少环境值时会报错，不会回退到另一套环境的密码。

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
