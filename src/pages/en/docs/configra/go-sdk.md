---
layout: ../../../../layouts/Docs.astro
title: Go SDK
description: Read configuration from Go; start with one read and add Viper polling only when needed.
---

## Install

This guide is for developers connecting a Go application. If no server is running, first complete the client steps in the [local quickstart](/en/docs/configra/quickstart/).

Use Go 1.25.13 or newer and run this command in your existing Go project. The SDK is a library; you do not need the server's macOS or Linux executable:

```sh
go get github.com/viber-ops/configra-go@v0.1.0-rc.2
```

Prepare the API HTTPS address, an Environment Token and, for mTLS, an issued client certificate and key. An internal server CA also requires its public certificate.

## Start with the common path

The SDK loads certificates and sets up TLS, timeouts and connection pooling. Application code initializes the client and reads configuration:

```go
client, err := configra.NewClientFromEnv()
if err != nil {
    return err
}
defer client.CloseIdleConnections()

result, err := client.ReadResolvedConfig(ctx, "development", "payment", "")
if err != nil {
    return err
}
// Parse result.Content; do not log it.
// Pass result.ETag to a later read; unchanged content returns ErrNotModified.
```

Import `github.com/viber-ops/configra-go` and supply your application's context as `ctx`. The [complete example](https://github.com/viber-ops/configra-go/blob/v0.1.0-rc.2/examples/basic/main.go) compiles and prints revision metadata, not configuration values.

## Choose an initialization path

| Existing application setup                    | Entry point                          |
| --------------------------------------------- | ------------------------------------ |
| Environment variables / mounted Secrets       | `NewClientFromEnv()`                 |
| A deployment settings file                    | `NewClientFromFile("configra.yaml")` |
| Its own config system or in-memory parameters | `NewClient(ClientOptions{...})`      |

Choose one. All three use the same client validation; they do not silently merge sources or introduce a configuration-priority order.

## Environment variables

The following runs the SDK repository's example. Clone the `configra-go` rc.2 tag and enter that directory, or use the adjacent SDK checkout from the quickstart. Replace the address and `/secure/` paths with actual values. Your own application can use the same settings with its own startup command.

Choose a Token value or a Token file. A Token file contains only the Token, without quotes, and works with mounted Kubernetes Secrets:

```sh
export CONFIGRA_URL=https://configra-api.example.internal:9443
export CONFIGRA_TOKEN_FILE=/secure/configra-token
export CONFIGRA_CLIENT_CERT=/secure/client.crt
export CONFIGRA_CLIENT_KEY=/secure/client.key
# Only for a server certificate issued by an internal CA:
export CONFIGRA_SERVER_CA=/secure/server-ca.crt
go run ./examples/basic
```

Run this from the tagged SDK repository after provisioning those files. You can inject `CONFIGRA_TOKEN` instead, but do not set both Token sources. The SDK does not search for `.env` files or require a credential directory. Request timeout defaults to 30 seconds; use `CONFIGRA_TIMEOUT=10s` to change it.

## Settings file

```go
client, err := configra.NewClientFromFile("configra.yaml")
```

```yaml
url: https://configra-api.example.internal:9443
token_file: /run/secrets/configra-token
cert_file: client.crt
key_file: client.key
# server_ca_file: server-ca.crt # only for an internal server CA
```

Relative paths start next to the YAML file, not the process working directory. The loader does not merge environment settings or expand shell variables. It rejects unknown fields, multiple documents and conflicting options. An inline `token` is supported, but referencing a protected `token_file` avoids storing credentials in YAML. Never commit real Tokens.

## Explicit options and combined PEM files

An application that already owns its settings can pass them directly:

```go
client, err := configra.NewClient(configra.ClientOptions{
    BaseURL:               apiURL,
    Token:                 token,
    ClientCertificateFile: "client.pem",
})
```

Here `client.pem` contains both certificate and private key. A public certificate alone cannot prove possession of a key. For separately exported files, set `ClientCertificateFile` and `ClientKeyFile`. `ServerCAFile` is only needed for an internal API server CA.

No fixed directory is required, and the Token need not be packed into a certificate file. Use advanced `TLSConfig` for existing in-memory TLS state or live certificate callbacks. It cannot be combined with file-based TLS options.

## Initialization errors

Initialization checks conflicting inputs, file reads, certificate/key matching, client-certificate usage and validity. Diagnostics identify the relevant field and a repair step without echoing Tokens, private keys, supplied values or raw PEM-decoder output.

An unset address in environment mode names `CONFIGRA_URL`. An unknown YAML field identifies its line and lists supported keys. Unknown settings are not ignored.

| Error or situation                       | Repair                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| URL required / must be an HTTPS origin   | Use the machine API address, not Management's `/ui/`; omit paths, query strings and embedded credentials                |
| Token missing / invalid                  | Create an API Token in Administration; a login password or certificate is not a Token                                   |
| Both Token value and Token file          | Choose one source, including in environment mode                                                                        |
| File not found / not readable            | Check mounts and permissions; YAML-relative paths start next to that YAML file                                          |
| No usable certificate/private-key pair   | Supply matching CRT / KEY files or a combined PEM; encrypted private keys and P12 files are not accepted by this loader |
| CA instead of a client identity          | Use a client certificate issued by the CA; do not distribute its signing key to applications                            |
| Expired / not yet valid                  | Check the clock and deploy a currently valid client certificate                                                         |
| Client authentication not permitted      | Do not use a server HTTPS certificate as a client identity                                                              |
| Unknown / duplicated YAML field          | Fix the reported line; fields are not silently overwritten                                                              |
| File TLS options combined with TLSConfig | Choose the ordinary file path or advanced TLS configuration                                                             |

Network reachability, server trust and server-side grants are checked on the first read, not by a hidden constructor request. For `x509: certificate signed by unknown authority`, check the **API server** CA rather than disabling verification. For HTTP 401 / 403, check Token validity, Environment grants and client/CA status.

Input limits are 64 KiB for settings, 1 KiB for a Token file, 128 KiB for the certificate or combined PEM, 64 KiB for a separate key, and 1 MiB for a server CA bundle.

## Files and response limits

Read File fields separately:

```go
file, err := client.ReadFile(ctx, "development", "platform", "database", "tls_cert", "")
```

`file.Bytes` preserves the original bytes. Standard content is limited to 5 MiB. `MaxContentBytes` can lower that limit, not raise it.

## Viper snapshots and live updates

Skip this section if the application only reads at startup. Viper is a Go configuration parser; a Snapshot is a downloaded and parsed configuration copy.

Create a `NewViperHandler` with Client, Environment, Config, OnChange and OnError. Call `Load(ctx)`, apply the initial snapshot, then start `Watch(ctx)`:

```go
handler, err := configra.NewViperHandler(configra.ViperHandlerOptions{
    Client: client, Environment: "development", Config: "payment",
    OnChange: func(ctx context.Context, previous, current *configra.Snapshot) error {
        return applyConfig(current) // Your validation and atomic state replacement.
    },
    OnError: func(err error) {
        logger.Warn("Configra reload failed", zap.Error(err))
    },
})
if err != nil {
    return err
}
initial, err := handler.Load(ctx)
if err != nil {
    return err // A cold start has no previous snapshot.
}
if err := applyConfig(initial); err != nil {
    return err
}
return handler.Watch(ctx)
```

This fragment expects your own `applyConfig` and logger. `Load` does not call OnChange. Reload / Watch install the parsed SDK snapshot **before** invoking the serial callback. Callback failure does not roll it back; keep separate validated application state and replace it atomically.

Watch defaults to about 30 seconds with jitter, rejects intervals below five seconds, and backs repeated failures off to at most five minutes. Fetch or parse failure retains the process's last-known-good snapshot. There is no disk cache to recover a failed cold start.

## TLS and rotation

Ordinary file-based setup needs no custom TLS code. The callback below is an advanced option for changing certificates without restarting the process.

The SDK only accepts HTTPS and rejects `InsecureSkipVerify`. It owns its transport rather than depending on `http.DefaultTransport`.

File credentials are loaded once; rebuild the Client after replacing files. Advanced `TLSConfig.GetClientCertificate` can return an atomically replaced identity. After replacement, call `CloseIdleConnections()` so later connections handshake again.

Constructors do not start Watch or automatically register/issue credentials. Only a Token explicitly permitting Token-only access may omit mTLS. Server HTTPS verification always remains required.
