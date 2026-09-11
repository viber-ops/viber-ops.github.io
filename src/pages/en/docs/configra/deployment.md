---
layout: ../../../../layouts/Docs.astro
title: Deploy the service
description: Run Management and API separately in Kubernetes, with external bootstrap credentials.
source: deploy/kubernetes/README.md
---

## Runtime components

`configra management` serves the workspace, OIDC, mutations and log processing. `configra api` serves machine reads. Run them separately with the same MySQL database and Master Key.

| Dependency         | Purpose                                                              | Requirement                                                                                     |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| MySQL 8.0.22       | Configuration, Vault, sessions, Tokens, CAs and transactional outbox | Required compatibility baseline; evaluate another version separately before changing deployment |
| NATS               | Best-effort Access-event delivery                                    | Provision endpoints, TLS and credentials                                                        |
| ClickHouse         | Access / Audit logs                                                  | Management needs its log store                                                                  |
| OIDC Provider      | Human login and role Claims                                          | Register a real client and callback URL                                                         |
| Master Key         | Decrypt stored values and signing keys                               | External, separately backed up, identical across replicas                                       |
| HTTPS certificates | Management / API server identity                                     | Matching hostnames with external private-key storage                                            |

Release binaries do not provision these production dependencies. Never carry the development stack's fixed accounts or passwords into production.

## Bootstrap Secrets

`deploy/kubernetes/base` contains a Management Deployment and an independently scalable API Deployment. Provision these Secrets through your own credential-distribution process:

| Secret                    | Keys                                                |
| ------------------------- | --------------------------------------------------- |
| `configra-runtime`        | `mysql-dsn`, `clickhouse-dsn`, `oidc-client-secret` |
| `configra-management-tls` | `tls.crt`, `tls.key`                                |
| `configra-api-tls`        | `tls.crt`, `tls.key`                                |
| `configra-master-key`     | `master-key`: one base64-encoded 32-byte random key |
| `configra-nats`           | `nats.creds`, `ca.pem`                              |

The Master Key file's base64 text is separate from Kubernetes' Secret data encoding. With `kubectl create secret --from-file`, the file contains base64 text and kubectl encodes the API layer. Do not repeatedly decode it or generate a new key when a Pod restarts.

**Configra does not use its own provider to load bootstrap data.** Doing so would create a startup/recovery dependency on a service that is not running yet.

## Configure an overlay

Build the tagged source and push to your registry. Replace image, hostname, OIDC, NATS and namespace settings in your Kustomize overlay, then render and inspect it:

```sh
docker build -t registry.example.com/configra:0.1.0-rc.1 .
kubectl kustomize deploy/kubernetes/base
# Configure and inspect your overlay before running kubectl apply -k against it.
```

Example registry references are placeholders, not published images. The listeners use 8443 for Management and 9443 for API; their Kubernetes Services expose 443.

## Ingress and TLS

Management can use a regular HTTPS Ingress. The machine API requires **TCP / TLS passthrough** so the original client certificate reaches Configra. Terminating TLS and forwarding a certificate Header is not equivalent to this mTLS validation.

Use an API hostname covered by its server certificate. Managed client CAs do not change the API's HTTPS certificate. An external client CA may be retained with `tls.client_ca_file` alongside managed CAs.

## Startup and upgrade order

Start Management first and check `/health/ready`. Verify OIDC Admin access, then create environments, Tokens and client credentials before deploying API consumers.

For schema v1-to-v2 upgrades, upgrade Management first. It verifies the Crypto Sentinel and performs the additive migration under a database lock. Upgrade API afterwards. A wrong Master Key is not a reason to initialize a restored database as a new installation.

Management's versioned embedded assets need a coordinated rollout; the base keeps a controlled replacement strategy. Database HA, NetworkPolicy, backup retention, ingress limits and recovery drills remain deployment-specific work.
