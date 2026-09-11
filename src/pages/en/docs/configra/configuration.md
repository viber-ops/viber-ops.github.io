---
layout: ../../../../layouts/Docs.astro
title: Configs and Vault
description: Manage configuration by environment and reference shared values instead of copying them.
source: docs/design.md
---

## Create configuration

Create an Environment, then a YAML or JSON document in Configs. Put ordinary settings directly in the Config and shared credentials in Vault fields.

```yaml
server:
  port: 8080
  log_level: info
database:
  host: postgres.internal
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

Check the selected Environment before saving. Inspect history and compare revisions after changes. When cloning to another environment, verify the referenced Vault Item has values for that target; cloning configuration does not complete every credential migration.

## Choose field types

- **Text:** usernames and ordinary textual values.
- **Secret:** passwords and credentials requiring an explicit reveal action.
- **File:** certificates or other content whose original bytes must be preserved.

Sensitive values are hidden by default. Revealing them creates an Access event. Avoid including real values in screenshots and issue reports. Access delivery is best effort, not a zero-loss compliance guarantee.

![Vault fields and environment variants in the management workspace](/assets/configra/vault-light.png)

_Demo data: references and revisions are visible; sensitive values remain hidden._

## Apply changes to applications

Changing a Config or referenced Vault value does not mean a running application has adopted it. Later reads return the new content or ETag; the consumer must refresh and apply it.

| Consumer                         | Required action                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Direct Go reads                  | Fetch again, parse and apply                                                       |
| Viper Watch                      | Start Watch; handle application-state changes in the callback                      |
| CSI files                        | Enable driver rotation and make the application reread files                       |
| Native Secret / ConfigMap volume | Wait for Kubernetes propagation and reread; avoid subPath when refresh is required |
| envFrom                          | Replace the Pod so the new process reads new environment variables                 |

## History and rollback

Use history to inspect and compare saved revisions. To roll back, save the reviewed old content as a new current revision and check that consumers receive and apply it.

Config references resolve current Vault values. Restoring old Config text does not restore the Vault values used at that historical moment. Coordinate related field changes and verify the resolved result.

## Limits and failures

Standard Config / File reads allow up to 5 MiB; Kubernetes integrations use smaller limits. Fix missing references, invalid formats or grants at their source. Disabling TLS verification is not a recovery method.

Vault Namespaces organize items. Moving an item to a different Namespace does not narrow a Token's Environment-wide permissions.
