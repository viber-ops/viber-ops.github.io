---
layout: ../../../layouts/Docs.astro
title: Kubernetes 接入
description: 同时支持 CSI 文件挂载和原生 Secret / ConfigMap 同步，按应用读取方式选择。
source: kubernetes/README.md
---

## 先选消费方式

| 方式               | 数据放在哪里                                   | 更新方式                               | 适用情况                           |
| ------------------ | ---------------------------------------------- | -------------------------------------- | ---------------------------------- |
| CSI provider       | Pod 的临时 CSI 文件卷                          | 驱动轮换，应用重读文件                 | 希望不创建原生配置对象             |
| Binding controller | Kubernetes API / etcd 中的 Secret 或 ConfigMap | 原生 volume 更新；envFrom 需要替换 Pod | 保留现有应用的 Kubernetes 接入方式 |

Configra 是配置来源，不是对 Kubernetes 内置 API 的透明替换。ConfigMap / Secret 对象、Pod 生命周期和应用重载仍按 Kubernetes 的机制工作。

## 部署前准备

先部署 [Configra 服务](/docs/configra/deployment/)，再从带标签的源码或发布包获取 `kubernetes/deploy` 和 `kubernetes/examples`。

构建并推送 `configra-kubernetes` 镜像，在 overlay 中替换示例镜像、API 地址与 Namespace。API 地址只能由 provider / controller 部署参数设定，工作负载不能通过绑定覆盖它。

在目标应用 Namespace（示例为 `configra-app`）创建凭据 Secret，文件来自受控凭据分发流程：

```sh
kubectl -n configra-app create secret generic configra-credentials \
  --from-file=token=/secure/configra-token \
  --from-file=tls.crt=/secure/client.crt \
  --from-file=tls.key=/secure/client.key
```

示例还使用 `configra-server-trust` Secret 的 `ca.crt` 验证 API **服务器**。在 provider / controller 各自 Namespace 创建它；若服务器使用公共 PKI，可移除 `--server-ca-file` 和对应挂载，使用系统信任根。

不同工作负载应使用独立 Token 和证书，便于轮换与吊销。但授予同一个 Environment 的 Token 仍有相同的服务端配置读取范围，Kubernetes Namespace 不会缩窄它。

## CSI 文件挂载

先安装已修补的 Secrets Store CSI Driver。当前集群验证使用 Kubernetes 1.35.0 和 Driver 1.6.1。需要刷新文件时开启驱动 `enableSecretRotation=true`，并选择合适的 `rotationPollInterval`。

以下命令先渲染并检查仓库示例；实际部署应用你修改后的 overlay，不要直接把示例 registry 地址应用到集群。

```sh
kubectl kustomize kubernetes/deploy/provider
# 检查并应用自己的 overlay 后：
kubectl apply -f kubernetes/examples/provider.yaml
```

SecretProviderClass 中的关键字段如下，完整示例还包含 Pod、只读挂载与 `nodePublishSecretRef`：

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

一次安装 CRD，再在每个应用 Namespace 部署控制器。控制器使用命名空间 Role、双副本 leader election，不允许跨 Namespace 引用凭据或目标。不要把它放在存有 Configra Master Key 的 Namespace。

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

默认使用 Secret。ConfigMap 不适合机密值；包含 Vault 派生值时，必须显式设置 `allowSensitiveConfigMap: true` 才允许写入 ConfigMap。即便没有 Vault 引用，普通 Config 也可能包含敏感信息，需要操作者自行判断。

使用 `target.mode: env` 时，配置必须是扁平映射，例如 `PORT: 8080`、`LOG_LEVEL: info`。嵌套值、null、重复键和跨对象冲突会被拒绝。File 字段使用 `files` 模式。

## 失败与生命周期

原生控制器只更新自己持有 owner reference 的目标，不覆盖无关对象。读取失败保留旧内容；修改目标名称或类型后，在新目标写入成功后移除旧的自有目标。删除 Binding 会通过 Kubernetes 垃圾回收删除其拥有的目标。

CSI 读取失败不交付部分文件集合。已有文件或原生对象可能继续保留上一次数据；吊销凭据不能收回已经交付的字节。

限制：CSI 至多 32 个对象、总计 3 MiB；原生目标总计 900 KiB；env 模式每份文档至多 128 KiB。

原生 volume 更新具有传播延迟，envFrom 创建的进程环境不会自动改变。参阅 [Kubernetes ConfigMap 更新机制](https://kubernetes.io/docs/concepts/configuration/configmap/)与 [CSI 轮换说明](https://secrets-store-csi-driver.sigs.k8s.io/topics/secret-auto-rotation.html)。
