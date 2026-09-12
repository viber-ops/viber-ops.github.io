---
layout: ../../../layouts/Docs.astro
title: Go SDK
description: 从 Go 程序读取配置；先完成一次读取，需要定时更新时再使用 Viper。
---

## 安装

本篇面向接入 Go 应用的研发人员。服务还没启动时，先完成[本地体验](/docs/configra/quickstart/)的客户端步骤。

需要 Go 1.25.13 或更新版本。在你已有的 Go 项目目录执行下面的命令。SDK 是 Go 库，不需要下载服务端的 macOS / Linux 程序：

```sh
go get github.com/viber-ops/configra-go@v0.1.0-rc.2
```

先准备 API HTTPS 地址、Environment Token、已签发的客户端证书与私钥。若服务器证书由内部 CA 签发，还需要服务器 CA 公共证书。

## 最少代码开始

应用只需要初始化 Client 并读取配置。证书加载、TLS、超时和连接池在 SDK 内处理，不需要业务代码自行初始化：

```go
client, err := configra.NewClientFromEnv()
if err != nil {
    return err
}
defer client.CloseIdleConnections()

result, err := client.ReadResolvedConfig(ctx, "development", "payment", "")
if err != nil {
    return err
}
// 解析 result.Content；不要将它写入日志。
// result.ETag 可传给下一次请求，未变化时返回 ErrNotModified。
```

导入 `github.com/viber-ops/configra-go`；`ctx` 来自应用的请求或生命周期。[完整可编译示例](https://github.com/viber-ops/configra-go/blob/v0.1.0-rc.2/examples/basic/main.go)只打印版本元数据，不打印配置明文。

## 按场景选择入口

| 你的应用已有              | 用哪个入口                           |
| ------------------------- | ------------------------------------ |
| 容器环境变量、Secret 挂载 | `NewClientFromEnv()`                 |
| 一个部署配置文件          | `NewClientFromFile("configra.yaml")` |
| 自己的配置系统或内存参数  | `NewClient(ClientOptions{...})`      |

选一个入口即可。它们使用相同的校验规则，不会把环境变量和配置文件悄悄合并。

## 从环境变量初始化

下面运行 SDK 仓库里的现成示例：先克隆 `configra-go` 的 rc.2 标签并进入该目录；已按本地体验克隆过，就直接进入已有目录。把地址和 `/secure/` 路径改成实际值。自己的应用使用相同环境变量，但启动命令换成自己的程序。

Token 直接传值和从文件读取二选一。文件中只放 Token，不加引号；Kubernetes Secret 挂载可以使用这种方式：

```sh
export CONFIGRA_URL=https://configra-api.example.internal:9443
export CONFIGRA_TOKEN_FILE=/secure/configra-token
export CONFIGRA_CLIENT_CERT=/secure/client.crt
export CONFIGRA_CLIENT_KEY=/secure/client.key
# 仅服务器使用内部 CA 时设置：
export CONFIGRA_SERVER_CA=/secure/server-ca.crt
go run ./examples/basic
```

也可以由受控环境注入 `CONFIGRA_TOKEN`，但不要与 `CONFIGRA_TOKEN_FILE` 同时设置。SDK 不搜索 `.env` 文件，不要求固定目录，默认请求超时 30 秒。需要调整时使用 `CONFIGRA_TIMEOUT=10s`。

## 从配置文件初始化

```go
client, err := configra.NewClientFromFile("configra.yaml")
```

```yaml
url: https://configra-api.example.internal:9443
token_file: /run/secrets/configra-token
cert_file: client.crt
key_file: client.key
# server_ca_file: server-ca.crt # 仅内部服务器 CA
```

相对路径以 YAML 文件所在目录为基准，不是进程工作目录。它只读取指定文件，不隐式合并环境变量或展开 shell 变量。未知字段、多份 YAML 文档和互相冲突的选项会被拒绝。也支持 `token` 明文选项，但更推荐通过 `token_file` 引用已有 Secret；不要提交真实 Token 到 Git。

## 直接传参数与单文件证书

应用已经拥有连接参数时，直接传入，不需要先写一份文件：

```go
client, err := configra.NewClient(configra.ClientOptions{
    BaseURL:               apiURL,
    Token:                 token,
    ClientCertificateFile: "client.pem",
})
```

这里的 `client.pem` 包含客户端证书与私钥。只有公共证书不能证明客户端持有私钥；若使用工作台分别导出的 `client.crt` / `client.key`，分别设置 `ClientCertificateFile` / `ClientKeyFile` 即可。`ServerCAFile` 只用于内部服务器 CA。

不要求凭据目录，也不强迫把 Token 打包进证书文件。已有内存证书或热轮换方案时，使用高级 `TLSConfig`；它与文件式 TLS 选项互斥，避免隐式覆盖。

## 初始化失败时怎么办

初始化会尽早检查参数冲突、文件读取、证书和私钥匹配、客户端证书用途与有效期。错误消息指出对应入口的字段名并给出修复建议；不会回显传入的 Token、私钥、配置值或底层 PEM 解析内容。

例如环境变量没配地址时，错误指出 `CONFIGRA_URL`；文件里把 `cert_file` 拼错时，错误指出行号并列出合法字段。不会静默忽略拼写错误或用另一个来源覆盖它。

| 场景 / 提示                               | 怎么修复                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| URL is required / must be an HTTPS origin | 使用机器 API 地址，不是工作台 `/ui/` 地址；去掉路径、查询串和内嵌凭据    |
| Token missing / invalid                   | 从 Administration 创建 API Token；登录密码、CA 和客户端证书都不是 Token  |
| Both a Token value and Token file         | `token` 与 `token_file` 二选一；环境变量也是同样规则                     |
| File was not found / not readable         | 检查挂载和权限；YAML 相对路径以 YAML 所在目录为基准                      |
| No usable certificate/private-key pair    | 同时提供匹配的 CRT / KEY，或包含二者的 PEM；不支持直接读取加密私钥或 P12 |
| CA instead of a client identity           | 使用 CA 签发的客户端证书；不要把 CA 私钥分发给应用                       |
| Expired / not yet valid                   | 检查系统时间，部署当前有效的客户端证书                                   |
| Does not permit client authentication     | 不要将服务器 HTTPS 证书作为客户端身份                                    |
| Unknown field / duplicated field          | 根据错误行号修正拼写或重复项，不存在静默覆盖规则                         |
| TLS file options combined with TLSConfig  | 普通文件选项与高级 TLSConfig 二选一                                      |

网络连通性、服务器信任与服务端授权在第一次读取时验证，创建 Client 本身不会连接服务器。遇到 `x509: certificate signed by unknown authority` 时，应核对 API **服务器** CA；不要关闭验证。HTTP 401 / 403 优先检查 Token 的有效期、Environment 范围以及客户端证书 / CA 状态。

设置文件上限 64 KiB，Token 文件 1 KiB，客户端证书或组合 PEM 128 KiB、单独私钥 64 KiB、服务器 CA 集合 1 MiB。文件超限时，先确认选对了文件，不要把整个导出 ZIP 当作证书文件传入。

## 文件字段与响应大小

File 字段独立读取：

```go
file, err := client.ReadFile(ctx, "development", "platform", "database", "tls_cert", "")
```

`file.Bytes` 是原始文件字节。默认内容上限 5 MiB，`MaxContentBytes` 可以进一步降低，不能用来提高协议限制。

## Viper 快照与热更新

如果应用只在启动时读取一次，可以跳过本节。Viper 是 Go 的配置解析库；这里的快照（Snapshot）是一份已下载、解析好的配置副本。

`NewViperHandler` 接收 Client、Environment、Config、OnChange 和 OnError。先调用 `Load(ctx)` 并应用初始快照，再启动 `Watch(ctx)`。

```go
handler, err := configra.NewViperHandler(configra.ViperHandlerOptions{
    Client: client, Environment: "development", Config: "payment",
    OnChange: func(ctx context.Context, previous, current *configra.Snapshot) error {
        return applyConfig(current) // 应用自己的解析、校验和原子切换
    },
    OnError: func(err error) {
        logger.Warn("Configra reload failed", zap.Error(err))
    },
})
if err != nil {
    return err
}
initial, err := handler.Load(ctx)
if err != nil {
    return err // 冷启动没有旧快照，必须显式处理失败
}
if err := applyConfig(initial); err != nil {
    return err
}
return handler.Watch(ctx)
```

上面省略了业务自己的 `applyConfig` 和日志器定义。`Load` 不触发 OnChange；Reload / Watch 在获取并解析成功后先安装 SDK 快照，再串行调用 OnChange。回调失败**不会回滚 SDK 快照**：应用应保持独立的已验证状态，在校验通过后原子替换。

Watch 默认约 30 秒、带抖动；最小间隔 5 秒，连续失败退避上限 5 分钟。获取或解析失败时保留进程内最后可用快照。它不是磁盘缓存，应用重启后的首次读取失败不能靠它恢复。

## TLS 与证书轮换

普通接入不需要自己写 TLS 代码。只有需要不中断进程地更换证书时，才需要下面的高级回调。

SDK 只接受 HTTPS，不允许 `InsecureSkipVerify`，也不受 `http.DefaultTransport` 被应用替换的影响。需要热轮换时，设置 `tls.Config.GetClientCertificate` 返回原子保存的证书；替换后调用 `client.CloseIdleConnections()` 使后续连接重新握手。

文件式凭据只在初始化时加载一次，文件替换后应重建 Client。构造函数不自动启动 Watch，也不自动注册或签发证书。

只在 API Token 显式允许 Token-only 模式时才能不提供客户端证书。无论哪种模式，服务器证书验证始终保留。
