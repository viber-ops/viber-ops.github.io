---
layout: ../../../layouts/Docs.astro
title: 本地体验
description: 启动独立开发栈，认识工作台并创建第一份带 Vault 引用的配置。
source: Makefile
---

## 准备环境

需要 Git、Go 1.25.13 或更新版本、Node.js 24、npm、Make、OpenSSL，以及可运行 Linux 容器的 Docker Compose。首次启动会下载依赖镜像。

本地栈使用固定的演示账号与开发凭据，只能在受控开发机运行。不要暴露给公网、不要填入生产数据，也不要将它当成生产部署模板。

这个版本的开发栈使用 **tmpfs 临时数据库**：停止 MySQL 或 ClickHouse 容器会丢失其中的数据，即使没有删除 Docker volume。需要保存的配置先导出或备份；持久部署请使用[服务部署指南](/docs/configra/deployment/)。

## 克隆并启动

两个仓库需要放在相邻目录。指定预发布标签，避免默认分支与文档版本不一致。

```sh
git clone --branch v0.1.0-rc.1 https://github.com/viber-ops/configra.git
git clone --branch v0.1.0-rc.1 https://github.com/viber-ops/configra-go.git
cd configra
make local-run
```

`make local-run` 会安装并构建 UI、准备开发证书与 OIDC、启动 MySQL / NATS / ClickHouse / Casdoor，并在前台运行 Management。浏览器访问 [https://localhost:18088](https://localhost:18088)，随后进入本地 OIDC 登录页 [http://localhost:18080](http://localhost:18080)。

开发 HTTPS 证书是自签名证书。仅在确认这是自己的本地服务后按系统提示处理；生产环境必须使用可验证的证书。

| 角色   | 用户名   | 开发密码          |
| ------ | -------- | ----------------- |
| Admin  | `admin`  | `configra-admin`  |
| Viewer | `viewer` | `configra-viewer` |

本地 Management 模式用于工作台体验；它不会自动启动独立的机器 API。连接 SDK 时，还需要按[部署指南](/docs/configra/deployment/)启动 `configra api`。

## 创建第一份配置

1. 在 **Environments** 创建 `development` 环境。
2. 在 **Vault** 创建 Namespace 为 `platform`、Item key 为 `database` 的条目。
3. 添加 Text 字段 `username` 和 Secret 字段 `password`，为 `development` 设置演示值。
4. 在 **Configs** 创建 `payment`，选择 `development` 与 YAML 格式，保存下方内容。

```yaml
server:
  port: 8080
database:
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

引用必须占据整个字符串值，并包含 `vault`、Namespace、Item、Field 四段。环境由 Config 决定，不写在引用里。

## 连接第一个客户端

在 Administration 中创建客户端 CA、签发客户端证书，并创建允许访问 `development` 的 API Token。保存首次导出的私钥 ZIP，再按 [Go SDK](/docs/configra/go-sdk/)或 [Kubernetes](/docs/configra/kubernetes/) 文档接入。

客户端 CA 用来验证机器身份；它不是 API 服务器 HTTPS 证书的 CA。两类信任不要混用。

## 停止开发环境

在运行 Management 的终端按 `Ctrl+C`，只会停止管理进程，依赖容器仍继续运行。确认不再需要临时演示数据后，可停止整套依赖：

```sh
docker compose -f deploy/compose.test.yaml stop
```

这条 `stop` 命令也会清空上述 tmpfs 数据；它不是保留演示数据的方法。端口冲突时，先确认端口所有者，再调整自己的开发配置；不要停止不相关服务。
