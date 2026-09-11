---
layout: ../../../../layouts/Docs.astro
title: Kubernetes integration
description: Choose CSI file mounts or native Secret / ConfigMap synchronization for application Pods.
source: kubernetes/README.md
---

## Choose a consumption mode

| Mode               | Stored in                                    | Updates                                              | Use when                                              |
| ------------------ | -------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| CSI provider       | Ephemeral Pod CSI files                      | Driver rotation; application rereads                 | You do not want native configuration objects          |
| Binding controller | Secret or ConfigMap in Kubernetes API / etcd | Native volume refresh; envFrom needs Pod replacement | The application already uses Kubernetes configuration |

Configra supplies the source; it does not transparently replace Kubernetes' built-in API. Kubernetes still controls native objects and Pod lifecycle, and the application still decides when to reload.

## Prepare deployment

First deploy the [Configra service](/en/docs/configra/deployment/). Get `kubernetes/deploy` and `kubernetes/examples` from the tagged source or release bundle.

Build and push the `configra-kubernetes` image, then replace example registry, API URL and Namespace values in overlays. The API origin is fixed by the provider/controller deployment; workload parameters cannot override it.

Create workload credentials in the application namespace, shown here as `configra-app`, using securely distributed files:

```sh
kubectl -n configra-app create secret generic configra-credentials \
  --from-file=token=/secure/configra-token \
  --from-file=tls.crt=/secure/client.crt \
  --from-file=tls.key=/secure/client.key
```

Examples also use `configra-server-trust` with `ca.crt` to verify the **API server**. Create it in each provider/controller namespace. For public Web PKI, remove `--server-ca-file` and its mount to use system trust roots.

Use separate workload Tokens/certificates for independent rotation and revocation. Tokens granting the same Environment still have the same Configra read scope; Kubernetes namespaces do not narrow that grant.

## CSI file mounts

Install a patched Secrets Store CSI Driver. Current cluster evidence used Kubernetes 1.35.0 and Driver 1.6.1. For file refresh, enable driver `enableSecretRotation=true` and set an appropriate `rotationPollInterval`.

Render the repository example first. Apply your configured overlay, not an unchanged example-registry reference:

```sh
kubectl kustomize kubernetes/deploy/provider
# After reviewing and applying your own overlay:
kubectl apply -f kubernetes/examples/provider.yaml
```

The SecretProviderClass portion is below. The full example includes a Pod, read-only mount and `nodePublishSecretRef`:

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

Install the CRD once and a controller in each application namespace. The controller uses a namespaced Role and two replicas with leader election. Credential references and targets cannot cross namespaces. Keep it away from Configra's bootstrap Master Key namespace.

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

Secret is the default. ConfigMaps are not confidential storage. Writing Vault-derived values to one requires explicit `allowSensitiveConfigMap: true`. Even a Config without Vault references may contain sensitive data, so operators must choose the target accordingly.

For `target.mode: env`, use flat mappings such as `PORT: 8080` and `LOG_LEVEL: info`. Nested values, nulls, duplicate keys and cross-object collisions are rejected. File fields use `files` mode.

## Failure and lifecycle

The controller only updates targets it owns through a controller owner reference. Read failures retain previous data. A target-name/kind change removes the old owned target only after the new write succeeds. Deleting a Binding lets garbage collection remove its owned target.

A failed CSI read does not return a partial file set. Existing mounted/native data can remain available after credential revocation; revocation cannot recall previously delivered bytes.

Limits: at most 32 CSI objects and 3 MiB combined; 900 KiB per native target; 128 KiB per env-mode source document.

Native volumes have propagation delays, and an existing process does not acquire changed envFrom variables. See [Kubernetes ConfigMap behavior](https://kubernetes.io/docs/concepts/configuration/configmap/) and [CSI rotation](https://secrets-store-csi-driver.sigs.k8s.io/topics/secret-auto-rotation.html).
