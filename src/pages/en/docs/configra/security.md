---
layout: ../../../../layouts/Docs.astro
title: Security and release status
description: Review implemented protections, verification evidence and remaining work before deploying.
source: docs/security-architecture-review.md
---

## Release status

**v0.1.0-rc.1 is a preview, not a production-stable release.** The tag comes from the reviewed feature branch; it does not merge the draft PR. No throughput, availability SLA or independent security certification is claimed.

The branch has records of core/SDK race tests, database/container integration, 41 browser regressions and real Kubernetes / CSI rotation checks. See the [review report](https://github.com/viber-ops/configra/blob/v0.1.0-rc.1/docs/security-architecture-review.md) for scope and results. These records do not replace deployment-specific acceptance.

## Trust boundaries

- Tokens grant **Environment-wide** access. Same-environment Tokens can read the same Configs / Vault values; certificates and Kubernetes namespaces do not add per-resource authorization.
- Human Admin / Viewer roles are workspace-wide, not per-project or per-tenant.
- CA signing keys are encrypted in MySQL. Compromise of both the database and Master Key defeats that protection.
- Revocation prevents future authorized reads, not use of previously delivered data.
- The CSI provider is a trusted node extension with a hostPath socket. Sync controllers can read/write Secrets in their application namespace.

Untrusted applications or tenants need separate trust domains/deployments or finer server-side authorization. Naming conventions do not provide isolation.

## Implemented protections

HTTPS verification, default mTLS and active Token/certificate checks protect machine reads. OIDC and Admin permissions protect management operations. Vault content and CA signing keys use authenticated encryption. Client private keys are not retained; private exports are excluded from replay and Audit payloads.

Kubernetes object paths, response sizes and cross-namespace references are constrained. Native synchronization protects unrelated ownership and retains the previous successful value after read failures.

These mechanisms depend on correct deployment and credential/Master Key management. They do not establish an absence of security risks.

## Remaining work

| Item                                       | Current status                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 1000 QPS gate                              | Warmup failed on the shared Docker host; the measured phase did not run. Do not advertise that capacity as accepted |
| Gateway rejection audit                    | Malformed JSON, missing operation IDs and forbidden Viewer writes are not all persisted to durable Audit            |
| Large resource inventories                 | Some backend lists return full collections; client-side pagination is not database pagination                       |
| Master Key rotation                        | No automated rotation or HSM/KMS custody                                                                            |
| Multi-tenant isolation                     | No Config/Item-level grants                                                                                         |
| Application restart and renewal deployment | No automatic process restart or deployment of renewed credentials                                                   |

Access events use best-effort NATS delivery. Persisted Audit uses an outbox, but this is not a guarantee of zero-loss auditing of every request.

## Report safely

Use public issues only for non-sensitive problems. Never attach live Tokens, private keys, production configuration or confidential exploit details. Establish a private reporting channel with maintainers before providing the minimum sensitive reproduction details.
