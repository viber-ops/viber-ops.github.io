---
layout: ../../../layouts/Docs.astro
title: 下载与安装
description: 选择 macOS 或 Linux 发布包，校验文件并启动 Configra。
source: docs/release-installation.md
---

## 选择发布包

当前版本 **v0.1.0-rc.1** 为预发布。所有包包含 `configra`、`configra-kubernetes`、部署示例及 `BUILD.json`。Web UI 已嵌入服务端，运行时不需要 Node.js。

| 系统  | CPU                   | 下载                                                                                                                               |
| ----- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| macOS | Apple Silicon / arm64 | [darwin_arm64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_darwin_arm64.tar.gz) |
| macOS | Intel / amd64         | [darwin_amd64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_darwin_amd64.tar.gz) |
| Linux | x86-64 / amd64        | [linux_amd64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_linux_amd64.tar.gz)   |
| Linux | ARM64 / arm64         | [linux_arm64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_linux_arm64.tar.gz)   |

[查看完整 Release](https://github.com/viber-ops/configra/releases/tag/v0.1.0-rc.1) · [下载 SHA256SUMS](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/SHA256SUMS)

## 校验后解压

从同一个 Release 下载压缩包与 `SHA256SUMS`。例如在 Apple Silicon Mac 上：

```sh
shasum -a 256 configra_0.1.0-rc.1_darwin_arm64.tar.gz
# 将输出与 SHA256SUMS 中同名文件的哈希逐字比较。
tar -xzf configra_0.1.0-rc.1_darwin_arm64.tar.gz
cd configra_0.1.0-rc.1_darwin_arm64
./configra --version
./configra --help
```

Linux 使用 `sha256sum` 计算校验值。校验和可检测下载损坏，不是独立的来源签名。`BUILD.json` 记录源码提交、目标架构和工具链。

macOS 二进制尚未经过 Apple 签名或公证。遵循组织的软件运行策略，在确认来源后通过系统提供的方式批准运行，或从标签源码构建；不要全局关闭 Gatekeeper。

## 启动服务

发布包是服务端程序，不是零依赖桌面应用。先准备 MySQL、NATS、ClickHouse、OIDC、HTTPS 证书和外部 Master Key，修改示例中的域名、路径与环境变量。

```sh
./configra management --config deploy/management.example.yaml
# 在另一个进程中启动机器读取 API：
./configra api --config deploy/api.example.yaml
```

示例中的绝对路径必须对应实际挂载的文件。完整启动要求见[部署 Configra 服务](/docs/configra/deployment/)。如果只是想体验界面，使用[本地开发栈](/docs/configra/quickstart/)。

## 从源码构建

在带发布标签的 `configra` 源码目录中：

```sh
npm --prefix web ci --ignore-scripts
npm --prefix web run build
CGO_ENABLED=0 go build -trimpath -o configra ./cmd/configra
GOWORK=off CGO_ENABLED=0 go -C kubernetes build -trimpath -o configra-kubernetes ./cmd/configra-kubernetes
```

生成完整四平台包可运行 `node scripts/build-release.mjs v0.1.0-rc.1`。脚本要求干净的 Git 工作区，默认使用 Go 1.26.7，并拒绝覆盖同版本的已有输出。

## Kubernetes 镜像

此 Release 提供二进制，不代表已经发布可拉取的容器镜像。根据仓库 Dockerfile 构建镜像、推送到自己的 registry，并在 Kustomize overlay 中替换示例镜像地址。

CSI provider 的节点运行时面向 Linux Kubernetes 节点。macOS 包中的 Kubernetes 工具用于开发或运行同步控制器，不意味着支持 macOS CSI 节点。
