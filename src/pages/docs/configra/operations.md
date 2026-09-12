---
layout: ../../../layouts/Docs.astro
title: 备份、升级与排障
description: 先备份数据，再到新数据库中演练恢复；按错误现象排查，不覆盖现有数据库。
source: deploy/backup/README.md
---

本篇用于已部署的服务。备份和恢复是两项独立操作：只想备份时，不要继续执行恢复命令。先在隔离环境演练，再安排生产切换。

## 备份哪些数据

需要保留三类内容：MySQL 中的配置、Vault 和凭据；原来的 Master Key 与启动配置；ClickHouse 中的访问和审计日志。数据库备份没有 Master Key 仍然无法解密，所以两者都要备份，但必须分开保护。NATS 中传递的临时事件不作为配置恢复来源。

备份文件需要加密、权限控制、保留策略与异地存储。SHA-256 清单可以检测损坏，不是来源真实性签名。Master Key 不应放在同一个备份归档或相同访问凭据范围内。

## 1. 准备备份工具和账号

`deploy/backup` 提供 MySQL 8.0.22 的备份与恢复脚本。执行前需要 MySQL 8.0.22 客户端工具，并挂载 `/run/secrets/mysql.cnf`，例如：

```ini
[client]
host=mysql.example.internal
port=3306
protocol=tcp
user=configra_backup
password=replace-through-secret-volume
```

将主机和账号替换为自己的配置，通过受控 Secret 提供密码；不要把真实文件提交到 Git。备份账号需要读取目标库的权限；恢复账号需要创建、写入和在失败时删除指定的新目标库。`/backup` 必须是可写的持久备份挂载。

## 2. 备份 MySQL

下面从仓库根目录进入工具目录。`configra` 是要备份的数据库名；`/backup` 必须是事先准备好的持久备份挂载。每次备份使用一个新的空目录：

```sh
cd deploy/backup
mkdir -m 700 /backup/new-point
sh mysql-backup.sh /run/secrets/mysql.cnf configra /backup/new-point
```

备份使用单事务一致性导出，生成压缩 SQL 与哈希清单，拒绝覆盖已有输出。恢复先校验清单，只创建新数据库，不覆盖现有数据库。导出期间不要并发执行 schema 升级。

成功后，备份目录包含 `mysql.sql.gz` 和 `manifest.sha256`。重复执行时应换一个备份目录和恢复库名，不要删除已有备份来让命令通过。当前脚本不用于 8.0.22 与 8.4 的跨版本迁移。

## 3. 到新数据库中演练恢复

仍在 `deploy/backup` 目录执行。先确认连接文件指向演练服务器，并使用有恢复权限的账号。`configra_restore_trial` 是**必须尚不存在**的新数据库名，不是现有生产库：

```sh
sh mysql-restore.sh /run/secrets/mysql.cnf /backup/new-point configra_restore_trial
```

恢复后，用原来的 Master Key 启动一套隔离的 Configra，连接新数据库。检查 `/health/ready`，并实际读取配置、验证客户端证书。全部通过后才能计划切换；不要把复制备份文件当成已验证恢复。

## 日志与升级

ClickHouse 使用原生备份，仓库脚本同样恢复到新目标。确认行数、保留期限及访问权限后再切换查询。可以先恢复配置读取，再恢复历史日志；Management 仍需要可以连接的 ClickHouse。

每次升级前记下原镜像、版本标签、数据库备份位置，以及从哪里恢复 Master Key。先升级 Management，再升级 API，最后用 SDK 或 Kubernetes 中的应用实际读取。不能假定旧版程序还能读取新版数据库结构。

## 常见问题

| 现象                           | 优先检查                                                        |
| ------------------------------ | --------------------------------------------------------------- |
| readiness 失败                 | MySQL 连通性、数据库状态、Master Key 是否与该数据库匹配         |
| OIDC 登录后权限不足            | issuer、回调地址、可信 role Claim 及 Admin / Viewer 映射        |
| TLS 握手失败                   | API hostname、服务器信任 CA、客户端证书、Ingress 是否透传 TLS   |
| 刚创建 CA 的客户端暂时不能连接 | 等待最多一个约 5 秒的公共信任刷新周期，再检查证书配置           |
| 机器读取被拒绝                 | Token 的环境范围、到期/吊销状态、客户端及 CA 的活动状态         |
| Vault 引用不能解析             | 四段引用格式、字段类型、目标环境中是否存在对应值                |
| Binding 不覆盖同名对象         | 目标是否由该 Binding 拥有；控制器刻意保护无关对象               |
| Secret 已更新但应用没变化      | 应用是否重读文件；是否用了 subPath；envFrom 是否替换了 Pod      |
| CA 能看到但不能签发            | Master Key、CA 状态和到期时间；不要重新生成 Master Key 尝试修复 |

错误工单只附带版本、Request ID、状态码和已脱敏的配置结构，不附带 Token、私钥、Vault 明文或原始完整响应。

## 生产前检查

- 在自己的基础设施上完成持续负载测试，不沿用历史 QPS 数字作为容量承诺。
- 演练从备份和 Master Key 恢复，并验证客户端证书与配置读取。
- 为证书到期、数据库异常、同步失败和不可用状态配置组织自己的监控。
- 确认按整个环境授权符合需求，不会让不应互读的应用拿到同一环境的权限。
- 检查 [当前预发布限制](/docs/configra/security/)，再决定灰度和回退策略。
