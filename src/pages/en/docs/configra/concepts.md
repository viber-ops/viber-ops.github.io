---
layout: ../../../../layouts/Docs.astro
title: Glossary
description: Understand workspace labels through a database configuration example.
source: CONTEXT.md
---

Start with three ideas: an **Environment** separates development from production, a **Config** stores the document an application reads, and **Vault** stores values referenced by that document.

## Configuration and values

For a payment service connecting to a database:

| Workspace label | Purpose | Example |
| --- | --- | --- |
| Environment | Identifies where the settings are used | `development`, `production` |
| Config | Stores a YAML / JSON document | `payment` |
| Vault Namespace | Groups Vault items; does not set permissions | `platform` |
| Vault Item | Groups related fields | `database` |
| Field | Stores a text value, password or file | `username`, `password` |
| Variant | Assigns one set of field values to one or more environments | The development database account and password |
| Resolved Config | A complete document with references replaced by values | The YAML received by the application |

Namespace and Item key together identify an item, such as `platform.database`. Different Namespaces can contain items with the same key.

## References

Instead of putting a password in the Config, refer to its location in Vault:

```yaml
database:
  password: '{vault.platform.database.password}'
```

This selects the `password` field of the `database` item in `platform`. Reading the Config in `development` uses values assigned to development; reading it in `production` uses production values.

Use the complete form `{vault.<namespace>.<item>.<field>}` as the entire string value. Do not omit the Namespace or embed it in a string such as `password={vault...}`. Historical suffixes such as `@vN` are not supported.

File fields have a separate read operation and cannot be embedded in this YAML. See [Configs and Vault](/en/docs/configra/configuration/).

## Human and machine identity

- **People open the workspace:** Configra connects to your login system through OIDC. Administrators configure which users are Admin or Viewer. Viewers cannot change data, reveal passwords or request resolved sensitive content.
- **Applications read configuration:** an administrator supplies a Token and, by default, a client certificate. The certificate identifies the caller; the Token grants access to environments. A workspace password is not an API Token.

These permissions are not per-Config. Human roles cover the workspace; Token grants cover an entire environment.

## Revisions and ETags

Saved changes have revision history. A read returns the content, the Config and Vault revisions used, and a content identifier called an ETag.

Send that ETag on a later read. If nothing changed, the server returns `304`: there is no new content to download. This is not an error. The SDK's polling handler takes care of this exchange.

A single resolved document is internally consistent. Reading several documents does not guarantee they all represent the same point in time.

## Server and client certificates

| Material | Purpose | Does the application receive it? |
| --- | --- | --- |
| API server HTTPS certificate | Lets the application verify the server | Supply the server CA's public certificate when using an internal CA |
| Client certificate and private key | Lets Configra verify the caller | Yes, each application uses its own pair |
| CA signing private key | Lets the service issue client certificates | No; never distribute it to applications |
| Master Key | Lets the service decrypt stored values and CA keys | No; only Configra uses it, with a separate protected backup |

The client CA is not the server CA. Mixing them up causes connection failures; disabling HTTPS verification is not a fix. Use the [certificate guide](/en/docs/configra/certificates/) when you need to issue credentials.
