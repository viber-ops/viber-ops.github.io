---
layout: ../../../../layouts/Docs.astro
title: Deploy the service
description: Deploy Configra in Kubernetes and prepare databases, login, certificates and the Master Key.
source: deploy/kubernetes/README.md
---

This guide is for the person deploying and maintaining the service, not a one-command installer. You need a Kubernetes cluster, deployment permissions and the external dependencies below. To try the UI, start with the [local quickstart](/en/docs/configra/quickstart/).

The YAML files are examples. Their images, domains and credential settings must be replaced for your deployment.

## Start with two processes

`configra management` is for people: the workspace, login, edits and logs. `configra api` is for applications reading configuration and files. They run separately but use the same MySQL database and Master Key, which decrypts stored content.

| Dependency         | Purpose                                                              | Requirement                                                                                     |
| ------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| MySQL 8.0.22       | Configuration, passwords, sessions, Tokens, CAs and queued audit records | Required compatibility baseline; evaluate another version separately before changing deployment |
| NATS               | Access-log delivery; events may be lost on failure                                    | Provision endpoints, TLS and credentials                                                        |
| ClickHouse         | Access / Audit logs                                                  | Management needs its log store                                                                  |
| OIDC Provider      | Workspace login and user roles                                          | Register a real client and callback URL                                                         |
| Master Key         | Decrypt stored values and signing keys                               | External, separately backed up, identical across replicas                                       |
| HTTPS certificates | Management / API server identity                                     | Matching hostnames with external private-key storage                                            |

Release binaries do not install these dependencies. OIDC connects Configra to your login provider; register an application there with the callback URL and role mapping. Do not reuse the demo's fixed accounts or passwords.

## Bootstrap Secrets

`deploy/kubernetes/base` contains a Management Deployment and an independently scalable API Deployment. Provision these Secrets through your own credential-distribution process:

| Secret                    | Keys                                                |
| ------------------------- | --------------------------------------------------- |
| `configra-runtime`        | `mysql-dsn`, `clickhouse-dsn`, `oidc-client-secret` |
| `configra-management-tls` | `tls.crt`, `tls.key`                                |
| `configra-api-tls`        | `tls.crt`, `tls.key`                                |
| `configra-master-key`     | `master-key`: one base64-encoded 32-byte random key |
| `configra-nats`           | `nats.creds`, `ca.pem`                              |

These Secrets belong in the Configra service namespace, not in the application's `configra-credentials` Secret.

Generate the Master Key once for the initial deployment. Reuse the original for restarts and recovery. Its base64 text is separate from Kubernetes' Secret data encoding. With `kubectl create secret --from-file`, the file contains base64 text and kubectl encodes the API layer. Do not repeatedly decode it or generate a new key when a Pod restarts.

**Configra does not use its own provider to load bootstrap data.** The service needs those values before it can start; it cannot fetch them from itself afterwards.

## Configure an overlay

A registry stores your container images. A Kustomize overlay is a directory of deployment customizations. Build the tagged source, push to your registry, and replace the image, hostname, OIDC, NATS and namespace settings.

The following only builds and renders an example. Replace `registry.example.com`; `kubectl kustomize` prints YAML without deploying. Review that output before applying your own overlay with `kubectl apply -k`:

```sh
docker build -t registry.example.com/configra:0.1.0-rc.2 .
kubectl kustomize deploy/kubernetes/base
# Configure and inspect your overlay before running kubectl apply -k against it.
```

Example registry references are placeholders, not published images. The listeners use 8443 for Management and 9443 for API; their Kubernetes Services expose 443.

## Ingress and TLS

Management can use a regular HTTPS Ingress. The machine API requires **TCP / TLS passthrough** so the original client certificate reaches Configra. TLS must reach Configra so it can verify the client certificate. Terminating the connection at the ingress and forwarding a certificate Header is not equivalent.

Use an API hostname covered by its server certificate. Managed client CAs do not change the API's HTTPS certificate. An external client CA may be retained with `tls.client_ca_file` alongside managed CAs.

## Startup and upgrade order

Start Management first and check `/health/ready`. Verify OIDC Admin access, then create environments, Tokens and client credentials before deploying API consumers.

For schema v1-to-v2 upgrades, upgrade Management first. It uses the Crypto Sentinel, an encrypted verification record in the database, to check the Master Key before updating the schema under a database lock. Upgrade API afterwards. A wrong Master Key is not a reason to initialize a restored database as a new installation.

Management's versioned embedded assets need a coordinated rollout; the base keeps a controlled replacement strategy. Database HA, NetworkPolicy, backup retention, ingress limits and recovery drills remain deployment-specific work.
