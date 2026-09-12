---
layout: ../../../layouts/Docs.astro
title: Kubernetes 接入
description: 让 Kubernetes 中的应用读取 Configra：挂载成文件，或继续使用 Secret / ConfigMap。
source: kubernetes/README.md
---

本篇面向已经会使用 `kubectl` 部署应用的人。这里只讲“应用怎么从 Configra 取配置”；[部署 Configra 自身](/docs/configra/deployment/)是另一件事。第一次试用不需要 Kubernetes，先看[本地体验](/docs/configra/quickstart/)。

## 先选读取方式

| 方式               | 数据放在哪里                                   | 更新方式                               | 适用情况                           |
| ------------------ | ---------------------------------------------- | -------------------------------------- | ---------------------------------- |
| CSI provider       | Pod 的临时 CSI 文件卷                          | 驱动轮换，应用重读文件                 | 希望不创建原生配置对象             |
| Binding controller | Kubernetes API / etcd 中的 Secret 或 ConfigMap | 原生 volume 更新；envFrom 需要替换 Pod | 保留现有应用的 Kubernetes 接入方式 |

可以把配置的维护位置从 ConfigMap 换到 Configra，但不需要替换 Kubernetes 的内置 API：

- **CSI 文件挂载**：由驱动把配置变成 Pod 内的文件，不必先创建原生 Secret / ConfigMap。
- **原生同步**：一个后台控制器定时从 Configra 读取，再写入 Secret / ConfigMap。应用继续使用原来的挂载或环境变量方式。

两种方式都不替应用重新加载配置。特别是环境变量，只在进程启动时读取，更新后需要重新创建 Pod。

## 部署前准备

开始前确认：

1. 已部署 [Configra 服务](/docs/configra/deployment/)，API 地址能从集群内访问。不要使用指向 Pod 自身的 `localhost`。
2. 已从 rc.2 源码或发布包取得 `kubernetes/deploy` 和 `kubernetes/examples`。下方命令从该目录的根部执行。
3. 已在 Configra 中创建环境 `production` 和配置 `application`。如果使用本地体验的 `development` / `payment`，要同步修改下方 YAML 的这两个字段。
4. 已准备允许读取该环境的 Token、客户端证书和私钥，见[证书与访问凭据](/docs/configra/certificates/)。

先构建并推送 `configra-kubernetes` 镜像。overlay 是你自己的部署定制目录，用来替换示例镜像、API 地址和 Namespace（命名空间），不需要修改 Configra 程序。API 地址由 provider / controller 部署参数设定，应用不能在读取规则里另填一个地址。

确认目标应用命名空间已经存在，下面使用 `configra-app`；没有时先创建它。把 `/secure/` 路径换成真实的受控文件路径，再创建凭据 Secret：

```sh
kubectl -n configra-app create secret generic configra-credentials \
  --from-file=token=/secure/configra-token \
  --from-file=tls.crt=/secure/client.crt \
  --from-file=tls.key=/secure/client.key
```

示例还使用 `configra-server-trust` Secret 的 `ca.crt` 验证 API **服务器**。在 provider / controller 各自 Namespace 创建它；若服务器使用公共 PKI，可移除 `--server-ca-file` 和对应挂载，使用系统信任根。

不同工作负载应使用独立 Token 和证书，便于轮换与吊销。但授予同一个 Environment 的 Token 仍有相同的服务端配置读取范围，Kubernetes Namespace 不会缩窄它。

## CSI 文件挂载

先安装 Secrets Store CSI Driver，它负责把 provider 返回的内容挂载进 Pod。已有集群验证使用 Kubernetes 1.35.0 和 Driver 1.6.1；这不是对其他组合的测试承诺。安装驱动的方法见[官方安装文档](https://secrets-store-csi-driver.sigs.k8s.io/getting-started/installation.html)。需要定时更新文件时，开启 `enableSecretRotation=true`，用 `rotationPollInterval` 设置刷新间隔。

以下命令先渲染并检查仓库示例；实际部署应用你修改后的 overlay，不要直接把示例 registry 地址应用到集群。

```sh
kubectl kustomize kubernetes/deploy/provider
# 检查并应用自己的 overlay 后：
kubectl apply -f kubernetes/examples/provider.yaml
```

`SecretProviderClass` 是“读取哪些配置、保存成哪些文件”的规则。下面这段会把 `production` 环境的 `application` 配置挂载为 `app.yaml`。它不是完整的应用部署文件；仓库的完整示例还包含 Pod、只读挂载和凭据引用 `nodePublishSecretRef`：

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

默认文件权限是 `0440`，允许 `0400` / `0444`。上面的非 root 示例明确使用 `0444`，意味着挂载内的文件对该 Pod 中其他 UID 也可读；若应用具备正确所有者或组配置，应采用更窄权限。不要假定 `fsGroup` 会在每次轮换后自动修复所有权，不要用需要轮换的 `subPath`。

provider 是可信节点扩展：以 root 管理 hostPath 上的 Unix socket，不挂载 ServiceAccount API Token。需要独立评估其节点信任与部署权限。

## 原生 Secret / ConfigMap 同步

先安装 CRD，让 Kubernetes 认识 `ConfigraBinding` 这种同步规则，再在应用命名空间部署控制器。示例有两个副本，通过选主确保只有一个负责同步。控制器只能使用本命名空间的凭据和目标，不要将它部署到存有 Configra Master Key 的命名空间。

```sh
kubectl apply -f kubernetes/deploy/crd.yaml
kubectl kustomize kubernetes/deploy/sync
# 检查并应用自己的 overlay 后：
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

上面的 `ConfigraBinding` 表示每分钟读取一次，把配置保存到名为 `application-config` 的 Secret，文件名为 `app.yaml`。

默认使用 Secret。Secret 仍需要集群访问控制和合适的存储加密，名称不代表内容天然安全。ConfigMap 不适合机密值；包含 Vault 派生值时，必须显式设置 `allowSensitiveConfigMap: true` 才允许写入 ConfigMap。即便没有 Vault 引用，普通 Config 也可能包含敏感信息，需要操作者自行判断。

使用 `target.mode: env` 时，配置必须是扁平映射，例如 `PORT: 8080`、`LOG_LEVEL: info`。嵌套值、null、重复键和跨对象冲突会被拒绝。File 字段使用 `files` 模式。

## 读取失败、修改和删除

原生控制器只更新自己持有 owner reference 的目标，不覆盖无关对象。读取失败保留旧内容；修改目标名称或类型后，在新目标写入成功后移除旧的自有目标。删除 Binding 会通过 Kubernetes 垃圾回收删除其拥有的目标。

CSI 读取失败不交付部分文件集合。已有文件或原生对象可能继续保留上一次数据；吊销凭据不能收回已经交付的字节。

限制：CSI 至多 32 个对象、总计 3 MiB；原生目标总计 900 KiB；env 模式每份文档至多 128 KiB。

原生 volume 更新具有传播延迟，envFrom 创建的进程环境不会自动改变。参阅 [Kubernetes ConfigMap 更新机制](https://kubernetes.io/docs/concepts/configuration/configmap/)与 [CSI 轮换说明](https://secrets-store-csi-driver.sigs.k8s.io/topics/secret-auto-rotation.html)。
