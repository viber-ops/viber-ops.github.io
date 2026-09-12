---
layout: ../../../../layouts/Docs.astro
title: Limitations and security
description: Who can read which data, what is not automatic, and what remains before production use.
source: docs/security-architecture-review.md
---

## Release status

**v0.1.0-rc.2 is a preview, not a production-stable release.** It replaces the withdrawn server rc.1 and starts a cleaned-up source history. Published SDK versions have not been rewritten.

Use it to evaluate the product. Before deploying it in production, test capacity, recovery and security in your own environment. Passing a build or functional test does not establish throughput or availability guarantees.

The [production checklist](https://github.com/viber-ops/configra/blob/v0.1.0-rc.2/docs/production-readiness.md) lists remaining work. [Historical verification records](https://github.com/viber-ops/configra/blob/v0.1.0-rc.2/docs/verification/2026-09-12.md) identify each run's version and scope; they are not complete acceptance evidence for a later release.

## Who can read which data

- **Tokens grant access by environment.** An application granted `production` can read all its Configs and Vault values, not just one item.
- **Namespaces only organize resources.** Neither Vault nor Kubernetes Namespaces narrow the Token's server-side access.
- **Human roles cover the whole workspace.** Admins can manage data; Viewers have read-only access and cannot reveal sensitive values. These are not per-project roles.

If teams or applications must not read each other's data, do not rely on names within a shared environment. Use separate deployments or a system with the permission granularity you need.

## Protections and their limits

Application reads use HTTPS and, by default, both a Token and a client certificate. The configured login provider authenticates people; management changes require Admin permission.

Vault values and CA signing keys are encrypted in the database. Someone who obtains both the database and Master Key may still decrypt them, so control and back them up separately. Client private keys are delivered only at issuance and are not retained by the service.

Revoking a Token, client certificate or CA prevents later authorized reads. It **does not delete configuration already downloaded** or clear a synchronized Kubernetes Secret.

The CSI provider is a trusted component running on Kubernetes nodes. A sync controller can read and write Secrets in its application namespace. Review these permissions before installing either component.

## What is not guaranteed yet

| Item | Effect on your deployment |
| --- | --- |
| Sustained 1000 reads per second | The required ten-minute gate has not passed; do not plan production capacity from that figure |
| Large configuration inventories | Some backend endpoints return full collections; UI pagination does not mean one database page is queried |
| Automatic Master Key rotation | No automatic rotation or HSM / cloud KMS custody |
| Per-Config permissions | Grants still cover an entire environment |
| Automatic application restarts | Configuration changes need application reload logic or deployment-controlled restarts |
| Automatic renewal deployment | New certificates can be issued, but deployment and expiry alerts need separate arrangements |

## Access and Audit logs

Access records describe reads and are sent through NATS. They may be lost during failures, so they do not guarantee a record for every read.

Audit records describe changes. Stored events use a database-backed delivery queue with retries. rc.2 fixes certificate-event decoding and adds records for authenticated rejected writes. If a receipt cannot be persisted, the request returns `503 audit_unavailable`. The service cannot promise a durable record while its database is unavailable; large recovery/failure drills remain open.

## Report a problem

For ordinary usage problems, [open an issue](https://github.com/viber-ops/configra/issues) with the version, status code, Request ID and a sanitized reproduction. Do not attach Tokens, private keys, production configuration or complete sensitive responses.

Use the repository's [private vulnerability reporting](https://github.com/viber-ops/configra/security/advisories/new) for security findings. Do not publish confidential exploit details first.
