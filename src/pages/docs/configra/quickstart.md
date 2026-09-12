---
layout: ../../../layouts/Docs.astro
title: 本地体验
description: 在自己的电脑上打开 Configra 网页、保存一份配置，再按需连接 Go 示例。
source: Makefile
---

本篇分成两部分：先启动网页并保存配置；如果还想让程序读取它，再做后面的客户端步骤。只看界面可以做到第 3 步就停下，不需要 Kubernetes。

## 1. 准备环境

需要 Git、Go 1.25.13 或更新版本、Node.js 24、npm、Make、OpenSSL，以及支持 Linux 容器的 Docker Compose。先启动 Docker，首次运行需要联网下载依赖和镜像。

这是一套演示环境，使用固定账号和密码。**不要放入生产数据，也不要暴露到公网。** 数据库保存在临时内存盘（tmpfs）中：停止 MySQL 或 ClickHouse 容器就会丢失数据，即使没有删除 volume。

## 2. 下载并启动

在一个新的空目录里执行以下命令。两个仓库会放在相邻目录；已有旧版代码时，不要覆盖旧目录。

```sh
git clone --branch v0.1.0-rc.2 https://github.com/viber-ops/configra.git
git clone --branch v0.1.0-rc.2 https://github.com/viber-ops/configra-go.git
cd configra
make local-run
```

这条命令会准备演示数据库、登录系统、证书和网页，然后持续运行管理服务。**保持这个终端打开。** 克隆发布标签时 Git 提示 `detached HEAD` 是正常现象，不影响运行。

打开 [https://localhost:18088](https://localhost:18088)。点击登录后会转到本地登录系统 [http://localhost:18080](http://localhost:18080)。使用下面的 Admin 账号：

| 角色 | 用户名 | 演示密码 | 可以做什么 |
| --- | --- | --- | --- |
| Admin | `admin` | `configra-admin` | 创建、修改配置和管理凭据 |
| Viewer | `viewer` | `configra-viewer` | 查看允许的非敏感内容，不能修改 |

浏览器可能提示本地 HTTPS 证书不受信任，因为它是开发命令生成的自签名证书。只在确认地址是自己启动的 `localhost` 服务后，通过系统的信任提示处理；不要关闭系统或应用的 HTTPS 验证。

## 3. 保存第一份配置

1. 在环境（Environments）页面创建环境，Key 填 `development`。显示名称可以填“开发环境”。
2. 在配置（Configs）页面创建配置，Key 填 `payment`，选择 `development` 环境和 YAML 格式。
3. 粘贴下面的内容并保存。

```yaml
server:
  port: 8080
  log_level: info
```

保存成功后，应能看到当前配置和第一个版本。到这里已经完成网页体验。你可以再修改 `log_level`，保存后查看历史，比较两次变更。

## 4. 可选：把密码放入 Vault

Vault 用来保存配置中引用的值。先用演示密码试用，不要填真实数据库密码。

1. 在 Vault 创建条目，Namespace 填 `platform`，Item key 填 `database`。
2. 添加 Text 字段 `username` 和 Secret 字段 `password`。
3. 为条目创建一组环境值（Variant），绑定 `development`，填写演示用户名和密码，并保存。
4. 回到 `payment` 配置，把下面内容加到末尾，再保存。

```yaml
database:
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

引用表示“从 Vault 取这个字段”。应用读取时，Configra 会把它替换成 `development` 环境中的实际值。引用必须完整写在引号里；不需要在引用中再写环境名。

## 5. 可选：让 Go 示例读取配置

网页和应用读取接口是两个独立进程。上面的命令只启动了网页，**不能把 18088 当作 SDK 的 API 地址**。

先以 Admin 身份进入管理（Administration）页面，按[证书管理](/docs/configra/certificates/)创建客户端 CA、签发客户端证书，再创建允许读取 `development` 的 API Token。保持默认的证书认证要求。

保存首次导出的客户端 `client.crt`、`client.key` 和 Token。Token 放入一个普通文本文件，例如 `configra-token`；文件中只放 Token，不加引号。它们可以放在任意受控目录，不要求固定目录名。不要把 CA 私钥交给示例程序。

接着，在 `configra` 仓库中创建 `.cache/local-dev/api.yaml`，填入：

```yaml
version: 1
listen: localhost:18089
tls:
  certificate_file: .cache/local-dev/server.crt
  private_key_file: .cache/local-dev/server.key
mysql:
  dsn_env: CONFIGRA_MYSQL_DSN
key_provider:
  master_key_file: .cache/local-dev/master-key
nats:
  urls: [nats://127.0.0.1:42229]
logging:
  level: info
```

在第二个终端中进入同一个 `configra` 目录，启动本地 API。下面是演示数据库的固定连接信息，不适用于生产：

```sh
CONFIGRA_MYSQL_DSN='configra:configra-test@tcp(127.0.0.1:33079)/configra_local?parseTime=true&charset=utf8mb4&collation=utf8mb4_0900_ai_ci' \
  go run ./cmd/configra api --config .cache/local-dev/api.yaml
```

保持第二个终端运行。在第三个终端中，从 `configra` 目录进入相邻 SDK 目录。把三个 `/absolute/path/` 路径换成刚保存文件的**完整路径**，再执行：

```sh
cd ../configra-go
export CONFIGRA_URL=https://localhost:18089
export CONFIGRA_TOKEN_FILE=/absolute/path/configra-token
export CONFIGRA_CLIENT_CERT=/absolute/path/client.crt
export CONFIGRA_CLIENT_KEY=/absolute/path/client.key
export CONFIGRA_SERVER_CA=../configra/.cache/local-dev/server.crt
go run ./examples/basic
```

成功时会显示 `Loaded Config revision ... (yaml)`。示例只打印版本，不打印配置和密码。`CONFIGRA_SERVER_CA` 使用本地 API 的服务器证书，**不是工作台导出的客户端 CA**。更多初始化方式见 [Go SDK](/docs/configra/go-sdk/)。

## 停止开发环境

分别在 Management 和 API 的终端按 `Ctrl+C`。这只停止进程，依赖容器还在运行。

确认不再需要演示数据后，从 `configra` 目录停止本篇创建的依赖。以下命令使用默认项目名 `configra-local`；如果启动时改过 `LOCAL_PROJECT`，这里也必须使用相同名称：

```sh
docker compose --project-name configra-local \
  -f deploy/compose.test.yaml -f deploy/compose.local.yaml stop
```

**这会丢失临时数据库里的演示数据。** 它不是“下次从原数据继续”的暂停按钮。不要停止其他项目的容器。

## 遇到问题

| 现象 | 先检查什么 |
| --- | --- |
| Docker 连接失败 | Docker 是否已启动，当前用户能否执行 `docker compose version` |
| 端口已被占用 | 确认端口属于哪个服务；不要直接停止不相关服务 |
| 首次下载失败 | 网络能否访问 GitHub、Go/npm 包源和容器镜像仓库；恢复网络后重试 |
| 网页能打开，SDK 连不上 | 第二个终端的 API 是否运行，地址是否为 `https://localhost:18089` |
| 证书不受信任 | SDK 是否设置了本篇的 `CONFIGRA_SERVER_CA`，不要换成客户端 CA |
| 返回 401 / 403 | Token 是否允许 `development`，客户端证书是否匹配、有效且未吊销 |
| 提示找不到配置 | 环境和配置 Key 是否分别为 `development`、`payment` |

正式部署不要沿用这套账号、证书和临时数据库。请继续阅读[部署 Configra 服务](/docs/configra/deployment/)。
