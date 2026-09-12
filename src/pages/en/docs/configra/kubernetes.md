---
layout: ../../../../layouts/Docs.astro
title: Kubernetes integration
description: Let applications in Kubernetes read Configra through files or existing Secret / ConfigMap usage.
source: kubernetes/README.md
---

This guide assumes you can deploy applications with `kubectl`. It covers application reads, not [deploying Configra itself](/en/docs/configra/deployment/). For a first evaluation, use the [local quickstart](/en/docs/configra/quickstart/) without Kubernetes.

## Choose a reading method

| Mode               | Stored in                                    | Updates                                              | Use when                                              |
| ------------------ | -------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| CSI provider       | Ephemeral Pod CSI files                      | Driver rotation; application rereads                 | You do not want native configuration objects          |
| Binding controller | Secret or ConfigMap in Kubernetes API / etcd | Native volume refresh; envFrom needs Pod replacement | The application already uses Kubernetes configuration |

You can maintain configuration in Configra instead of editing ConfigMaps, without replacing Kubernetes' built-in API:

- **CSI files:** a driver mounts configuration in the Pod without first creating a native Secret / ConfigMap.
- **Native synchronization:** a background controller periodically reads Configra and writes a Secret / ConfigMap. Applications keep their existing file or environment-variable setup.

Neither method reloads your application. Environment variables are read at process startup, so changed variables need a newly created Pod.

## Prepare deployment

Before starting:

1. Deploy [Configra](/en/docs/configra/deployment/) with an API address reachable from the cluster. `localhost` inside a Pod points to that Pod, not your computer.
2. Get `kubernetes/deploy` and `kubernetes/examples` from rc.2 source or a release bundle. Run the commands from that root directory.
3. Create Configra environment `production` and Config `application`. If using the quickstart's `development` / `payment`, change those two fields in the YAML below.
4. Prepare a Token granting that environment plus a client certificate/key, using the [credential guide](/en/docs/configra/certificates/).

Build and push the `configra-kubernetes` image. An overlay is your deployment customization directory: it replaces example images, API addresses and namespaces without changing the program. The provider/controller deployment selects the API address; application read rules cannot override it.

Make sure the application namespace exists, creating it first if needed. This example uses `configra-app`. Replace `/secure/` paths with the actual protected files, then create the credentials Secret:

```sh
kubectl -n configra-app create secret generic configra-credentials \
  --from-file=token=/secure/configra-token \
  --from-file=tls.crt=/secure/client.crt \
  --from-file=tls.key=/secure/client.key
```

Examples also use `configra-server-trust` with `ca.crt` to verify the **API server**. Create it in each provider/controller namespace. For public Web PKI, remove `--server-ca-file` and its mount to use system trust roots.

Use separate workload Tokens/certificates for independent rotation and revocation. Tokens granting the same Environment still have the same Configra read scope; Kubernetes namespaces do not narrow that grant.

## CSI file mounts

Install Secrets Store CSI Driver to mount the provider's returned content in Pods. Recorded cluster tests used Kubernetes 1.35.0 and Driver 1.6.1; they do not establish results for other combinations. Use the [official installation instructions](https://secrets-store-csi-driver.sigs.k8s.io/getting-started/installation.html). For periodic updates, enable `enableSecretRotation=true` and set `rotationPollInterval`.

Render the repository example first. Apply your configured overlay, not an unchanged example-registry reference:

```sh
kubectl kustomize kubernetes/deploy/provider
# After reviewing and applying your own overlay:
kubectl apply -f kubernetes/examples/provider.yaml
```

A `SecretProviderClass` specifies what to read and which files to create. This fragment mounts Config `application` from `production` as `app.yaml`. It is not a complete application deployment: the repository example also supplies the Pod, read-only mount and `nodePublishSecretRef` credential reference:

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: configra-application
  namespace: configra-app
spec:
  provider: configra
  parameters:
    fileMode: '0444'
    objects: |
      - type: config
        environment: production
        config: application
        path: app.yaml
```

Permissions default to `0440`; `0400` and `0444` are allowed. The non-root example explicitly uses `0444`, making mounted files readable by other UIDs in that Pod. Use narrower modes when the workload's ownership/group setup supports them. Do not assume fsGroup repairs ownership on every rotation, or use subPath for files requiring refresh.

The provider is a trusted node extension. It runs as root to manage a hostPath Unix socket and has no ServiceAccount API Token. Review its node trust and deployment permissions separately.

## Native object sync

Install the CRD so Kubernetes recognizes `ConfigraBinding` rules, then run a controller in the application namespace. The example has two replicas, with an elected leader handling synchronization. Credentials and targets must stay in that namespace. Do not install it in the namespace holding Configra's Master Key.

```sh
kubectl apply -f kubernetes/deploy/crd.yaml
kubectl kustomize kubernetes/deploy/sync
# After reviewing and applying your own overlay:
kubectl apply -f kubernetes/examples/binding.yaml
kubectl -n configra-app get configrabindings
```

```yaml
apiVersion: configra.viber-ops.github.io/v1alpha1
kind: ConfigraBinding
metadata:
  name: application
  namespace: configra-app
spec:
  credentialsSecretRef:
    name: configra-credentials
  target:
    name: application-config
    kind: Secret
    mode: files
  refreshInterval: 1m
  objects:
    - type: config
      environment: production
      config: application
      path: app.yaml
```

The `ConfigraBinding` above reads once per minute and writes `app.yaml` into Secret `application-config`.

Secret is the default. Secrets still need cluster access controls and suitable storage encryption; the name alone does not protect content. ConfigMaps are not confidential storage. Writing Vault-derived values to one requires explicit `allowSensitiveConfigMap: true`. Even a Config without Vault references may contain sensitive data, so operators must choose the target accordingly.

For `target.mode: env`, use flat mappings such as `PORT: 8080` and `LOG_LEVEL: info`. Nested values, nulls, duplicate keys and cross-object collisions are rejected. File fields use `files` mode.

## Failure and lifecycle

The controller only updates targets it owns through a controller owner reference. Read failures retain previous data. A target-name/kind change removes the old owned target only after the new write succeeds. Deleting a Binding lets garbage collection remove its owned target.

A failed CSI read does not return a partial file set. Existing mounted/native data can remain available after credential revocation; revocation cannot recall previously delivered bytes.

Limits: at most 32 CSI objects and 3 MiB combined; 900 KiB per native target; 128 KiB per env-mode source document.

Native volumes have propagation delays, and an existing process does not acquire changed envFrom variables. See [Kubernetes ConfigMap behavior](https://kubernetes.io/docs/concepts/configuration/configmap/) and [CSI rotation](https://secrets-store-csi-driver.sigs.k8s.io/topics/secret-auto-rotation.html).
