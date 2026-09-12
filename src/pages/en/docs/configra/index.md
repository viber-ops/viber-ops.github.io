---
layout: ../../../../layouts/Docs.astro
title: Overview
description: What Configra does, who it is for, and where to start.
source: README.md
---

Configra is a configuration service you deploy yourself. You manage application settings, database passwords and certificates in a web interface. Applications then read the values they need from Configra.

For example, a payment service may use different database passwords in development and production. You can keep both sets in Configra and let the application read by environment, without putting passwords in its source repository.

## Where to start

To try the product, follow the [local quickstart](/en/docs/configra/quickstart/) to open the workspace and create a configuration. You do not need a Kubernetes cluster or prior knowledge of certificate issuance for that first step.

If Configra is already running and you want to connect an application, choose its reading method:

| How the application reads | Guide | What must happen after a change |
| --- | --- | --- |
| A Go program requests configuration | [Go SDK](/en/docs/configra/go-sdk/) | The program validates and applies the new configuration |
| A program in Kubernetes reads files | [CSI file mounts](/en/docs/configra/kubernetes/#csi-file-mounts) | Enable file updates and make the program reread them |
| It already uses Secrets / ConfigMaps | [Kubernetes synchronization](/en/docs/configra/kubernetes/#native-object-sync) | Reread updated files; recreate Pods to change environment variables |

## What you manage

- **Environment:** separates settings for development, testing or production.
- **Config:** the YAML or JSON document an application reads.
- **Vault:** stores values shared by configurations, such as database accounts, passwords and certificate files. This is a Configra feature, not a separate HashiCorp Vault installation.
- **Credentials:** Tokens and client certificates used to control application access.

Use the [glossary](/en/docs/configra/concepts/) when a workspace label is unfamiliar.

## What a deployment needs

Configra runs as two processes: `management` serves the workspace, and `api` serves application reads. Starting the workspace does not also start the read API.

They share MySQL and a Master Key used for encryption. A deployed service also needs a login provider, NATS messaging, ClickHouse log storage and HTTPS certificates. The [deployment guide](/en/docs/configra/deployment/) explains these inputs; the local quickstart prepares demo versions.

## Before you use it

The current server release is **v0.1.0-rc.2**, a preview for evaluation. Production acceptance is not complete.

A Token granted an environment can read all its Configs and Vault values, not just one item. Administrator and read-only roles also cover the whole workspace. If teams or applications must not read each other's data, names and folders are not enough: use separate deployments or another suitable isolation mechanism.

[Current limitations](/en/docs/configra/security/) · [Try it locally](/en/docs/configra/quickstart/)
