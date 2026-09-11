---
layout: ../../../../layouts/Docs.astro
title: Backup, upgrades and troubleshooting
description: Recover service state and logs separately, protect the Master Key, and diagnose failures without exposing secrets.
source: deploy/backup/README.md
---

## Backup scope

MySQL contains service state and needs the original, separately protected Master Key and bootstrap configuration for recovery. Back up ClickHouse Access / Audit logs independently. Core NATS is transient, not recoverable configuration state.

Protect backups with encryption, access controls, retention and off-site storage. SHA-256 manifests detect corruption, not independent authenticity. Keep the Master Key outside the backup archive and its access-credential scope.

## MySQL recovery

`deploy/backup` provides MySQL 8.0.22 tools. Install the matching 8.0.22 client tools and mount `/run/secrets/mysql.cnf`, for example:

```ini
[client]
host=mysql.example.internal
port=3306
protocol=tcp
user=configra_backup
password=replace-through-secret-volume
```

Replace the hostname and account, supply the password through a controlled Secret, and do not commit the real file. The backup account needs to read the selected database; the restore account needs to create, populate and remove the specified new target on failure. `/backup` must be a writable, persistent backup mount.

Start from the repository root. Enter the tools directory, create a fresh empty backup directory, and use a restore database name that does not already exist:

```sh
cd deploy/backup
mkdir -m 700 /backup/new-point
sh mysql-backup.sh /run/secrets/mysql.cnf configra /backup/new-point
sh mysql-restore.sh /run/secrets/mysql.cnf /backup/new-point configra_restore_trial
```

The dump uses a consistent transaction, emits compressed SQL and a hash manifest, and refuses existing output. Restore validates the manifest and creates a new database rather than overwriting one. Do not run schema upgrades concurrently with the dump.

After success, the directory contains `mysql.sql.gz` and `manifest.sha256`. Use different backup/restore names for another run rather than deleting an existing recovery point to make it pass. These scripts are not a cross-version 8.0.22-to-8.4 migration tool.

After restore, start an isolated instance with the original Master Key. Check `/health/ready`, configuration reads and client certificates before promoting the database.

## Logs and upgrades

ClickHouse uses native backups restored to a new target. Verify row counts, retention and access before switching queries. Configuration serving can recover before historical logs do.

Before upgrades, record the previous image/tag, database recovery point and Master Key recovery location. Upgrade Management, then API, then verify SDK / Kubernetes consumers. Do not assume an older binary accepts a newer schema.

## Troubleshooting

| Symptom                                       | Check first                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| Readiness fails                               | MySQL connectivity/state and whether the Master Key matches the database         |
| OIDC login lacks permissions                  | Issuer, callback, trusted role Claim and Admin / Viewer mappings                 |
| TLS handshake fails                           | API hostname, server CA, client identity and TLS passthrough                     |
| A newly issued CA is not accepted immediately | Allow the roughly five-second public-trust refresh, then recheck credentials     |
| Machine read is denied                        | Token Environment grants/expiry/revocation and client/issuer status              |
| Vault reference fails                         | Four-part syntax, field type and values for the target Environment               |
| Binding refuses a same-named target           | Owner reference; the controller deliberately protects unrelated objects          |
| Secret changed but application did not        | File reload, subPath usage, or whether an envFrom Pod was replaced               |
| CA appears but issuance fails                 | Master Key, CA status and validity; do not regenerate the Master Key as a repair |

Issue reports should include versions, Request IDs, status codes and sanitized structure, not live Tokens, private keys, Vault values or full raw responses.

## Before production

- Run sustained load tests on the actual deployment; historical QPS is not a capacity guarantee.
- Rehearse recovery from backup plus Master Key and verify both configuration and certificates.
- Monitor expiry, database failures, synchronization failures and unavailability.
- Check whether Environment-wide grants fit your trust model.
- Review [preview limitations](/en/docs/configra/security/) before choosing rollout and rollback procedures.
