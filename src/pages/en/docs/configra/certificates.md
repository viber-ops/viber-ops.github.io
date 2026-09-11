---
layout: ../../../../layouts/Docs.astro
title: Client certificates
description: Create client CAs, issue identities and manage revocation in the workspace.
source: docs/managed-certificates.md
---

## Create a CA

Sign in as an OIDC Admin and create a client-authentication CA in Administration. The default lifetime is five years, with a ten-year maximum.

The original creation response offers a backup ZIP containing the CA certificate and private key. If you need the backup, save it to a controlled location before closing the export dialog. Later downloads provide only the public certificate.

Configra retains the CA signing key encrypted in MySQL, so online issuance continues even without a downloaded backup. Encryption depends on the externally supplied Master Key.

## Issue a client certificate

Choose the CA and issue a separate certificate for a workload. Client lifetime defaults to 90 days, is capped at one year, and cannot exceed the CA's expiry. Keys use ECDSA P-256 and PKCS#8 private-key format.

Save `client.crt` and `client.key` from the first ZIP and distribute them through your deployment's credential controls. Configra does not persist the client private key.

A lost response or export cannot be recovered by retrying. Revoke that client credential and issue another. Idempotent creation replays return metadata without private exports, including requests handled by different Management replicas.

![Managed client certificate authorities in Administration](/assets/configra/authorities.png)

## Rotate and revoke

Issue a replacement before expiry, deploy it, verify new connections and then revoke the old credential. The advanced Go SDK callback can return an atomically replaced certificate; close idle connections after replacement to trigger new handshakes.

Client revocation is permanent. Revoking a CA also prevents authorization by clients it issued, including certificates signed offline with its exported key and subsequently imported. API authorization checks client and issuer status on every read, including existing TLS connections.

Revocation cannot recall plaintext already delivered to an application, mounted file or Kubernetes Secret.

## Persistence in Kubernetes

CA state lives in MySQL, not Pod memory or temporary files. All Management / API replicas need the same database and Master Key. API replicas refresh their public trust pool every five seconds, so newly created CAs may need that interval to propagate.

Back up the database and separately protect the original Master Key. Losing the key makes retained signing-key ciphertext unusable. Do not combine the key and database backup into one archive or access-credential scope.

## Scope

These are **client mTLS CAs**, not replacements for server HTTPS certificates, a general enterprise PKI, an HSM or an automatic certificate-deployment system. Operators still arrange renewal deployment, expiry monitoring and recovery procedures.
