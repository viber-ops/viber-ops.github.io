---
layout: ../../../../layouts/Docs.astro
title: Download and install
description: Choose a macOS or Linux bundle, verify it, and prepare the service prerequisites.
source: docs/release-installation.md
---

## Choose a bundle

**v0.1.0-rc.1** is a preview release. Each bundle includes `configra`, `configra-kubernetes`, deployment examples and `BUILD.json`. The service embeds its web UI; Node.js is not required to run the binary.

| System | CPU                   | Download                                                                                                                           |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| macOS  | Apple Silicon / arm64 | [darwin_arm64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_darwin_arm64.tar.gz) |
| macOS  | Intel / amd64         | [darwin_amd64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_darwin_amd64.tar.gz) |
| Linux  | x86-64 / amd64        | [linux_amd64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_linux_amd64.tar.gz)   |
| Linux  | ARM64 / arm64         | [linux_arm64.tar.gz](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/configra_0.1.0-rc.1_linux_arm64.tar.gz)   |

[Release notes and assets](https://github.com/viber-ops/configra/releases/tag/v0.1.0-rc.1) · [SHA256SUMS](https://github.com/viber-ops/configra/releases/download/v0.1.0-rc.1/SHA256SUMS)

## Verify and extract

Download the archive and `SHA256SUMS` from the same release. On an Apple Silicon Mac:

```sh
shasum -a 256 configra_0.1.0-rc.1_darwin_arm64.tar.gz
# Compare the hash with the matching filename in SHA256SUMS.
tar -xzf configra_0.1.0-rc.1_darwin_arm64.tar.gz
cd configra_0.1.0-rc.1_darwin_arm64
./configra --version
./configra --help
```

On Linux, use `sha256sum`. A matching checksum detects corruption; it is not an independent authenticity signature. `BUILD.json` records the source commit, target and toolchain.

The macOS binaries are not Apple-signed or notarized. Follow your organization's software policy, approve a trusted binary through the system's controls, or build from source. Do not disable Gatekeeper globally.

## Start the service

This is a server executable, not a standalone desktop application. Prepare MySQL, NATS, ClickHouse, OIDC, HTTPS certificates and an external Master Key first. Update the example hostnames, file paths and environment-variable inputs.

```sh
./configra management --config deploy/management.example.yaml
# Start the machine-read API in a separate process:
./configra api --config deploy/api.example.yaml
```

Every referenced absolute path must point to a provisioned file. See [service deployment](/en/docs/configra/deployment/) for the required inputs. For a workspace demo with development dependencies, use the [local quickstart](/en/docs/configra/quickstart/).

## Build from source

From the tagged Configra source directory:

```sh
npm --prefix web ci --ignore-scripts
npm --prefix web run build
CGO_ENABLED=0 go build -trimpath -o configra ./cmd/configra
GOWORK=off CGO_ENABLED=0 go -C kubernetes build -trimpath -o configra-kubernetes ./cmd/configra-kubernetes
```

`node scripts/build-release.mjs v0.1.0-rc.1` builds all four platform bundles. It requires a clean Git worktree, defaults to Go 1.26.7 and refuses to overwrite an existing version's output.

## Kubernetes images

This release contains binaries, not a published container image. Build the repository Dockerfiles, push to your registry, and replace image references in your Kustomize overlays.

The CSI node provider targets Linux Kubernetes nodes. The macOS Kubernetes helper is for development or controller use; it does not imply macOS CSI-node support.
