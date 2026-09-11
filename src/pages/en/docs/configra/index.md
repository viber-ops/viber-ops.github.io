---
layout: ../../../../layouts/Docs.astro
title: Overview
description: A self-hosted service for application configuration, sensitive values and machine access.
source: README.md
---

Configra stores environment-specific YAML / JSON and Vault fields that configuration can reference. Applications receive resolved documents through HTTPS, the Go SDK or Kubernetes integration.

## When to use it

Use Configra when configuration is copied between repositories, deployment scripts and clusters, or when several configurations share credentials. The management UI provides a common place to inspect current values, revisions and access records.

- **Developers** read configuration, validate it and apply it to application state.
- **Operators** manage environments, versions, Tokens and client certificates.
- **Platform teams** connect Pods through CSI files or native Secret / ConfigMap objects.

## Choose an integration

| Application                    | Start here                                                             | How updates take effect                                                                   |
| ------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Go code you can change         | [Go SDK](/en/docs/configra/go-sdk/)                                    | The application validates and applies a new snapshot                                      |
| Reads configuration files      | [CSI file mounts](/en/docs/configra/kubernetes/#csi-file-mounts)       | The driver rotates files; the application rereads them                                    |
| Uses envFrom or native volumes | [Native object sync](/en/docs/configra/kubernetes/#native-object-sync) | Volumes follow Kubernetes refresh behavior; environment variables require Pod replacement |
| Evaluating the UI              | [Local quickstart](/en/docs/configra/quickstart/)                      | Run the development stack and use the browser workspace                                   |

## Service components

The `configra` executable has two modes. **Management** serves the UI, OIDC login and management operations. **API** serves machine reads. They share MySQL and an external Master Key and can run in separate Kubernetes Deployments.

MySQL stores transactional state. NATS carries best-effort Access events. ClickHouse stores Access / Audit logs. The SDK and Kubernetes adapters consume Configra; they do not provide Configra's own startup credentials.

## Before deploying

The current release is `v0.1.0-rc.1`, a preview rather than a completed production acceptance.

Machine Tokens grant **Environment-wide** access. Vault Namespaces are organizational labels, not resource-level permission boundaries. Human Admin / Viewer roles are workspace-wide. Use separate trust domains when applications or tenants do not trust one another.

Continue with the [local quickstart](/en/docs/configra/quickstart/) or review the [security boundaries](/en/docs/configra/security/).
