---
layout: ../../../../layouts/Docs.astro
title: Local quickstart
description: Run the development stack and create a configuration that references a Vault value.
source: Makefile
---

## Prerequisites

Install Git, Go 1.25.13 or newer, Node.js 24, npm, Make, OpenSSL and Docker Compose with Linux-container support. The first run downloads dependency images.

The development stack contains fixed demo accounts and credentials. Run it only on a controlled development machine, without production data or public network exposure. It is not a production deployment template.

This version uses **temporary tmpfs databases**. Stopping MySQL or ClickHouse loses their data, even without deleting a Docker volume. Export or back up anything you need to keep; use the [service deployment guide](/en/docs/configra/deployment/) for persistent infrastructure.

## Clone and start

Keep the two repositories in adjacent directories. Use the preview tags so the code matches this guide.

```sh
git clone --branch v0.1.0-rc.1 https://github.com/viber-ops/configra.git
git clone --branch v0.1.0-rc.1 https://github.com/viber-ops/configra-go.git
cd configra
make local-run
```

The command installs and builds the UI, prepares development certificates and OIDC settings, starts MySQL / NATS / ClickHouse / Casdoor, and runs Management in the foreground. Open [https://localhost:18088](https://localhost:18088); login redirects to [http://localhost:18080](http://localhost:18080).

The development HTTPS certificate is self-signed. Handle the local certificate through your system's trust controls only after confirming this is your own service. Production requires a verifiable certificate.

| Role   | Username | Development password |
| ------ | -------- | -------------------- |
| Admin  | `admin`  | `configra-admin`     |
| Viewer | `viewer` | `configra-viewer`    |

This command starts the management workspace, not the separate machine API. Before connecting an SDK, start `configra api` with the prerequisites in the [service deployment guide](/en/docs/configra/deployment/).

## Create configuration

1. In **Environments**, create `development`.
2. In **Vault**, create an Item with Namespace `platform` and Item key `database`.
3. Add Text field `username` and Secret field `password`, with demo values for `development`.
4. In **Configs**, create `payment` for `development`, select YAML, and save this document:

```yaml
server:
  port: 8080
database:
  username: '{vault.platform.database.username}'
  password: '{vault.platform.database.password}'
```

Each reference occupies the complete scalar and has four segments: `vault`, Namespace, Item and Field. The Config supplies the Environment; it is not part of the reference string.

## Connect a client

In Administration, create a client CA, issue a client certificate, and create an API Token granting `development`. Save the first private-key export, then follow the [Go SDK](/en/docs/configra/go-sdk/) or [Kubernetes](/en/docs/configra/kubernetes/) guide.

The managed client CA verifies machine identities. It is not the CA of the API server's HTTPS certificate.

## Stop the stack

Press `Ctrl+C` in the Management terminal to stop only that process; dependency containers keep running. Once the temporary demo data is no longer needed, stop those containers:

```sh
docker compose -f deploy/compose.test.yaml stop
```

This `stop` command also clears tmpfs data; it is not a data-preservation method. If ports are occupied, identify their owner and adjust your development configuration; do not stop unrelated services.
