---
layout: ../../../layouts/Docs.astro
title: 下载与安装
description: 根据系统和 CPU 下载程序，检查文件，再准备服务需要的数据库和证书。
source: docs/release-installation.md
---

## 选择发布包

如果只是想看看界面，先用[本地体验](/docs/configra/quickstart/)。这里下载的是服务端程序，不是双击就能使用的桌面软件；运行它还需要数据库、登录系统和证书。

当前版本 **v0.1.0-rc.2** 为预发布。所有包包含 `configra`、`configra-kubernetes`、部署示例及 `BUILD.json`。Web UI 已嵌入服务端，运行时不需要 Node.js。

| 系统  | CPU                   | 下载                                                                                                                               |
| ----- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| macOS | Apple Silicon / arm64 | [darwin_arm64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.2/configra_0.1.0-rc.2_darwin_arm64.tar.gz) |
| macOS | Intel / amd64         | [darwin_amd64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.2/configra_0.1.0-rc.2_darwin_amd64.tar.gz) |
| Linux | x86-64 / amd64        | [linux_amd64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.2/configra_0.1.0-rc.2_linux_amd64.tar.gz)   |
| Linux | ARM64 / arm64         | [linux_arm64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.2/configra_0.1.0-rc.2_linux_arm64.tar.gz)   |

[查看完整 Release](https://github.com/viber-ops/configra/releases/tag/v0.1.0-rc.2) · [下载 SHA256SUMS](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.2/SHA256SUMS)

## 校验后解压

在“关于本机”中确认 Mac 使用 Apple 芯片还是 Intel；Linux 运行 `uname -m`，`x86_64` 对应 amd64，`aarch64` 对应 arm64。

下载与你系统对应的一个压缩包，以及同一 Release 下的 `SHA256SUMS` 校验清单。`review-records` 是维护者使用的文字记录，不需要下载来运行程序。

在终端进入下载文件所在目录。下面以 Apple Silicon Mac 为例：

```sh
shasum -a 256 configra_0.1.0-rc.2_darwin_arm64.tar.gz
# 将输出与 SHA256SUMS 中同名文件的哈希逐字比较。
tar -xzf configra_0.1.0-rc.2_darwin_arm64.tar.gz
cd configra_0.1.0-rc.2_darwin_arm64
./configra --version
./configra --help
```

哈希必须与 `SHA256SUMS` 中同名文件的一行完全一致；不一致就停止，不要继续解压或运行。Linux 使用 `sha256sum` 计算。校验和用于发现文件损坏，不能单独证明发布账号未被入侵。

正常运行 `./configra --version` 后会显示版本和源码提交。分发程序时，请一并保留包内的许可证、依赖声明、`BUILD.json` 构建信息、`SBOM.cdx.json` 软件组成清单和 `INVENTORY.json` 文件校验清单。

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

需要 Go 1.25.13+、Node.js 24 和 npm。在带发布标签的 `configra` 源码目录执行，两个程序会生成在 Git 忽略的 `.cache/bin/` 中：

```sh
npm --prefix web ci --ignore-scripts
npm --prefix web run build
mkdir -p .cache/bin
CGO_ENABLED=0 go build -trimpath -o .cache/bin/configra ./cmd/configra
GOWORK=off CGO_ENABLED=0 go -C kubernetes build -trimpath -o ../.cache/bin/configra-kubernetes ./cmd/configra-kubernetes
```

生成完整四平台包可运行 `node scripts/build-release.mjs v0.1.0-rc.2`。脚本要求干净的 Git 工作区，默认使用 Go 1.26.7，并拒绝覆盖同版本的已有输出。

## Kubernetes 镜像

此 Release 提供二进制，不代表已经发布可拉取的容器镜像。根据仓库 Dockerfile 构建镜像、推送到自己的 registry，并在 Kustomize overlay 中替换示例镜像地址。

CSI provider 的节点运行时面向 Linux Kubernetes 节点。macOS 包中的 Kubernetes 工具用于开发或运行同步控制器，不意味着支持 macOS CSI 节点。
