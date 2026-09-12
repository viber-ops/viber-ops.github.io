---
layout: ../../../../layouts/Docs.astro
title: Local quickstart
description: Open the workspace on your computer, save a configuration, and optionally read it with a Go example.
source: Makefile
---

Start with the workspace and a saved configuration. If you only want to explore the UI, stop after step 3. The later client steps are optional, and none of this walkthrough needs Kubernetes.

## 1. Prepare your computer

You need Git, Go 1.25.13 or newer, Node.js 24, npm, Make, OpenSSL and Docker Compose with Linux-container support. Start Docker first. The first run needs internet access to download dependencies and images.

This demo uses fixed accounts and passwords. **Do not enter production data or expose it publicly.** Its databases use temporary memory-backed storage (tmpfs): stopping MySQL or ClickHouse loses their data, even without deleting a volume.

## 2. Download and start

Run these commands in a new empty directory. They create adjacent repositories; do not overwrite an older checkout.

```sh
git clone --branch v0.1.0-rc.2 https://github.com/viber-ops/configra.git
git clone --branch v0.1.0-rc.2 https://github.com/viber-ops/configra-go.git
cd configra
make local-run
```

The command prepares demo databases, login, certificates and the UI, then keeps the management process running. **Leave this terminal open.** Git's `detached HEAD` message is expected when checking out a release tag; it does not prevent running the software.

Open [https://localhost:18088](https://localhost:18088). Login takes you to the local login provider at [http://localhost:18080](http://localhost:18080). Use the Admin account:

| Role | Username | Demo password | Access |
| --- | --- | --- | --- |
| Admin | `admin` | `configra-admin` | Create or edit configuration and manage credentials |
| Viewer | `viewer` | `configra-viewer` | Read permitted non-sensitive content; no changes |

Your browser may warn about the self-signed development HTTPS certificate. Only use system trust controls after confirming that this is your own service at `localhost`. Do not disable system or application HTTPS verification.

## 3. Save your first configuration

1. In **Environments**, create an environment with Key `development`. Its display name can be “Development”.
2. In **Configs**, create Key `payment`, choose environment `development` and select YAML.
3. Paste and save:

```yaml
server:
  port: 8080
  log_level: info
```

You should now see the configuration and its first revision. This completes the basic workspace walkthrough. Try changing `log_level`, saving it, and comparing the two revisions in history.

## 4. Optional: store a password in Vault

Vault stores values referenced by configurations. Use a demo password here, not a real database credential.

1. Create a Vault item with Namespace `platform` and Item key `database`.
2. Add Text field `username` and Secret field `password`.
3. Add a set of environment values, called a Variant, bind it to `development`, enter a demo username/password and save.
4. Return to `payment`, append the following and save:

```yaml
database:
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

A reference tells Configra where to find a field. When the application reads, Configra replaces it with the value assigned to `development`. Keep the entire reference in quotes; the environment does not belong in the reference string.

## 5. Optional: read it from Go

The workspace and application read API are separate processes. The first command only started the workspace. **Do not use port 18088 as the SDK API address.**

As Admin, open **Administration**. Follow [client certificates](/en/docs/configra/certificates/) to create a client CA and issue a client certificate, then create an API Token granting `development`. Keep the default certificate-authentication requirement.

Save the first exported `client.crt`, `client.key` and Token. Put the Token alone in a plain text file, such as `configra-token`, without quotes. These files can live in any protected directory; no fixed directory name is required. Never give the CA private key to the application.

In the `configra` checkout, create `.cache/local-dev/api.yaml` containing:

```yaml
version: 1
listen: localhost:18089
tls:
  certificate_file: .cache/local-dev/server.crt
  private_key_file: .cache/local-dev/server.key
mysql:
  dsn_env: CONFIGRA_MYSQL_DSN
key_provider:
  master_key_file: .cache/local-dev/master-key
nats:
  urls: [nats://127.0.0.1:42229]
logging:
  level: info
```

Open a second terminal in that same `configra` directory and start the API. This is the demo database connection, not a production setting:

```sh
CONFIGRA_MYSQL_DSN='configra:configra-test@tcp(127.0.0.1:33079)/configra_local?parseTime=true&charset=utf8mb4&collation=utf8mb4_0900_ai_ci' \
  go run ./cmd/configra api --config .cache/local-dev/api.yaml
```

Leave it running. In a third terminal, start from `configra` and enter the adjacent SDK checkout. Replace the three `/absolute/path/` entries with the **full paths** to your saved files:

```sh
cd ../configra-go
export CONFIGRA_URL=https://localhost:18089
export CONFIGRA_TOKEN_FILE=/absolute/path/configra-token
export CONFIGRA_CLIENT_CERT=/absolute/path/client.crt
export CONFIGRA_CLIENT_KEY=/absolute/path/client.key
export CONFIGRA_SERVER_CA=../configra/.cache/local-dev/server.crt
go run ./examples/basic
```

Success prints `Loaded Config revision ... (yaml)`. The example prints revision metadata, not configuration or passwords. `CONFIGRA_SERVER_CA` is the local API server certificate, **not the client CA exported from the workspace**. Other initialization options are in the [Go SDK guide](/en/docs/configra/go-sdk/).

## Stop the stack

Press `Ctrl+C` in the Management and API terminals. Dependency containers remain running.

When you no longer need the demo data, stop this walkthrough's dependencies from the `configra` directory. This uses the default project name `configra-local`; if you set `LOCAL_PROJECT` at startup, use that same name here:

```sh
docker compose --project-name configra-local \
  -f deploy/compose.test.yaml -f deploy/compose.local.yaml stop
```

**This loses the temporary database data.** It does not pause the demo for later use with its old data. Do not stop containers from other projects.

## Troubleshooting

| Symptom | Check first |
| --- | --- |
| Cannot connect to Docker | Docker is running and `docker compose version` works for your user |
| Port already in use | Identify the owning service; do not stop unrelated services |
| Initial downloads fail | Access to GitHub, Go/npm registries and container registries; retry after restoring connectivity |
| Workspace works, SDK cannot connect | API is running in the second terminal; URL is `https://localhost:18089` |
| Certificate is not trusted | Use this guide's `CONFIGRA_SERVER_CA`, not the client CA |
| 401 / 403 response | Token grants `development`; client certificate matches, is valid and is not revoked |
| Configuration not found | Environment and Config keys are `development` and `payment` |

For a deployed service, do not reuse these accounts, certificates or temporary databases. Continue with [service deployment](/en/docs/configra/deployment/).
