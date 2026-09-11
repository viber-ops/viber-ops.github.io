---
layout: ../../../layouts/Docs.astro
title: 备份、升级与排障
description: 分开恢复配置状态与日志，保管 Master Key，并用可验证的步骤排查问题。
source: deploy/backup/README.md
---

## 备份哪些数据

MySQL 包含完整服务状态，必须配合单独保存的 Master Key 与启动配置才能恢复。ClickHouse 中的访问和审计日志独立备份。Core NATS 是临时事件流，不属于可恢复配置状态。

备份文件需要加密、权限控制、保留策略与异地存储。SHA-256 清单可以检测损坏，不是来源真实性签名。Master Key 不应放在同一个备份归档或相同访问凭据范围内。

## MySQL 恢复流程

`deploy/backup` 提供 MySQL 8.0.22 的备份与恢复脚本。通过挂载的 `--defaults-extra-file` 传入凭据，不在命令行直接写密码。下列命令从该目录运行：

```sh
sh mysql-backup.sh /run/secrets/mysql.cnf configra /backup/new-point
sh mysql-restore.sh /run/secrets/mysql.cnf /backup/new-point configra_restore_trial
```

备份使用单事务一致性导出，生成压缩 SQL 与哈希清单，拒绝覆盖已有输出。恢复先校验清单，只创建新数据库，不覆盖现有数据库。导出期间不要并发执行 schema 升级。

恢复后，使用单独恢复的原 Master Key 启动隔离实例。只有在 `/health/ready` 成功、配置和证书读取经过验证后，才能提升该数据库为使用目标。

## 日志与升级

ClickHouse 使用原生备份，仓库脚本同样恢复到新目标。确认行数、保留期限及访问权限后再切换查询。恢复配置服务不必等日志恢复完成。

每次升级前记录原镜像、标签、数据库备份点与 Master Key 恢复位置。先升级 Management，再升级 API，最后验证 SDK / Kubernetes 消费。不要把旧二进制能否读取新 schema 当成默认保证。

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
- 评估 Environment-wide 授权是否适合自己的信任关系。
- 检查 [当前预发布限制](/docs/configra/security/)，再决定灰度和回退策略。
