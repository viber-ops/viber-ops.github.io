---
layout: ../../../../layouts/Docs.astro
title: Core concepts
description: Understand environments, configuration, Vault references and the two kinds of identity.
source: CONTEXT.md
---

## Configuration and values

| Concept         | Meaning                                                      | Example                             |
| --------------- | ------------------------------------------------------------ | ----------------------------------- |
| Environment     | Configuration environment and machine-Token grant scope      | `production`                        |
| Config          | A YAML / JSON document for an environment                    | `payment`                           |
| Vault Namespace | Organizational Item identity, not a permission boundary      | `platform`                          |
| Vault Item      | A collection identified by `(namespace, item)`               | `platform.database`                 |
| Field           | Text, Secret or File content                                 | `username`, `password`, `tls_cert`  |
| Variant         | Field values associated with environments                    | Production database credentials     |
| Resolved Config | A document whose Text / Secret references have been resolved | The YAML received by an application |

## References

```yaml
database:
  password: '{vault.platform.database.password}'
```

The syntax is `{vault.<namespace>.<item>.<field>}`. A reference must occupy the whole YAML / JSON scalar. String interpolation such as `"password={vault...}"`, omitted Namespaces and historical `@vN` references are not supported.

The Config's Environment selects current values. File fields use a separate read operation and are not embedded as Text / Secret values.

## Human and machine identity

**Humans access Management** through OIDC. Configured trusted Claims determine Admin / Viewer roles. These roles apply to the entire workspace.

**Machines access API** with an Environment-scoped Token and, by default, a registered valid mTLS client certificate. Only Tokens explicitly allowing Token-only access may omit that certificate. HTTPS server verification is always required.

## Revisions and ETags

Configs and Vault Items have separate revision histories. A resolved read returns the Config revision, Vault revisions used and an ETag. A later request with an unchanged ETag can receive `304`.

One resolved document is internally consistent. Multiple objects read for a CSI mount or native target do not share one database snapshot.

## Server and client certificates

- **Server HTTPS certificate:** lets the caller verify the Configra API server. An independent CA or public PKI issues it.
- **Client mTLS certificate:** lets Configra verify a machine. A managed client CA can issue it.

The client CA downloaded from Administration is not automatically the API server's trust root. The external Master Key decrypts persistent service state; it is neither an HTTPS key nor an API Token.
